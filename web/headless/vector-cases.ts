// The cases of the test vectors (spec/D-appendices/test-vectors.md): what each vector feeds its procedure
// (headless/vectors.ts). The generator (headless/vectors-run.ts) runs each with a tape recorded from the
// reference generator seeded with `seed`, and writes the manifest; the manifest, not this file, is what a
// builder checks against. Inputs name record fields as part B does (records-and-tables.md §2).

export interface Case {
  id: string
  game: 'por' | 'coab'
  procedure: string
  input: Record<string, unknown>
  /** the reference generator's seed for the recorded tape (default 1) */
  seed?: number
}

/** A START.EXE table as the vectors and the address index give it: the span hashed, the entries in words. */
export interface TableSpan { table: string; from: number; length: number; entries: string }

const C: Case[] = []
const add = (game: Case['game'], procedure: string, cases: (Record<string, unknown> & { seed?: number })[], prefix: string) => {
  cases.forEach(({ seed, ...input }, i) => C.push({ id: `${prefix}-${game}-${i + 1}`, game, procedure, input, seed }))
}

// ---- the dice source (host-contracts.md §6)
add('por', 'tape.replay', [
  { draws: [[1, 20, 14], [2, 6, 7], [0, 6, 0], [1, 100, 63]], requests: [[1, 20], [2, 6], [0, 6], [1, 100]] },
  { draws: [[1, 20, 14], [2, 6, 7]], requests: [[1, 20], [1, 6]] },
  { draws: [[1, 20, 14]], requests: [[1, 20], [1, 4]] },
  { draws: [[2, 6, 13]], requests: [] },
  { draws: [[0, 6, 1]], requests: [] },
  { draws: [[1, 0, 0], [3, 1, 3]], requests: [[1, 0], [3, 1]] },
  { draws: [[1, 1, 0]], requests: [] },
], 'S-tape')
add('por', 'dice.random', [{ n: [1, 2, 6, 100, 256, 0, 0x7fff], seed: 3 }], 'S-random')

add('por', 'line.walk', [
  { from: [0, 0], to: [4, 2] }, { from: [4, 2], to: [0, 0] }, { from: [5, 5], to: [5, 0] }, { from: [5, 5], to: [9, 5] },
  { from: [2, 5], to: [12, 9] }, { from: [10, 10], to: [3, 13] }, { from: [0, 0], to: [6, 6] }, { from: [7, 3], to: [7, 3] },
], 'S-line')

// ---- hit points (procedures.md §2) on made-up hit-dice tables: count, sides, stop level by base class
const HD: [string, number, number[]][] = [['hitDiceCount', 0, [1, 1, 1, 1, 2, 1, 1, 2]], ['hitDiceSides', 0, [8, 8, 10, 10, 8, 4, 6, 4]]]
const STOP: [string, number, number[]] = ['hitDiceStop', 0, [10, 15, 10, 10, 11, 12, 11, 19]]
const lv = (o: Record<number, number>) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => o[k] ?? 0)
add('por', 'hitPoints', [
  { tables: HD, levels: lv({ 2: 1 }), classes: [2], seed: 1 },
  { tables: HD, levels: lv({ 2: 1 }), classes: [2], seed: 2 },
  { tables: HD, levels: lv({ 2: 5 }), classes: [2], seed: 3 },
  { tables: HD, levels: lv({ 0: 1, 2: 1, 5: 1 }), classes: [0, 2, 5], seed: 4 },
  { tables: HD, levels: lv({ 4: 1 }), classes: [4], seed: 5 },
], 'S-hp')
add('coab', 'hitPoints', [
  { tables: [...HD, STOP], levels: lv({ 2: 1 }), classes: [2], seed: 1 },
  { tables: [...HD, STOP], levels: lv({ 2: 5 }), classes: [2], seed: 2 },
  { tables: [...HD, STOP], levels: lv({ 4: 3 }), classes: [4], seed: 3 },
  { tables: [...HD, STOP], levels: lv({ 2: 10 }), classes: [2], seed: 4 },
  { tables: [...HD, STOP], levels: lv({ 0: 10, 2: 9 }), classes: [0, 2], seed: 5 },
  { tables: [...HD, STOP], levels: lv({ 0: 5, 2: 10 }), classes: [0, 2], seed: 6 },
], 'S-hp')

