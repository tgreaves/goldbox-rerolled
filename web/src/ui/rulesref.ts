// The Rules reference (IMP-058): what the printed rule book and journal told players, in short, for
// the game as the port runs it (spec/). Opened from ☰.
import type { SpellTables } from '../data/spells'
import { spellText } from '../rules/spelltext'
import { onClose } from './sheet'

type Tab = 'basics' | 'classes' | 'combat' | 'spells' | 'keys'
let tab: Tab = 'basics'

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)
const dl = (rows: [string, string][]) => `<dl class="rules">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`

const BASICS: [string, string][] = [
  ['Abilities', 'STR, INT, WIS, DEX, CON and CHA run from 3 to 18 (higher with magic). Each class needs certain ones; high scores give bonuses (see the tooltips on the character sheet).'],
  ['Hit points', 'At 0 a character is unconscious; below 0 dying, losing one more each round until dead at −10. Bandage a dying character in combat, or heal them.'],
  ['Armour class (AC)', 'Lower is better: 10 unarmoured, 5 chain mail, 3 plate, lower with shields, magic and dexterity.'],
  ['THAC0', 'The d20 roll needed to hit AC 0. To hit AC 4 with THAC0 15 you need 11 or more. It improves with level.'],
  ['Saving throws', 'A d20 roll against death, petrification, wands, breath or spells; a success halves or avoids the harm.'],
  ['Experience and levels', 'Experience comes from defeated monsters, treasure and commissions. With enough, train at a training hall (it costs money) to gain a level.'],
  ['Load and movement', 'Everything carried is weighed in coins, each coin counting 1. Heavy loads lower movement; too much and nothing more can be picked up.'],
  ['Resting and spells', 'Spells are memorised in camp and need rest to learn: the more spells, the longer. Resting also heals 1 hit point a day per character. Monsters may interrupt.'],
  ['Time', 'Moving, searching and resting pass time; effects such as spells run out with it.'],
  ['Commissions and the journal', 'The City Council in New Phlan hands out commissions: clear a block, find something, deliver something. Journal entries, proclamations and tavern tales the game mentions are in ☰ → Journal.'],
]

const CLASSES: [string, string][] = [
  ['Fighter', 'The best at fighting: best THAC0, most hit points, any weapon and armour, exceptional strength, more attacks from level 7.'],
  ['Cleric', 'Heals and protects: cleric spells (all known; chosen at camp), turns undead, blunt weapons only, any armour. Wisdom 13+ gives extra spells.'],
  ['Magic-User', 'Powerful spells learned from scrolls (Read Magic, then Scribe at camp), few hit points, no armour, daggers, darts and staves.'],
  ['Thief', 'Opens locks, finds and removes traps, climbs, hides; backstabs from behind for extra damage; leather armour.'],
  ['Multi-class', 'Demi-humans can be two or three classes at once: experience is split between them, and they use the best of each (a fighter/magic-user wears armour and still casts).'],
  ['Races', 'Humans: any class, no level limits. Dwarves, elves, gnomes, half-elves and halflings: infravision, resistances, level limits in some classes; elves resist Sleep and Charm.'],
  ['Alignment', 'Law and chaos, good and evil: some items (alignment-locked swords) refuse the wrong alignment.'],
]

const COMBAT: [string, string][] = [
  ['Turns', 'Everyone acts in order of initiative, rolled each round. On a character\'s turn the commands appear; while they have movement left, step with the arrow keys or a tap on a neighbouring square.'],
  ['Moving', 'A straight step costs 2, a diagonal 3, from the movement shown. Leaving an enemy\'s side lets it strike first. Walking into an enemy attacks it; off the edge of the field you are asked whether to flee.'],
  ['Aim', 'Attack a target in range with the readied weapon; the list shows the chance to hit and the damage dice. From behind is easier; thieves backstab. Missiles need ammunition and cannot be fired with an enemy adjacent (thrown weapons can).'],
  ['Cast', 'Spells with a casting time start now and go off later in the round ("Begins Casting"); damage before then loses the spell.'],
  ['Guard, Delay, End turn', 'Guard: strike the first enemy that comes adjacent. Delay: act after everyone faster. End turn: do nothing more.'],
  ['Quick and Magic', 'Quick lets the computer play a character until you press Space or Take control (or Play by hand on the sheet). Magic On lets characters on Quick cast spells.'],
  ['Dying', 'A character at −1 to −9 hit points is dying and dies at −10; Bandage (any party member, any distance) or healing stops it.'],
  ['After the battle', 'Experience is shared among those still standing; treasure and the monsters\' money can be taken, shared or pooled.'],
]

const KEYS: [string, string][] = [
  ['Exploring', 'Arrow keys or 8/4/6/2: move and turn · A area map · C or V the current character\'s sheet (cast spells there) · E encamp · S search · L look · Esc ☰ menu'],
  ['Menus', 'The highlighted letter, or 1–9, picks a choice; Enter or Space continues a "press Enter" prompt'],
  ['Combat', 'Arrows or the numeric keypad: step · Esc: undo steps · Space: take back characters on Quick · Alt-M: Magic On/Off'],
  ['Panels', 'Esc or ✕ closes'],
]

export function rulesReference(dialog: HTMLDialogElement, spells: SpellTables | null): Promise<void> {
  const render = () => {
    const tabs: [Tab, string][] = [['basics', 'Basics'], ['classes', 'Classes'], ['combat', 'Combat'], ['spells', 'Spells'], ['keys', 'Keys']]
    let body = ''
    if (tab === 'basics') body = dl(BASICS)
    else if (tab === 'classes') body = dl(CLASSES)
    else if (tab === 'combat') body = dl(COMBAT)
    else if (tab === 'keys') body = dl(KEYS)
    else if (spells) {
      for (const [cls, title] of [[0, 'Cleric'], [1, 'Magic-User']] as const) for (const lvl of [1, 2, 3]) {
        const list = spells.spells.filter((s) => s.id <= 55 && s.cls === cls && s.level === lvl)
        if (!list.length) continue
        body += `<h3>${title} level ${lvl}</h3>${dl(list.map((s) => [s.name, spellText(s)]))}`
      }
    } else body = '<p class="muted">The spell list needs START.EXE among the game files.</p>'
    dialog.innerHTML = `<h2>Rules reference</h2>
      <div class="nc-opts">${tabs.map(([k, l]) => `<button type="button" data-tab="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="rules-body">${body}</div>
      <form method="dialog"><button>Close</button></form>`
  }
  return new Promise((resolve) => {
    const onClick = (e: MouseEvent) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-tab]')
      if (b) { tab = b.dataset.tab as Tab; render() }
    }
    dialog.addEventListener('click', onClick)
    onClose(dialog, () => { dialog.removeEventListener('click', onClick); resolve() })
    dialog.classList.add('wide')
    render()
    dialog.showModal()
  })
}
