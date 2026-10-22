// Game text read from the player's own files by address (spec/README.md D1, spec/D-appendices/strings.md).
// An address is the offset of a Turbo Pascal string's length byte in the game's merged image:
// START.EXE unpacked, GAME.OVR's overlays placed after it as tools/mergeovr.py places them
// (spec/A-games/engine/containers.md). Nothing of the text is stored in the code.
import { unexepack } from './exepack'

/**
 * The merged image: the unpacked START.EXE, then each overlay's code from GAME.OVR, in the order of
 * their file offsets, from the first 256-paragraph boundary past the program and its stack, each
 * starting on a paragraph. Without GAME.OVR, only the resident part.
 */
export function mergedImage(startExe: Uint8Array, ovr?: Uint8Array): Uint8Array {
  const u = unexepack(startExe)
  const img = u.image
  // 'FBOV' (PoR, CotAB: the signature and a dword, code from offset 8) or 'TPOV' (SotSB: the signature alone,
  // code from offset 4; spec/A-games/engine/containers.md)
  const sig = ovr ? String.fromCharCode(ovr[0], ovr[1], ovr[2], ovr[3]) : ''
  if (!ovr || (sig !== 'FBOV' && sig !== 'TPOV')) return img
  const first = sig === 'FBOV' ? 8 : 4
  const dv = new DataView(img.buffer, img.byteOffset, img.byteLength)
  // the overlay stubs: CD 3F 00 00, the overlay's file offset (32 bits), code size, fix-up size,
  // entry count; each entry at +0x20 + 5·i begins CD 3F
  const stubs: { fo: number; size: number }[] = []
  for (let p = 0; p + 0x20 <= img.length; p += 16) {
    if (img[p] !== 0xcd || img[p + 1] !== 0x3f || img[p + 2] !== 0 || img[p + 3] !== 0) continue
    const fo = dv.getUint32(p + 4, true), size = dv.getUint16(p + 8, true), n = dv.getUint16(p + 12, true)
    if (!n || fo < first || fo >= ovr.length) continue
    let ok = true
    for (let i = 0; i < n && ok; i++) ok = img[p + 0x20 + 5 * i] === 0xcd && img[p + 0x21 + 5 * i] === 0x3f
    if (ok) stubs.push({ fo, size })
  }
  stubs.sort((a, b) => a.fo - b.fo)
  let base = Math.max(Math.ceil((u.ss * 16 + u.sp) / 16), Math.ceil(img.length / 16))
  base = (base + 0xff) & ~0xff
  let total = base * 16
  for (const s of stubs) total += Math.ceil(s.size / 16) * 16
  const out = new Uint8Array(total)
  out.set(img)
  let at = base * 16
  for (const s of stubs) {
    out.set(ovr.subarray(s.fo, s.fo + s.size), at)
    at += Math.ceil(s.size / 16) * 16
  }
  return out
}

/** Reads Pascal strings from a merged image. */
export class GameText {
  readonly image: Uint8Array | null
  constructor(image: Uint8Array | null) { this.image = image }

  /** the string whose length byte is at `at`, or null when there is none there (no file, out of range, not text) */
  read(at: number): string | null {
    const b = this.image
    if (!b || at < 0 || at >= b.length) return null
    const n = b[at]
    if (at + 1 + n > b.length) return null
    let s = ''
    for (let i = 1; i <= n; i++) {
      const c = b[at + i]
      if (c < 0x20 || c > 0x7e) return null
      s += String.fromCharCode(c)
    }
    return s
  }
}

let current = new GameText(null)
let from: [Uint8Array | undefined, Uint8Array | undefined] = [undefined, undefined]

/** Use these game files' text from now on (called when a game's files are opened and by every engine). */
export function installText(startExe: Uint8Array | undefined, ovr: Uint8Array | undefined) {
  if (from[0] === startExe && from[1] === ovr && (current.image || !startExe)) return
  from = [startExe, ovr]
  let image: Uint8Array | null = null
  if (startExe) try { image = mergedImage(startExe, ovr) } catch { image = null }
  current = new GameText(image)
}

/** whether the current game's text can be read at all (START.EXE present and readable) */
export const textAvailable = () => current.image !== null

/**
 * The game's text at image address `at`. When it cannot be read (no START.EXE, no GAME.OVR for an
 * overlay string, or not a string there) the address is shown instead, `#` and its hex digits, as a
 * missing name shows `#n` (spec/D-appendices/strings.md §1).
 */
export function text(at: number): string {
  return current.read(at) ?? `#${at.toString(16).toUpperCase()}`
}

/**
 * A line given as one address or as pieces joined (SotSB builds its lines from data-segment pieces, "is "
 * and a word: spec/A-games/sotsb/spells.md §1); 0 or nothing: ''.
 */
export function lineText(at: number | number[] | undefined): string {
  if (Array.isArray(at)) return at.map((a) => text(a)).join('')
  return at ? text(at) : ''
}

/** the game's text at `at`, or null when it cannot be read (for comparisons such as monster names) */
export function textOrNull(at: number): string | null {
  return current.read(at)
}