// ---- caster level (procedures.md §4)
add('por', 'casterLevel', [
  { record: { levels: lv({ 0: 5 }) }, spellClass: 0 },
  { record: { levels: lv({ 5: 3, 6: 4 }) }, spellClass: 1 },
  { record: { levels: lv({ 2: 7 }) }, spellClass: 0 },
  { record: { levels: lv({ 5: 3 }) }, spellClass: 2 },
  { record: { levels: lv({ 5: 8 }) }, spellClass: 1, fromItem: true },
  { record: { levels: lv({ 0: 4 }) }, spellClass: 2, fromItem: true },
], 'S-caster')
add('coab', 'casterLevel', [
  { record: { levels: lv({ 0: 5 }) }, spellClass: 0 },
  { record: { levels: lv({ 3: 10 }) }, spellClass: 0 },
  { record: { levels: lv({ 3: 8 }) }, spellClass: 0 },
  { record: { levels: lv({ 4: 9 }) }, spellClass: 1 },
  { record: { levels: lv({ 4: 9 }) }, spellClass: 2 },
  { record: { levels: lv({ 2: 9 }) }, spellClass: 2 },
  { record: { levels: lv({ 0: 3, 5: 7 }) }, spellClass: 2, fromItem: true },
  { record: { race: 7, levels: lv({ 2: 6 }), prevLevels: lv({ 0: 5 }), hpLevel: 5 }, spellClass: 0 },
  { record: { race: 7, levels: lv({ 0: 2 }), prevLevels: lv({ 5: 6 }), hpLevel: 1 }, spellClass: 2 },
  { record: { race: 7, levels: lv({ 0: 2 }), prevLevels: lv({ 5: 6 }), hpLevel: 2 }, spellClass: 2 },
], 'S-caster')

// ---- joining (procedures.md §8)
const pc = (name: string, o: Record<string, unknown> = {}) => ({ name, id: name.charCodeAt(0), morale: 0, alignment: 4, levels: lv({ 2: 1 }), ...o })
const six = ['A', 'B', 'C', 'D', 'E', 'F'].map((n) => pc(n))
add('por', 'join', [
  { party: [], candidate: pc('A') },
  { party: six, candidate: pc('G') },
  { party: six, candidate: pc('G', { morale: 0x90 }) },
  { party: [...six, pc('G', { morale: 0x90 }), pc('H', { morale: 0xb3 })], candidate: pc('I', { morale: 0x90 }) },
  { party: [pc('A'), pc('B')], candidate: pc('B') },
  { party: [pc('A'), pc('B')], candidate: pc('B', { id: 7 }) },
  { party: [pc('A', { alignment: 2 })], candidate: pc('B', { levels: lv({ 3: 1 }) }) },
], 'S-join')
add('coab', 'join', [
  { party: [pc('A', { alignment: 2 })], candidate: pc('B', { levels: lv({ 3: 1 }), alignment: 0 }) },
  { party: [pc('A', { levels: lv({ 4: 2 }) }), pc('B', { levels: lv({ 4: 2 }) }), pc('C', { levels: lv({ 4: 2 }) })], candidate: pc('D', { levels: lv({ 4: 1 }) }) },
  { party: [pc('A', { levels: lv({ 4: 2 }) }), pc('B', { levels: lv({ 4: 2 }) })], candidate: pc('D', { levels: lv({ 4: 1 }) }) },
  { party: [pc('A', { levels: lv({ 3: 2 }) }), pc('B'), pc('C', { levels: lv({ 3: 3 }) })], candidate: pc('D', { alignment: 8 }) },
  { party: [pc('A', { levels: lv({ 3: 2 }) })], candidate: pc('D', { alignment: 7 }) },
  { party: six, candidate: pc('G') },
  { party: [pc('A', { alignment: 5 }), pc('B', { levels: lv({ 4: 2 }) }), pc('C', { levels: lv({ 4: 2 }) }), pc('E', { levels: lv({ 4: 2 }) })], candidate: pc('D', { levels: lv({ 3: 1, 4: 1 }) }) },
], 'S-join')

