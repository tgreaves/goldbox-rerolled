// The dice tape and the headless runner (spec/B-model/host-contracts.md §6.4, §8). The runs need POOLRAD.
import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { Divergence, TapePlayer, TapeRecorder, generator, type Tape } from '../src/rules/dice'
import { loadFolder, runScript, type Event, type Script } from '../headless/harness'
import { POR } from '../src/games/profile'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(dir)

describe('dice tape', () => {
  it('records every request and replays it roll for roll', () => {
    const rec = new TapeRecorder(generator(9), 'por')
    const asked = [[1, 20], [2, 6], [0, 6], [1, 100], [3, 0]] as const
    const got = asked.map(([n, s]) => rec.roll(n, s))
    const tape = rec.tape()
    expect(tape).toMatchObject({ format: 'goldbox-dice-tape', version: 1, game: 'por' })
    expect(tape.draws.map((d) => [d[0], d[1]])).toEqual(asked)
    const play = new TapePlayer(JSON.parse(JSON.stringify(tape)))
    expect(asked.map(([n, s]) => play.roll(n, s))).toEqual(got)
    expect(play.left).toBe(0)
  })

  it('stops on a request that differs from the tape, and on a tape that runs out', () => {
    const tape: Tape = { format: 'goldbox-dice-tape', version: 1, game: 'por', draws: [[1, 20, 14], [2, 6, 7]] }
    const p = new TapePlayer(tape)
    expect(p.roll(1, 20)).toBe(14)
    expect(() => p.roll(1, 6)).toThrow(Divergence)
    try { p.roll(1, 6) } catch (err) { expect(err).toMatchObject({ index: 1, expected: [2, 6, 7], got: [1, 6] }) }
    const q = new TapePlayer(tape)
    q.roll(1, 20); q.roll(2, 6)
    expect(() => q.roll(1, 4)).toThrow(/ran out/)
  })

  it('refuses a tape with an impossible draw', () => {
    expect(() => new TapePlayer({ format: 'goldbox-dice-tape', version: 1, game: 'por', draws: [[2, 6, 13]] })).toThrow(/not a possible draw/)
    expect(() => new TapePlayer({ format: 'goldbox-dice-tape', version: 1, game: 'por', draws: [[0, 6, 1]] })).toThrow(/not a possible draw/)
  })
})

describe.skipIf(!have)('headless runner', () => {
  const files = () => loadFolder(POR, dir)
  /** a few steps in the first save's area, then a battle with three orcs, everyone on Quick */
  const script: Script = { game: 'por', commands: ['f', 'l', 'f', 'monsters 13 3 4', 'combat'], answers: Array(6).fill('QUICK') }
  const run = async (o: { tape?: Tape; seed?: number; script?: Script }) => {
    const events: Event[] = []
    const r = await runScript({ files: files(), script: o.script ?? script, tape: o.tape, seed: o.seed, out: (e) => events.push(e) })
    return { ...r, events, lines: events.map((e) => JSON.stringify(e)) }
  }

  it('writes the transcript of a script and a battle, and the tape replays it line for line', async () => {
    const a = await run({ seed: 5 })
    const kinds = new Set(a.events.map((e) => e.event))
    for (const k of ['area', 'command', 'write', 'sound', 'screen', 'menu', 'combat', 'end']) expect(kinds).toContain(k)
    expect(a.events.find((e) => e.event === 'screen' && e.what === 'combat')).toBeTruthy()
    // each sound as its call site plays it (spec/C-port/audio.md §3.1): steps, hits and misses transient
    const sounds = a.events.filter((e) => e.event === 'sound') as unknown as { n: number; mode: string }[]
    expect(sounds.some((e) => e.n === 10)).toBe(true)
    for (const e of sounds) if (e.n !== 11) expect([e.n, e.mode]).toEqual([e.n, [7, 9, 10].includes(e.n) ? 'transient' : 'full'])
    expect(a.tape.draws.length).toBeGreaterThan(50)
    const b = await run({ tape: a.tape })
    expect(b.lines).toEqual(a.lines)
    expect(b.end).toBe(a.end)
    const c = await run({ seed: 6 })
    expect(c.lines).not.toEqual(a.lines) // another seed, another battle
  })

  it('ends with a divergence when the run asks what the tape does not have', async () => {
    const a = await run({ seed: 5 })
    const bad: Tape = { ...a.tape, draws: a.tape.draws.map((d, i) => (i === 10 ? [d[0], d[1] + 1, d[0]] : d)) }
    const b = await run({ tape: bad })
    expect(b.end).toBe('divergence')
    expect(b.events.at(-1)).toMatchObject({ event: 'end', reason: 'divergence', message: expect.stringMatching(/entry 10/) })
  })

  it('ends when the answers run out, naming the question', async () => {
    const r = await run({ seed: 5, script: { game: 'por', commands: ['monsters 13 1 4', 'combat'], answers: [] } })
    expect(r.end).toBe('answers')
    expect(r.events.at(-1)).toMatchObject({ event: 'end', reason: 'answers', waiting: { kind: 'menu' } })
  })

  it('runs from the command line with plain node', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'headless-'))
    try {
      writeFileSync(join(tmp, 'script.json'), JSON.stringify(script))
      const web = join(__dirname, '..')
      // the exit status is 1 when the run ends in an error (an answer of the wrong kind): the output still counts
      const node = (args: string[]) => spawnSync(process.execPath, ['--import', './headless/node-ts.mjs', 'headless/run.ts', '--files', dir, '--script', join(tmp, 'script.json'), ...args], { cwd: web, encoding: 'utf8' }).stdout
      const first = node(['--seed', '5', '--record', join(tmp, 'tape.json')])
      const again = node(['--tape', join(tmp, 'tape.json')])
      expect(again).toBe(first)
      expect(JSON.parse(first.trim().split('\n').at(-1)!)).toMatchObject({ event: 'end' })
      expect(JSON.parse(readFileSync(join(tmp, 'tape.json'), 'utf8'))).toMatchObject({ format: 'goldbox-dice-tape', game: 'por' })
    } finally { rmSync(tmp, { recursive: true, force: true }) }
  })
})
