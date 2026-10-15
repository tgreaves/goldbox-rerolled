// EXEPACK port against tools/unexepack.py output (START_UNPACKED.EXE) when available.
import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { unexepack } from '../src/data/exepack'

const dir = process.env.POOLRAD ?? ''
const have = dir !== '' && existsSync(join(dir, 'START.EXE'))

describe.skipIf(!have)('EXEPACK', () => {
  it('unpacks START.EXE exactly like tools/unexepack.py', () => {
    const out = join(mkdtempSync(join(tmpdir(), 'unx-')), 'START_UNPACKED.EXE')
    execFileSync('python3', [join(__dirname, '..', '..', 'tools', 'unexepack.py'), join(dir, 'START.EXE'), out])
    const ref = new Uint8Array(readFileSync(out))
    const hsize = (ref[8] | (ref[9] << 8)) * 16
    const { image, relocs } = unexepack(new Uint8Array(readFileSync(join(dir, 'START.EXE'))))
    expect(relocs.length).toBe(ref[6] | (ref[7] << 8))
    expect(Buffer.from(image).equals(Buffer.from(ref.subarray(hsize)))).toBe(true)
  })
})