add('por', 'strength.encoding', [{ values: [[3, 0], [17, 0], [18, 0], [18, 1], [18, 50], [18, 100], [19, 0], [25, 0]] }], 'S-str')
add('por', 'money.appraise', [{ kinds: [5, 5, 5, 5, 6, 6, 6, 6], seed: 11 }, { kinds: [6, 6, 6, 6, 6, 6, 5, 5], seed: 12 }], 'S-appraise')

// ---- battlefields (procedures.md §15.4)
add('por', 'battlefield.terrain', [{ read4AB3: 0 }, { read4AB3: 0xff }], 'S-terrain')
add('por', 'battlefield.wild', [0x00, 0x10, 0x48, 0x80].map((flags, i) => ({ flags, seed: 21 + i })), 'S-wild')
add('coab', 'battlefield.wild', [0x00, 0x10, 0x48, 0x80].map((flags, i) => ({ flags, seed: 31 + i })), 'S-wild')
/** a 3 × 3 room at x 7–9, y 7–9, with a door in its west wall at (7, 8), and a corridor north out of it */
const ROOM = {
  walls: [
    [7, 7, 0, 1], [8, 7, 0, 1], [9, 7, 3, 0], [7, 7, 3, 1], [7, 8, 3, 2], [7, 9, 3, 1], [9, 7, 1, 1], [9, 8, 1, 1], [9, 9, 1, 1],
    [7, 9, 2, 1], [8, 9, 2, 1], [9, 9, 2, 1], [8, 6, 1, 1], [8, 6, 3, 1], [8, 5, 1, 1], [8, 5, 3, 1],
    [6, 7, 1, 1], [6, 8, 1, 2], [6, 9, 1, 1], [7, 6, 2, 1], [9, 6, 2, 1], [10, 7, 3, 1], [10, 8, 3, 1], [10, 9, 3, 1], [7, 10, 0, 1], [8, 10, 0, 1], [9, 10, 0, 1],
  ],
  doors: [[7, 8, 3, 2], [6, 8, 1, 2]],
  events: [[8, 8, 0x80], [7, 7, 0x80], [9, 9, 0x80]],
}
const OPENMAP = { walls: [], doors: [], events: [] }
/** the same room with CotAB's furnishing flag (0x40) in its corner squares' event bytes */
const ROOM_FURNISHED = { ...ROOM, events: [[7, 7, 0x40], [9, 7, 0x40], [9, 9, 0x40], [7, 9, 0x40], [8, 8, 0x40]] }
add('por', 'battlefield.map', [
  { map: ROOM, x: 8, y: 8, area: 1, seed: 41 },
  { map: ROOM, x: 4, y: 8, area: 10, seed: 42 },
  { map: OPENMAP, x: 0, y: 0, area: 3, seed: 43 },
], 'S-mapfield')
add('coab', 'battlefield.furnished', [
  { map: ROOM_FURNISHED, x: 8, y: 8, area: 1, seed: 51 },
  { map: ROOM_FURNISHED, x: 9, y: 9, area: 1, seed: 52 },
  { map: OPENMAP, x: 15, y: 15, area: 0, seed: 53 },
], 'E-mapfield')

