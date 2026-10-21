// Who may join the party (PoR Add: party size; CotAB 0x36848 + 0x3815..0x39F1: also the paladin and
// ranger rules, spec/A-games/coab/records.md §9). Rules from the game's profile (R.join).
import { F } from '../games/fields'
import { R } from '../games/rules'
import { msg } from '../games/strings'

const name = (c: Uint8Array) => String.fromCharCode(...c.subarray(F.name + 1, F.name + 1 + c[F.name]))

/** null when `c` may join `party`; otherwise why not ('' when the original says nothing). */
export function joinRefusal(party: Uint8Array[], c: Uint8Array): string | null {
  if (!party.length) return null // the first member joins with no checks
  const j = R.join
  if (party.some((p) => name(p) === name(c) && p[F.id] === c[F.id])) return '' // already in the party
  const pcs = party.filter((p) => p[F.morale] < 0x80).length
  if (c[F.morale] < 0x80 ? pcs >= j.pcs : party.length >= j.members) return 'The party is full.'
  const evil = (p: Uint8Array) => j.evil.includes(p[F.alignment])
  const paladin = [...party].reverse().find((p) => p[F.levels + 3] > 0) // the last one in the list speaks
  if (j.paladins && c[F.levels + 3] > 0 && party.some(evil)) return msg('noEvilScum')
  if (j.maxRangers !== null && c[F.levels + 4] > 0 && party.filter((p) => p[F.levels + 4] > 0).length >= j.maxRangers) return msg('tooManyRangers')
  if (j.paladins && evil(c) && paladin) return `${name(paladin)}${msg('toleratesNoEvil')}`
  return null
}
