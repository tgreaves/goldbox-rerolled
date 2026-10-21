// The spec's maintenance indexes stay current: every path spec/xref.md names exists, and the generated
// routine lists of spec/D-appendices/addresses.md match the spec's citations (tools/specaddresses.py
// regenerates them).
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('spec indexes', () => {
  it('xref.md names only files and folders that exist', () => {
    const text = readFileSync(join(ROOT, 'spec', 'xref.md'), 'utf8')
    const paths = [...text.matchAll(/`((?:web|server|tools)\/[^`\s]+|IMPROVEMENTS\.md)`/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(100)
    expect(paths.filter((p) => !existsSync(join(ROOT, p)))).toEqual([])
  })

  it('addresses.md lists every address the spec cites (else run python3 tools/specaddresses.py)', () => {
    const r = spawnSync('python3', [join(ROOT, 'tools', 'specaddresses.py'), '--check'], { encoding: 'utf8' })
    expect(r.stdout.trim()).toBe('addresses.md: up to date')
  })
})