// ---- derived statistics: slots, saves, thief skills, THAC0 (procedures.md §1, §5, §6)
const st = (s: number, i: number, w: number, d: number, c: number, ch: number) => [s, i, w, d, c, ch]
add('por', 'derive', [
  { record: { race: 7, cls: 0, levels: lv({ 0: 5 }), stat: st(12, 10, 17, 10, 10, 10) } },
  { record: { race: 7, cls: 0, levels: lv({ 0: 1 }), stat: st(12, 10, 18, 10, 10, 10) } },
  { record: { race: 7, cls: 5, levels: lv({ 5: 6 }), stat: st(10, 17, 10, 10, 10, 10) } },
  { record: { race: 5, cls: 6, levels: lv({ 6: 4 }), stat: st(10, 10, 10, 17, 10, 10) } },
  { record: { race: 1, cls: 6, levels: lv({ 6: 1 }), stat: st(10, 10, 10, 9, 10, 10) } },
  { record: { race: 7, cls: 2, levels: lv({ 2: 7 }), stat: st(17, 10, 10, 10, 10, 10) } },
  { record: { race: 4, cls: 9, levels: lv({ 0: 3, 2: 3, 5: 3 }), stat: st(15, 15, 15, 10, 10, 10) } },
  { record: { race: 2, cls: 15, levels: lv({ 2: 2, 5: 3, 6: 4 }), stat: st(15, 15, 10, 16, 10, 10) } },
], 'E-derive')
add('coab', 'derive', [
  { record: { race: 7, cls: 0, levels: lv({ 0: 10 }), stat: st(12, 10, 18, 10, 10, 10) } },
  { record: { race: 7, cls: 3, levels: lv({ 3: 10 }), stat: st(17, 10, 14, 10, 15, 17) } },
  { record: { race: 7, cls: 4, levels: lv({ 4: 9 }), stat: st(16, 14, 14, 10, 15, 10) } },
  { record: { race: 1, cls: 2, levels: lv({ 2: 5 }), stat: st(17, 10, 10, 10, 17, 10) } },
  { record: { race: 5, cls: 6, levels: lv({ 6: 6 }), stat: st(10, 10, 10, 17, 10, 10) } },
  { record: { race: 7, cls: 5, levels: lv({ 5: 11 }), stat: st(10, 18, 10, 10, 19, 10) } },
  { record: { race: 7, cls: 2, levels: lv({ 2: 6 }), prevLevels: lv({ 6: 5 }), hpLevel: 5, stat: st(15, 10, 10, 16, 10, 10) } },
  { record: { race: 4, cls: 10, levels: lv({ 0: 6, 4: 6 }), stat: st(14, 13, 14, 10, 14, 10) } },
], 'E-derive')

// ---- creation and training (chargen-and-progression.md, procedures.md §2, §3)
add('por', 'creation', [
  { race: 7, gender: 0, cls: 2, alignment: 0, seed: 61 },
  { race: 7, gender: 1, cls: 0, alignment: 4, seed: 62 },
  { race: 2, gender: 1, cls: 15, alignment: 7, seed: 63 },
  { race: 1, gender: 0, cls: 14, alignment: 3, seed: 64 },
  { race: 4, gender: 0, cls: 9, alignment: 0, seed: 65 },
  { race: 5, gender: 1, cls: 6, alignment: 8, seed: 66 },
], 'E-creation')
add('coab', 'creation', [
  { race: 7, gender: 0, cls: 3, alignment: 0, seed: 71 },
  { race: 4, gender: 1, cls: 4, alignment: 3, seed: 72 },
  { race: 7, gender: 1, cls: 0, alignment: 4, seed: 73 },
  { race: 2, gender: 0, cls: 13, alignment: 5, seed: 74 },
  { race: 1, gender: 0, cls: 2, alignment: 1, seed: 75 },
], 'E-creation')
const fighter = (L: number, extra: Record<string, unknown> = {}) => ({ race: 7, cls: 2, levels: lv({ 2: L }), stat: st(16, 10, 10, 10, 16, 10), hp: 20, maxHp: 30, hpRolled: 28, ...extra })
add('por', 'training', [
  { record: fighter(1), classes: [2], seed: 81 },
  { record: fighter(4), classes: [2], seed: 82 },
  { record: { race: 4, cls: 8, levels: lv({ 0: 2, 2: 2 }), stat: st(14, 10, 14, 10, 17, 10), hp: 12, maxHp: 12, hpRolled: 11 }, classes: [0, 2], seed: 83 },
  { record: { race: 7, cls: 5, levels: lv({ 5: 1 }), stat: st(10, 17, 10, 10, 6, 10), hp: 3, maxHp: 4, hpRolled: 4 }, classes: [5], seed: 84 },
], 'E-training')
add('coab', 'training', [
  { record: fighter(1), classes: [2], seed: 91 },
  { record: fighter(9), classes: [2], seed: 92 },
  { record: { race: 7, cls: 4, levels: lv({ 4: 7 }), stat: st(16, 14, 14, 10, 15, 10), hp: 40, maxHp: 50, hpRolled: 48 }, classes: [4], seed: 93 },
  { record: { race: 7, cls: 3, levels: lv({ 3: 8 }), stat: st(17, 10, 14, 10, 15, 17), hp: 50, maxHp: 50, hpRolled: 45 }, classes: [3], seed: 94 },
], 'E-training')

