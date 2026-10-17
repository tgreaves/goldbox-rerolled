// Saved games as the original's files (IMP-006): SAVGAM<x>.DAT plus CHRDAT<x><n>.SAV/.ITM/.SPC per
// party member (spec/savegame.md), exported as one ZIP and imported from loose files or a ZIP, so a
// game moves between this port and DOSBox.
import { parseSave } from '../data/save'
import type { SavedGame, StoredCharacter } from './user'

export interface NamedFile { name: string; data: Uint8Array }

/** The files of one saved game, named as the original writes them. */
export function saveFiles(g: SavedGame): NamedFile[] {
  const stems = parseSave(g.dat).party
  const out: NamedFile[] = [{ name: `SAVGAM${g.slot}.DAT`, data: g.dat }]
  g.chars.forEach((c, i) => {
    const stem = stems[i] ?? `CHRDAT${g.slot}${i + 1}`
    out.push({ name: `${stem}.SAV`, data: c.sav })
    out.push({ name: `${stem}.ITM`, data: c.itm ?? new Uint8Array(0) })
    out.push({ name: `${stem}.SPC`, data: c.spc ?? new Uint8Array(0) })
  })
  return out
}

/** Saved games found among the files: each SAVGAM<x>.DAT with every party file it names. */
export function savesFrom(files: NamedFile[]): { games: SavedGame[]; missing: string[] } {
  const byName = new Map(files.map((f) => [f.name.split('/').pop()!.toUpperCase(), f.data]))
  const games: SavedGame[] = []
  const missing: string[] = []
  for (const [name, dat] of byName) {
    const m = /^SAVGAM([A-J])\.DAT$/.exec(name)
    if (!m) continue
    let stems: string[]
    try { stems = parseSave(dat).party } catch { missing.push(`${name} (not a saved game)`); continue }
    const chars = stems.map((s) => ({ sav: byName.get(`${s.toUpperCase()}.SAV`), itm: byName.get(`${s.toUpperCase()}.ITM`), spc: byName.get(`${s.toUpperCase()}.SPC`) }))
    const lost = stems.filter((_, i) => !chars[i].sav)
    if (lost.length) { missing.push(...lost.map((s) => `${s}.SAV`)); continue }
    const first = chars[0]?.sav
    const leader = first ? String.fromCharCode(...first.subarray(1, 1 + first[0])) : 'empty'
    games.push({ slot: m[1], dat, chars: chars.map((c) => ({ sav: c.sav!, itm: c.itm, spc: c.spc })),
      label: `${leader}'s party (imported)`, savedAt: Date.now() })
  }
  return { games, missing }
}

/** The original's file stem for a character (DS:0D1A): the name without ` .*,?/\:;|`, first 8 characters. */
export function charStem(name: string): string {
  return name.replace(/[ .*,?/\\:;|]/g, '').slice(0, 8).toUpperCase()
}

/**
 * Roster characters from a DOS install's save folder (spec/menus.md, "Character files"): each
 * <stem>.CHA with its .ITM and .SPC; with charlist.txt, only the names it lists.
 */
export function rosterFrom(files: NamedFile[]): { chars: StoredCharacter[]; missing: string[] } {
  const byName = new Map(files.map((f) => [f.name.split('/').pop()!.toUpperCase(), f.data]))
  const list = byName.get('CHARLIST.TXT')
  const wanted = list ? new TextDecoder().decode(list).split(/\r?\n/).map((s) => s.trim()).filter(Boolean).map(charStem) : null
  const stems = wanted ?? [...byName.keys()].filter((n) => n.endsWith('.CHA')).map((n) => n.slice(0, -4))
  const chars: StoredCharacter[] = []
  const missing: string[] = []
  for (const stem of new Set(stems)) {
    const sav = byName.get(`${stem}.CHA`)
    if (!sav || sav.length < 0x11d) { missing.push(`${stem}.CHA`); continue }
    chars.push({ stem, sav: sav.slice(0, 0x11d), itm: byName.get(`${stem}.ITM`), spc: byName.get(`${stem}.SPC`) })
  }
  return { chars, missing }
}

// ------------------------------------------------------------------ ZIP (stored, or deflate on read)
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()
export function crc32(d: Uint8Array) {
  let c = 0xffffffff
  for (const b of d) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** A ZIP of the files, stored without compression (the files are small). */
export function zip(files: NamedFile[], when = new Date()): Uint8Array {
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)
  const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()
  const enc = new TextEncoder()
  const locals: Uint8Array[] = [], centrals: Uint8Array[] = []
  let offset = 0
  for (const f of files) {
    const name = enc.encode(f.name), crc = crc32(f.data), n = f.data.length
    const local = new Uint8Array(30 + name.length)
    const lv = new DataView(local.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(10, time, true); lv.setUint16(12, date, true)
    lv.setUint32(14, crc, true); lv.setUint32(18, n, true); lv.setUint32(22, n, true); lv.setUint16(26, name.length, true)
    local.set(name, 30)
    const central = new Uint8Array(46 + name.length)
    const cv = new DataView(central.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(12, time, true); cv.setUint16(14, date, true)
    cv.setUint32(16, crc, true); cv.setUint32(20, n, true); cv.setUint32(24, n, true); cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true)
    central.set(name, 46)
    locals.push(local, f.data); centrals.push(central)
    offset += local.length + n
  }
  const size = centrals.reduce((a, c) => a + c.length, 0)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true)
  ev.setUint32(12, size, true); ev.setUint32(16, offset, true)
  const out = new Uint8Array(offset + size + 22)
  let o = 0
  for (const part of [...locals, ...centrals, end]) { out.set(part, o); o += part.length }
  return out
}

/** Read a ZIP's files (stored, or deflated when the browser has DecompressionStream). */
export async function unzip(d: Uint8Array): Promise<NamedFile[]> {
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength)
  let e = d.length - 22
  while (e >= 0 && v.getUint32(e, true) !== 0x06054b50) e--
  if (e < 0) throw new Error('not a ZIP file')
  const count = v.getUint16(e + 10, true)
  let c = v.getUint32(e + 16, true)
  const dec = new TextDecoder()
  const out: NamedFile[] = []
  for (let i = 0; i < count; i++) {
    if (v.getUint32(c, true) !== 0x02014b50) throw new Error('damaged ZIP file')
    const method = v.getUint16(c + 10, true), csize = v.getUint32(c + 20, true)
    const nlen = v.getUint16(c + 28, true), xlen = v.getUint16(c + 30, true), clen = v.getUint16(c + 32, true)
    const local = v.getUint32(c + 42, true)
    const name = dec.decode(d.subarray(c + 46, c + 46 + nlen))
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const raw = d.subarray(start, start + csize)
    if (!name.endsWith('/')) {
      if (method === 0) out.push({ name, data: raw.slice() })
      else if (method === 8 && typeof DecompressionStream !== 'undefined') {
        const stream = new Blob([raw.slice() as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
        out.push({ name, data: new Uint8Array(await new Response(stream).arrayBuffer()) })
      } else throw new Error(`${name}: unsupported compression`)
    }
    c += 46 + nlen + xlen + clen
  }
  return out
}
