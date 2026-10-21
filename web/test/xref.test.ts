// spec/xref.md names the reference implementation's files for each spec section: every path it names exists.
import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(__dirname, '..', '..')

describe('spec/xref.md', () => {
  it('names only files and folders that exist', () => {
    const text = readFileSync(join(ROOT, 'spec', 'xref.md'), 'utf8')
    const paths = [...text.matchAll(/`((?:web|server|tools)\/[^`\s]+|IMPROVEMENTS\.md)`/g)].map((m) => m[1])
    expect(paths.length).toBeGreaterThan(100)
    expect(paths.filter((p) => !existsSync(join(ROOT, p)))).toEqual([])
  })
})