// ---- dual-classing (procedures.md §11; CotAB 0x5135D): a human fighter to cleric, a magic-user to
// fighter (prime abilities 15 and 17, the alignment the new class allows), and one who does not qualify
const human = (cls: number, L: number, stat: number[], alignment: number) => ({ race: 7, cls, levels: lv({ [cls]: L }), stat, baseStat: stat, alignment, xp: 70000, hp: 50, maxHp: 50, hpRolled: 44 })
add('coab', 'dualclass', [
  { record: human(2, 7, st(16, 10, 17, 12, 14, 10), 0), to: 0 },
  { record: human(5, 6, st(17, 15, 10, 14, 12, 10), 4), to: 2 },
  { record: human(2, 5, st(14, 10, 17, 12, 14, 10), 0), to: 0 },
  { record: human(0, 4, st(17, 10, 16, 17, 12, 10), 4), to: 6 },
], 'E-dualclass')

// ---- money (town.md "Money")
const MONEY = [[1, 0, 0, 0, 0, 0, 0], [0, 1, 0, 0, 0, 0, 0], [0, 0, 1, 0, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0], [0, 0, 0, 0, 1, 0, 0], [99, 0, 0, 0, 0, 0, 0], [100, 0, 0, 0, 0, 0, 0], [123, 45, 67, 89, 10, 5, 5], [65535, 65535, 65535, 65535, 65535, 0, 0]]
add('por', 'money.coinValue', [{ money: MONEY }], 'E-coins')
add('coab', 'money.coinValue', [{ money: MONEY }], 'E-coins')
const sharers = [
  { name: 'A', morale: 0, stat: st(18, 10, 10, 10, 10, 10), strPct: 100, money: [0, 0, 0, 10, 0, 0, 0] },
  { name: 'B', morale: 0, stat: st(3, 10, 10, 10, 10, 10), money: [0, 0, 0, 0, 0, 0, 0] },
  { name: 'C', morale: 0xb3, stat: st(12, 10, 10, 10, 10, 10), money: [0, 0, 0, 0, 0, 0, 0] },
  { name: 'D', morale: 0x90, stat: st(12, 10, 10, 10, 10, 10), money: [0, 0, 0, 0, 0, 0, 0] },
  { name: 'E', morale: 0, stat: st(12, 10, 10, 10, 10, 10), money: [0, 0, 0, 0, 0, 0, 0] },
]
add('por', 'money.share', [{ party: sharers, pool: [100, 7, 0, 33, 5, 2, 1] }, { party: sharers, pool: [5000, 3000, 2000, 2500, 1000, 13, 4] }], 'E-share')
add('coab', 'money.share', [{ party: sharers, pool: [100, 7, 0, 33, 5, 2, 1] }], 'E-share')

