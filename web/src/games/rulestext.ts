// The Rules reference's text per game (IMP-058): what the printed rule book told players, in short,
// for the game as the port runs it. PoR: spec/; CotAB: spec/A-games/coab/ (tables §3, records §9–10, effects).

export type Entries = [string, string][]
export interface RulesText { basics: Entries; classes: Entries; combat: Entries; keys: Entries }

const POR_BASICS: Entries = [
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

const POR_CLASSES: Entries = [
  ['Fighter', 'The best at fighting: best THAC0, most hit points, any weapon and armour, exceptional strength, more attacks from level 7.'],
  ['Cleric', 'Heals and protects: cleric spells (all known; chosen at camp), turns undead, blunt weapons only, any armour. Wisdom 13+ gives extra spells.'],
  ['Magic-User', 'Powerful spells learned from scrolls (Read Magic, then Scribe at camp), few hit points, no armour, daggers, darts and staves.'],
  ['Thief', 'Opens locks, finds and removes traps, climbs, hides; backstabs from behind for extra damage; leather armour.'],
  ['Multi-class', 'Demi-humans can be two or three classes at once: experience is split between them, and they use the best of each (a fighter/magic-user wears armour and still casts).'],
  ['Races', 'Humans: any class, no level limits. Dwarves, elves, gnomes, half-elves and halflings: infravision, resistances, level limits in some classes; elves resist Sleep and Charm.'],
  ['Alignment', 'Law and chaos, good and evil: some items (alignment-locked swords) refuse the wrong alignment.'],
]

const POR_COMBAT: Entries = [
  ['Turns', 'Everyone acts in order of initiative, rolled each round. On a character\'s turn the commands appear; while they have movement left, step with the arrow keys or a tap on a neighbouring square.'],
  ['Moving', 'A straight step costs 2, a diagonal 3, from the movement shown. Leaving an enemy\'s side lets it strike first. Walking into an enemy attacks it; off the edge of the field you are asked whether to flee.'],
  ['Aim', 'Attack a target in range with the readied weapon; the list shows the chance to hit and the damage dice. From behind is easier; thieves backstab. Missiles need ammunition and cannot be fired with an enemy adjacent (thrown weapons can).'],
  ['Cast', 'Spells with a casting time start now and go off later in the round ("Begins Casting"); damage before then loses the spell.'],
  ['Guard, Delay, End turn', 'Guard: strike the first enemy that comes adjacent. Delay: act after everyone faster. End turn: do nothing more.'],
  ['Quick and Magic', 'Quick lets the computer play a character until you press Space or Take control (or Play by hand on the sheet). Magic On lets characters on Quick cast spells.'],
  ['Dying', 'A character at −1 to −9 hit points is dying and dies at −10; Bandage (any party member, any distance) or healing stops it.'],
  ['After the battle', 'Experience is shared among those still standing; treasure and the monsters\' money can be taken, shared or pooled.'],
]

const KEYS: Entries = [
  ['Exploring', 'Arrow keys or 8/4/6/2: move and turn · A area map · C or V the current character\'s sheet (cast spells there) · E encamp · S search · L look · Esc ☰ menu'],
  ['Menus', 'The highlighted letter, or 1–9, picks a choice; Enter or Space continues a "press Enter" prompt'],
  ['Combat', 'Arrows or the numeric keypad: step · Esc: undo steps · Space: take back characters on Quick · Alt-M: Magic On/Off'],
  ['Panels', 'Esc or ✕ closes'],
]

export const POR_RULES_TEXT: RulesText = { basics: POR_BASICS, classes: POR_CLASSES, combat: POR_COMBAT, keys: KEYS }

const replace = (list: Entries, key: string, v: [string, string] | null): Entries =>
  list.flatMap((e) => (e[0] === key ? (v ? [v] : []) : [e]))

export const COAB_RULES_TEXT: RulesText = {
  basics: [
    ...replace(POR_BASICS, 'Commissions and the journal', null),
    ['Level limits', 'Cleric 10, fighter 12, paladin 11, ranger 11, magic-user 11, thief 12; demi-humans lower in some classes.'],
  ],
  classes: [
    ...replace(replace(POR_CLASSES, 'Races', ['Races', 'Humans: any class, no level limits. Dwarves, elves, gnomes, half-elves and halflings: infravision, resistances, level limits in some classes (elves and half-elves as magic-users too). Half-elves may be rangers.']),
      'Multi-class', ['Multi-class', 'Demi-humans can be two or three classes at once (half-elves also cleric/ranger): experience is split between them, and they use the best of each.']),
    ['Paladin', 'A holy fighter: STR 12, INT 9, WIS 13, CON 9 and CHA 17 at least, lawful good only. Fights as a fighter (3 attacks per 2 rounds from level 7) and is protected from evil. Lays on hands once a day (2 hit points a level) and cures disease once a week, more often from levels 6 and 11 (both on the character sheet). Cleric spells from level 9, cast at level − 8. Will not join a party with an evil member, nor take one in.'],
    ['Ranger', 'A woodland fighter: STR 13, INT 13, WIS 14, CON 14 at least, good alignment. Fights as a fighter (3 attacks per 2 rounds from level 8) and adds the ranger level to damage against giant-class creatures. Druid spells from level 8 (cast at level − 7), magic-user spells from level 9 (level − 8). Three rangers at most in a party.'],
    ['Dual-class', 'A human may change class: the old class\'s abilities come back once the new class\'s level passes the old one.'],
  ],
  combat: POR_COMBAT,
  keys: KEYS,
}
