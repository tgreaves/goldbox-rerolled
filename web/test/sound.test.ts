// The TypeScript sound driver against tools/sound.py, sample for sample (PC speaker).
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { unexepack } from '../src/data/exepack'
import { renderEffect } from '../src/audio/driver'

const dir = process.env.POOLRAD ?? ''
const exe = join(dir, 'START.EXE')
const have = dir !== '' && existsSync(exe)
const TOOLS = join(__dirname, '..', '..', 'tools')

describe.skipIf(!have)('sound driver', () => {
  it('renders every effect like tools/sound.py, full and cut', () => {
    const ref = JSON.parse(execFileSync('python3', ['-c', `
import sys, json
sys.path.insert(0, ${JSON.stringify(TOOLS)})
import sound
img = sound.load_image(${JSON.stringify(exe)})
out = {}
for n in range(2, 22):
    for cut in (None, 20):
        y, _ = sound.run_pc(img, n, cut=cut)
        out['%d/%s' % (n, cut)] = [round(v, 5) for v in y]
print(json.dumps(out))
`], { maxBuffer: 1 << 28 }).toString()) as Record<string, number[]>
    expect(Object.keys(ref).length).toBe(40)
    const { image } = unexepack(new Uint8Array(readFileSync(exe)))
    for (const [key, samples] of Object.entries(ref)) {
      const [n, cut] = key.split('/')
      const mine = renderEffect(image, Number(n), 44100, cut === 'None' ? undefined : Number(cut))
      expect(mine.length, key).toBe(samples.length)
      let worst = 0
      for (let i = 0; i < samples.length; i++) worst = Math.max(worst, Math.abs(mine[i] / 0.35 - samples[i]))
      expect(worst, key).toBeLessThan(1e-3)
    }
  }, 120000)
})