// ---- battles on a made-up field (procedures.md §15): fighters A, B, C … in order; saves 30 never save
const never = [30, 30, 30, 30, 30], always = [1, 1, 1, 1, 1]
const BOLT = 51, STINK = 34, KILL = 91
add('por', 'combat.spell', [
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 5, y: 5, side: 1, saves: never }], walls: [[9, 5]], spells: [{ caster: 0, id: BOLT, level: 5, aim: [5, 5] }], seed: 101 },
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 5, y: 5, side: 1, saves: never }, { x: 8, y: 5, side: 1, saves: always }, { x: 11, y: 5, side: 1 }], spells: [{ caster: 0, id: BOLT, level: 5, aim: [5, 5] }], seed: 102 },
  { fighters: [{ x: 2, y: 2, side: 0 }, { x: 6, y: 6, side: 1, saves: never }, { x: 9, y: 9, side: 1 }], spells: [{ caster: 0, id: BOLT, level: 7, aim: [6, 6] }], seed: 103 },
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 6, y: 6, side: 1, saves: never }, { x: 5, y: 6, side: 1, saves: always }], walls: [[5, 5]], spells: [{ caster: 0, id: STINK, level: 4, aim: [5, 5] }], seed: 104 },
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 2, y: 9, side: 0 }, { x: 11, y: 11, side: 1 }], spells: [{ caster: 0, id: STINK, level: 3, aim: [10, 10] }, { caster: 0, id: STINK, level: 3, aim: [11, 10] }, { caster: 1, id: STINK, level: 3, aim: [20, 10] }, { caster: 0, id: STINK, level: 3, aim: [30, 10] }], seed: 105 },
], 'E-spell')
add('coab', 'combat.spell', [
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 5, y: 5, side: 1, saves: never }], walls: [[9, 5]], spells: [{ caster: 0, id: BOLT, level: 5, aim: [5, 5] }], seed: 111 },
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 5, y: 5, side: 1, saves: never }, { x: 8, y: 5, side: 1, saves: always }, { x: 11, y: 5, side: 1 }], spells: [{ caster: 0, id: BOLT, level: 5, aim: [5, 5] }], seed: 112 },
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 6, y: 6, side: 1, saves: never }, { x: 5, y: 6, side: 1, saves: always }], walls: [[5, 5]], spells: [{ caster: 0, id: STINK, level: 4, aim: [5, 5] }], seed: 113 },
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 10, y: 10, side: 1, saves: never, hp: 8 }, { x: 11, y: 11, side: 1, saves: never, hp: 40 }], spells: [{ caster: 0, id: KILL, level: 9, aim: [10, 10] }], seed: 114 },
  { fighters: [{ x: 2, y: 5, side: 0 }, { x: 11, y: 10, side: 1, saves: never }], spells: [{ caster: 0, id: STINK, level: 4, aim: [10, 10] }, { caster: 0, id: KILL, level: 9, aim: [10, 10] }], seed: 115 },
], 'E-spell')
const duel = [{ x: 4, y: 4, side: 0, thac0: 45, attacks: 2, dice: [1, 8, 2] }, { x: 5, y: 4, side: 1, ac: 55, hp: 30 }]
add('por', 'combat.attack', [{ fighters: duel, attacks: [[0, 1]], seed: 121 }, { fighters: duel, attacks: [[0, 1], [1, 0], [0, 1]], seed: 122 }], 'E-attack')
add('coab', 'combat.attack', [{ fighters: duel, attacks: [[0, 1]], seed: 131 }, { fighters: duel, attacks: [[0, 1], [1, 0], [0, 1]], seed: 132 }], 'E-attack')
const savers = [{ x: 1, y: 1, side: 0, saves: [10, 13, 14, 16, 15] }, { x: 3, y: 1, side: 1, saves: [14, 15, 16, 17, 17] }]
const SAVES = [[0, 0, 0], [0, 4, 0], [1, 3, 2], [1, 4, -3], [0, 1, 0], [1, 2, 5], [0, 3, 0], [1, 0, 0]]
add('por', 'combat.save', [{ fighters: savers, saves: SAVES, seed: 141 }], 'E-save')
add('coab', 'combat.save', [{ fighters: savers, saves: SAVES, seed: 151 }], 'E-save')

