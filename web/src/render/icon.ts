// Combat icons (FUN_45c5_0482): body pose from CBODY, head from CHEAD laid over its top rows,
// then the six colour bytes char[0xC1..0xC6] remap art colours 1,2,3,4,6,7 (colour-1, low nibble)
// and 9,10,11,12,14,15 (colour-2, high nibble). Record = part + 0x40 when large + 0x80 action pose.
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, type Picture } from '../data/image'
import { F } from '../games/fields'

const PART_COLOURS = [1, 2, 3, 4, 6, 7] // DS:3CF5: Body, Arm, Leg, Hair/Face, Shield, Weapon

export function buildIcon(files: GameFiles, c: Uint8Array, action: boolean): Picture | null {
  const extra = (c[F.iconSize] === 2 ? 0x40 : 0) + (action ? 0x80 : 0)
  const bodyRaw = files.record('CBODY', c[F.iconBody] + extra)
  const headRaw = files.record('CHEAD', c[F.iconHead] + extra)
  if (!bodyRaw) return null
  const body = parseRecord(bodyRaw).frames[0].picture
  const px = body.pixels.slice()
  if (headRaw) {
    const head = parseRecord(headRaw).frames[0].picture
    for (let i = 0; i < head.pixels.length && i < px.length; i++) px[i] |= head.pixels[i]
  }
  const map = Array.from({ length: 16 }, (_, i) => i)
  PART_COLOURS.forEach((col, k) => {
    map[col] = c[F.iconColours + k] & 0xf
    map[col + 8] = c[F.iconColours + k] >> 4
  })
  for (let i = 0; i < px.length; i++) px[i] = map[px[i]]
  return { ...body, pixels: px }
}
