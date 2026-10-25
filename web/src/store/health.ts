// The imported game files' health (IMP-105): what is missing, empty, damaged or of another edition, said
// in terms of what it costs in play. Run on import (an error stops it), whenever a game is opened, and
// shown on the games screen (the last result kept per game) and the party screen.
import type { GameFiles } from './gamefiles'
import type { GameProfile } from '../games/profile'
import { unexepack } from '../data/exepack'

export interface Problem {
  /** error: the game cannot start, or a file is damaged; warning: it plays, without something */
  level: 'error' | 'warning'
  text: string
}

async function sha256(b: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', b.slice().buffer)
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

/** A DAX file whose index fits in it and whose every record lies inside it. */
function daxIntact(b: Uint8Array): boolean {
  if (b.length < 2) return false
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const hlen = dv.getUint16(0, true)
  if (hlen < 9 || 2 + hlen > b.length) return false
  const base = 2 + hlen
  for (let i = 0; i + 9 <= hlen; i += 9) {
    const offset = dv.getUint32(3 + i, true), comp = dv.getUint16(9 + i, true)
    if (base + offset + comp > b.length) return false
  }
  return true
}

/** The problems of a game's files, errors first; [] when all is well. */
export async function checkImport(files: GameFiles): Promise<Problem[]> {
  const g = files.game, out: Problem[] = []
  const err = (text: string) => out.push({ level: 'error', text }), warn = (text: string) => out.push({ level: 'warning', text })
  for (const n of g.required) if (!files.files.has(n)) err(`${n} is missing: the game cannot start without it.`)
  for (const [n, b] of files.files) {
    if (!b.length) err(`${n} is empty (0 bytes): the copy was cut short.`)
    else if (n.endsWith('.DAX') && !daxIntact(b)) err(`${n} is damaged: its index points past the end of the file.`)
  }
  const exe = files.get('START.EXE'), ovr = files.get('GAME.OVR')
  if (!exe) warn('START.EXE is missing: no sound effects, no rules tables (creation, training, shops, spells), and the game\'s messages show as #codes.')
  else if (exe.length) {
    try { unexepack(exe) } catch { err('START.EXE cannot be read: it is damaged, or not this game\'s.') }
  }
  if (!ovr) warn('GAME.OVR is missing: part of the game\'s text shows as #codes, and the credits and the ending\'s captions are blank.')
  else if (ovr.length) {
    const sig = String.fromCharCode(ovr[0], ovr[1], ovr[2], ovr[3])
    if (sig !== 'FBOV' && sig !== 'TPOV') err('GAME.OVR is not an overlay file: it is damaged, or not this game\'s.')
  }
  if (!files.get('ITEMS')) warn('ITEMS is missing: no shops, treasure or item names.')
  // the edition: the code files' fingerprints against the edition the port reads
  const other: string[] = []
  for (const n of ['START.EXE', 'GAME.OVR'] as const) {
    const b = files.get(n)
    if (b?.length && (await sha256(b)) !== g.fingerprints[n]) other.push(n)
  }
  if (other.length) {
    warn(`${other.join(' and ')} ${other.length > 1 ? 'are' : 'is'} not from the edition the port reads (${g.edition}): the game's text, rules tables and sounds are read from fixed places in ${other.length > 1 ? 'them' : 'it'}, so some will be missing or wrong.`)
  }
  return out.sort((a, b) => (a.level === b.level ? 0 : a.level === 'error' ? -1 : 1))
}

const key = (g: GameProfile) => `goldbox.health.${g.id}`

/** The last check's result for a game (null: never checked in this browser). */
export function lastHealth(g: GameProfile): Problem[] | null {
  try { const v = localStorage.getItem(key(g)); return v ? (JSON.parse(v) as Problem[]) : null } catch { return null }
}

export function keepHealth(g: GameProfile, problems: Problem[] | null) {
  try { if (problems) localStorage.setItem(key(g), JSON.stringify(problems)); else localStorage.removeItem(key(g)) } catch { /* this page only */ }
}

/** "2 problems", "1 warning" … for a card */
export function healthSummary(p: Problem[]): string {
  const e = p.filter((x) => x.level === 'error').length, w = p.length - e
  return [e ? `${e} problem${e === 1 ? '' : 's'}` : '', w ? `${w} warning${w === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ')
}