// ---- the player's files (outputs hashed)
add('por', 'treasure.random', [1, 3, 6, 10].map((items, i) => ({ items, seed: 161 + i })), 'F-treasure')
add('coab', 'treasure.random', [1, 3, 6, 10].map((items, i) => ({ items, seed: 171 + i })), 'F-treasure')
add('por', 'battlefield.area', [
  { geo: 'GEO2.DAX', record: 20, x: 8, y: 8, area: 20, seed: 181 },
  { geo: 'GEO1.DAX', record: 18, x: 3, y: 12, area: 18, seed: 182 },
  { geo: 'GEO3.DAX', record: 0, x: 15, y: 0, area: 0, seed: 183 },
], 'F-area')
add('coab', 'battlefield.area', [
  { geo: 'GEO2.DAX', record: 1, x: 8, y: 8, area: 1, seed: 191 },
  { geo: 'GEO3.DAX', record: 16, x: 5, y: 10, area: 16, seed: 192 },
  { geo: 'GEO4.DAX', record: 32, x: 0, y: 15, area: 32, seed: 193 },
], 'F-area')
const quick = (n: number) => [...Array(6).fill('QUICK'), ...Array(n).fill(true), false]
add('por', 'headless.run', [
  { script: { game: 'por', commands: ['f', 'l', 'f', 'r', 'f', 'b', 's', 'L'], answers: ['FLEE', ...quick(20)] }, seed: 201 },
  { script: { game: 'por', jump: [1, 18, 8, 8, 0], commands: ['f', 'f', 'r', 'f', 'f', 'l', 'f'], answers: [0, 0, 0, 0] }, seed: 202 },
  { script: { game: 'por', commands: ['f', 'l', 'f', 'monsters 13 3 4', 'combat'], answers: quick(30) }, seed: 203 },
  { script: { game: 'por', commands: ['monsters 13 6 4', 'combat'], answers: quick(30) }, seed: 204 },
], 'F-run')
add('coab', 'headless.run', [
  { script: { game: 'coab', commands: ['l', 'l', 'f', 'f', 'r', 'f', 'f', 'l', 'f', 's', 'L'], answers: [0, 0, 0, 0, 0, 0] }, seed: 211 },
  { script: { game: 'coab', jump: [3, 16, 8, 8, 0], commands: ['f', 'f', 'r', 'f', 'f', 'l', 'f'], answers: [0, 0, ...quick(30)] }, seed: 212 },
  { script: { game: 'coab', commands: ['monsters 3 3 1', 'combat'], answers: [0, 0, ...quick(40)] }, seed: 213 },
], 'F-run')
for (const game of ['por', 'coab'] as const) {
  const sounds: Record<string, unknown>[] = []
  for (let effect = 1; effect <= 21; effect++) for (const device of ['pc', 'tandy']) sounds.push({ effect, device })
  if (game === 'por') for (const effect of [7, 9, 10]) sounds.push({ effect, device: 'pc', cut: 20 })
  add(game, 'sound.driver', sounds, 'F-sound')
}
add('por', 'decode.image', [{ merged: false }, { merged: true }], 'F-image')
add('coab', 'decode.image', [{ merged: false }, { merged: true }], 'F-image')

export const CASES = C

/**
 * The START.EXE tables by name (records-and-tables.md §3.2): for each game the bytes the hashes cover,
 * from the table's `at` (`from` bytes on, `length` bytes; 0: from the game's rules, see `spanOf`), and the
 * entries in words. Absent tables have no row for the game.
 */
