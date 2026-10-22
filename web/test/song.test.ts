// The title music's sequencer (audio/song.ts, spec/A-games/sotsb/music.md): SOUND.DAX record 2's song 0 as
// the original driver's AdLib register writes, tick by tick. The expected log was made separately from the
// spec's procedure; only its SHA-256 is kept here (the log itself is derived game data). Needs SOTSB.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { readDax, daxRecords } from '../src/data/dax'
import { songWrites, renderSong, songChunks, SONG_TICK_HZ } from '../src/audio/song'

const dir = process.env.SOTSB ?? ''
const have = dir !== '' && existsSync(join(dir, 'SOUND.DAX'))

describe.skipIf(!have)('SotSB title music', () => {
  const rec = () => daxRecords(readDax(new Uint8Array(readFileSync(join(dir, 'SOUND.DAX'))))).get(2)!
  it('makes the driver\'s 3 589 register writes over 6 152 ticks (84.5 s)', () => {
    const w = songWrites(rec())
    expect(w.length).toBe(3589)
    expect(w.at(-1)!.tick).toBe(6152)
    const log = w.map((x) => `${x.tick} ${x.reg.toString(16).padStart(2, '0')} ${x.value.toString(16).padStart(2, '0')}`).join('\n') + '\n'
    expect(createHash('sha256').update(log).digest('hex')).toBe('eef168725e4ebac67dbd1b07db18d822ab0cc4fc5473e5642e52d44ca896a234')
    expect(6152 / SONG_TICK_HZ).toBeCloseTo(84.5, 1)
  })
  it('streamed in chunks, as it plays, gives the same samples as one render', () => {
    const w = songWrites(rec()).filter((x) => x.tick < 300)
    const whole = renderSong(w, 22050)
    const next = songChunks(w, 22050, 4000), parts: number[] = []
    for (let c = next(); c; c = next()) parts.push(...c)
    expect(parts.length).toBe(whole.length)
    let d = 0
    for (let i = 0; i < whole.length; i++) d = Math.max(d, Math.abs(whole[i] - parts[i]))
    expect(d).toBeLessThan(1e-6)
  })
  it('renders to audible, unclipped sound', () => {
    const pcm = renderSong(songWrites(rec()).filter((x) => x.tick < 400), 22050)
    let peak = 0
    for (const v of pcm) peak = Math.max(peak, Math.abs(v))
    expect(peak).toBeGreaterThan(0.02)
    expect(peak).toBeLessThan(1)
  })
})
