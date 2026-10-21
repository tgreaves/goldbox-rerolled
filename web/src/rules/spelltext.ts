// Spell descriptions for the Cast and Memorize lists and the Rules reference (IMP-058). The numbers
// come from the spell table in the player's START.EXE (spec/A-games/engine/spells.md, "Tables"); the one-line
// effects are each game's own notes (its profile's spellNotes, games/spellnotes.ts).
import type { Spell } from '../data/spells'
import { game } from '../games/profile'


const SAVE = ['', 'save negates', 'save for half', 'special save']
const SAVE_VS = ['vs death/poison/paralysis', 'vs petrification', 'vs rods/staves/wands', 'vs breath', 'vs spell']

/** How far, how long, at whom, the save; L = caster level. */
export function spellStats(s: Spell): string {
  const n = (a: number, b: number, unit: string, zero: string) =>
    a === 0 && b === 0 ? zero : b === 0 ? `${a} ${unit}` : a === 0 ? `${b}/level ${unit}` : `${a} + ${b}/level ${unit}`
  const range = s.range[0] === 0xff ? 'touch' : n(s.range[0], s.range[1], 'sq', 'self/adjacent')
  const dur = n(s.duration[0], s.duration[1], 'rounds', 'instant')
  const mode = s.target & 0x0f
  const who = s.target === 240 ? 'special' : mode === 0 ? 'the caster' : mode >= 8 && mode <= 14 ? `area${s.area ? ` (radius ${s.area})` : ''}` : mode >= 4 && mode <= 7 ? `${(mode & 3) + 1} target${mode & 3 ? 's' : ''}` : 'one target'
  const where = ['camp only', 'combat only', 'camp or combat'][s.where] ?? ''
  const save = s.save ? `${SAVE[s.save]} ${SAVE_VS[s.saveType] ?? ''}`.trim() : 'no save'
  return [`range ${range}`, dur, who, save, where].join(' · ')
}

/** One line for a spell: what it does, then the numbers. */
export function spellText(s: Spell): string {
  return `${game().spellNotes[s.id] ?? ''} ${spellStats(s)}`.trim()
}