export const TABLES: Record<'por' | 'coab', TableSpan[]> = { por: [], coab: [] }
const tb = (table: string, por: [number, number, string] | null, coab: [number, number, string] | null) => {
  if (por) TABLES.por.push({ table, from: por[0], length: por[1], entries: por[2] })
  if (coab) TABLES.coab.push({ table, from: coab[0], length: coab[1], entries: coab[2] })
}
const both = (table: string, from: number, length: number, entries: string) => tb(table, [from, length, entries], [from, length, entries])
both('classBits', 0, 8, '8 base classes')
both('trainerBits', 0, 8, '8 base classes')
both('hitDiceCount', 0, 8, '8 base classes')
both('hitDiceSides', 0, 8, '8 base classes')
tb('hitDiceStop', null, [0, 8, '8 base classes'])
tb('npcHeads', [1, 16, '2 genders × 8, from 1'], null)
for (const k of ['npcBodiesCleric', 'npcBodiesFighter', 'npcBodiesMagicUser', 'npcBodiesThief']) tb(k, [1, 10, '2 genders × 5, from 1'], null)
both('raceNames', 0, 80, '8 races × 10')
both('classNames', 0, 459, '17 class ids × 27')
both('alignmentNames', 0, 153, '9 × 17')
both('statusNames', 0, 117, '9 × 13')
both('genderNames', 0, 14, '2 × 7')
both('coinNames', 0, 77, '7 × 11')
both('coinValues', 0, 20, '5 × u32')
for (const k of ['frameTop', 'frameBottom', 'frameDivider']) tb(k, null, [0, 40, '40 columns'])
for (const k of ['frameLeft', 'frameRight']) tb(k, null, [0, 24, '24 rows'])
for (const k of ['cursorX', 'cursorY']) tb(k, null, [0, 33, '33 places'])
tb('placeTerrain', null, [0, 33, '33 places (I)'])
both('templeNames', 0, 0, 'services and Exit × 41')
both('diseases', 1, 6, '6, from 1')
tb('randomItems', [2, 19 * 16, '19 records × 8 u16, word m = 8j + 1'], [2, 7 * 16, '7 records × 8 u16, word m = 8j + 1'])
both('sky', 0, 16, '16')
both('itemWords', 0, 255 * 21, '255 words × 21, from word 1')
both('wallDx', 0, 9, '9 directions')
both('wallDy', 0, 9, '9 directions')
both('viewPieces', 0, 70, '10 kinds × (3 bytes + 2 words)')
both('battleCells', 0, 0x42 * 4, '0x42 cells × 4')
tb('headRecords', [1, 14, 'heads 1–14'], null)
tb('bodyRecords', [1, 12, 'bodies 1–12'], null)
both('spellNames', 0, 0, 'named spells × 41, from spell 1')
both('spellRecords', 16, 0, 'spell records × 16, from spell 1')
tb('overlandMap', [0, 44 * 36, '44 × 36 tiles'], null)
tb('overlandSpecials', [0, 54, '9 × 6'], null)
tb('overlandColumns', [0, 5, '5'], null)
tb('thac0', [0, 8 * 11, '8 classes × 11 (levels 1–10)'], [0, 8 * 13, '8 classes × 13 (levels 1–12)'])
tb('thiefBase', [9, 72, 'levels 1–9 × 8 skills'], [9, 96, 'levels 1–12 × 8 skills'])
both('thiefRace', 1, 64, '8 races × 8 skills')
both('thiefDex', 1, 130, 'DEX 0–25 × 5 skills')
both('raceLimits', 0, 128, '8 races × 16')
tb('raceClasses', [0, 8 * 12, '8 races × 12'], [0, 8 * 14, '8 races × 14'])
both('startAge', 0, 8 * 28, '8 races × 7 columns × 4')
both('ageing', 0, 80, '8 races × 5 u16')
both('classMins', 0, 17 * 6, '17 class ids × 6')
both('alignments', 0, 17 * 10, '17 class ids × 10')
both('conHp', 0, 26, 'CON 0–25')
tb('xp', [0, 8 * 0x38, '8 classes × 14 levels × u32'], [0, 8 * 0x63, '8 classes × 0x63 (13 levels × u32 read)'])
tb('clericSlots', [4, 27, 'levels 1–9 × 3'], [6, 55, 'levels 1–11 × 5'])
tb('muSlots', [4, 27, 'levels 1–9 × 3'], [6, 55, 'levels 1–11 × 5'])
tb('paladinSlots', null, [46, 15, 'levels 9–11 × 5'])
tb('rangerSlots', null, [41, 20, 'levels 8–11 × 5'])
both('startGold', 0, 16, '8 base classes × 2')
tb('saves', [0, 8 * 45, '8 classes × 45 (levels 0–8 × 5)'], [5, 8 * 60, '8 classes × 60 (levels 1–12 × 5)'])
for (const k of ['fanDx1', 'fanDy1', 'fanDx2', 'fanDy2']) tb(k, null, [0, 8, '8 directions'])
both('gasCloud', 1, 4, '4 squares, from 1')
tb('killCloud', null, [1, 9, '9 squares, from 1'])
for (const k of ['furnishDx', 'furnishDy']) tb(k, null, [1, 4, '4 sides, from 1'])

/** A table's span with the lengths the game's rules give (temple services, spells) filled in. */
export function spanOf(t: TableSpan, rules: { temple: unknown[]; spells: { named: number; records: number } }): TableSpan {
  if (t.length) return t
  if (t.table === 'templeNames') return { ...t, length: (rules.temple.length + 1) * 41, entries: `${rules.temple.length + 1} × 41 (the services, then Exit)` }
  if (t.table === 'spellNames') return { ...t, length: rules.spells.named * 41, entries: `${rules.spells.named} named spells × 41, from spell 1` }
  if (t.table === 'spellRecords') return { ...t, length: rules.spells.records * 16, entries: `${rules.spells.records} spell records × 16, from spell 1` }
  return t
}
