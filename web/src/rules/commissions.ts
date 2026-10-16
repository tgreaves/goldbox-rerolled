// Commissions panel (IMPROVEMENTS.md IMP-023), read from the ECL variables the scripts keep
// (spec/commissions.md). The original has no quest log: only the City Clerk reports on these.

/** Commission table entry i is ECL 0x4AA6 + i: 254 finished and reward due, 255 closed. */
const TABLE = 0x4aa6
const DUE = 254
const CLOSED = 255

export interface Commission {
  id: string
  title: string
  /** start of the clerk's offer text (or another script's), which marks it as known */
  offers: string[]
  /** commission table entries whose rewards belong to it */
  entries: number[]
  /** a summons variable: 254 = go and see someone, 255 = briefed */
  summons?: { addr: number; who: string }
  /** other signs it is under way, e.g. a variable an offer sets */
  started?: (read: Read) => boolean
}

type Read = (addr: number) => number

export const COMMISSIONS: Commission[] = [
  { id: 'slums', title: 'Clear the slums west of City Hall', offers: ['THE SLUMS IMMEDIATELY TO OUR WEST'], entries: [21] },
  { id: 'sokal', title: 'Clear Sokal Keep on Thorn Island', offers: ['SOKAL KEEP ON THORN ISLAND'], entries: [1] },
  { id: 'documents', title: 'Bring in books, maps and records of old Phlan', offers: ['THE COUNCIL IS OFFERING A REWARD FOR BOOKS'], entries: [4, 5, 6, 7, 8, 9] },
  { id: 'podal', title: 'Find out what weapon is being auctioned in Podal Plaza', offers: ['A WEAPON OF GREAT POWER IS TO BE AUCTIONED'], entries: [10],
    started: (r) => r(0x4ab0) === 1 },
  { id: 'textile', title: "Cadorna's family treasure in the textile house", offers: ['JUNIOR COUNCILMAN CADORNA HAS A SPECIAL COMMISSION'], entries: [18],
    summons: { addr: 0x4a97, who: 'Junior Councilman Cadorna (east door of the clerk)' } },
  { id: 'braccio', title: 'Report to Bishop Braccio at the Temple of Tyr', offers: ['YOU ARE SUMMONED BY THE BISHOP'], entries: [23],
    summons: { addr: 0x4a9b, who: "Bishop Braccio at Tyr's temple" } },
  { id: 'kovel', title: 'Clean out the thieves in Kovel Mansion', offers: ['A LARGE GROUP OF THIEVES OPERATES'], entries: [12] },
  { id: 'nomads', title: 'Stop the nomads joining the enemy', offers: ['FIND THE NOMADS'], entries: [17] },
  { id: 'kobolds', title: 'Stop the kobold tribe joining the enemy', offers: ['A LARGE TRIBE OF KOBOLDS'], entries: [16] },
  { id: 'river', title: "End the river's pollution", offers: ["FIND THE SOURCE OF THE RIVER'S POLLUTION"], entries: [13] },
  { id: 'lizardmen', title: 'Stop the lizardmen joining the enemy', offers: ['A TRIBE OF LIZARDMEN'], entries: [15] },
  { id: 'bivant', title: 'Rescue the heir of House Bivant', offers: ['THE HEIR TO THE HOUSE OF BIVANT'], entries: [3],
    started: (r) => r(0x4a8c) === CLOSED },
  { id: 'graveyard', title: 'End the Valhingen Graveyard menace', offers: ['I HAVE BEEN AUTHORIZED TO GIVE YOU AN ENCHANTED WEAPON'], entries: [11],
    started: (r) => r(0x4a96) === CLOSED },
  { id: 'zhentil', title: "Deliver Cadorna's message to Zhentil Keep", offers: ['LORD CADORNA HAS A DELICATE DIPLOMATIC MISSION', 'WE NEED YOU TO DELIVER A MESSAGE TO THE ZHENTIL KEEP'], entries: [14],
    summons: { addr: 0x4a98, who: 'Lord Cadorna (south door of the clerk)' } },
  { id: 'gate', title: 'Take the gate and hold it', offers: ['LORD URSLINGEN WISHES URGENTLY'], entries: [19],
    summons: { addr: 0x4a99, who: "Lord Urslingen (south door of Cadorna's old quarters)" } },
  { id: 'assault', title: 'Lead the attack on the enemy stronghold', offers: ['YOU ARE SUMMONED TO A SPECIAL COUNCIL MEETING'], entries: [20],
    summons: { addr: 0x4a9a, who: 'the council (the city guards show the way)' } },
]

/** Rewards that are not offered as commissions; listed once earned. */
const DEEDS: { entry: number; title: string }[] = [
  { entry: 0, title: 'Norris the Gray eliminated' },
  { entry: 2, title: 'The area next to the evil temple cleared' },
  { entry: 24, title: 'Cadorna exposed as a traitor' },
  { entry: 25, title: 'The traitor Cadorna dead' },
]

const PROCLAMATIONS = ['LXIV, LXXVIII, CIX and LIX', 'CI', 'CXXVI and CX', 'CXXXIV', 'CLIV', 'CXIV', 'CCIV', 'CXXIX', 'CCI', 'CXIV']
export const PROCLAMATION_WALL = 'PROCLAMATIONS ARE POSTED ON THE WALLS'

export type State = 'reward' | 'summoned' | 'open' | 'failed' | 'closed'
export interface Line { title: string; state: State; detail?: string }

/** Ids of anything a printed text reveals: a commission offer, or the proclamation wall. */
export function revealedBy(text: string): string[] {
  const t = text.trimStart().replace(/^'/, '')
  const ids = COMMISSIONS.filter((c) => c.offers.some((o) => t.startsWith(o))).map((c) => c.id)
  if (t.startsWith(PROCLAMATION_WALL)) ids.push('proclamations')
  return ids
}

export function report(read: Read, known: ReadonlySet<string>): { lines: Line[]; proclamations?: string; bounty: number } {
  const entry = (i: number) => read(TABLE + i)
  const lines: Line[] = []
  for (const c of COMMISSIONS) {
    const vals = c.entries.map(entry)
    const s = c.summons ? read(c.summons.addr) : 0
    // offered (seen this session or saved with a browser save), or under way in the game's own variables
    const seen = known.has(c.id) || vals.some((v) => v !== 0) || s !== 0 || (c.started?.(read) ?? false)
    if (!seen) continue
    if (vals.some((v) => v === DUE)) lines.push({ title: c.title, state: 'reward', detail: 'Reward waiting: see the City Clerk' })
    else if (c.id === 'bivant' && entry(3) === 128) lines.push({ title: c.title, state: 'failed', detail: 'The rescue was bungled' })
    else if (c.summons && s === DUE) lines.push({ title: c.title, state: 'summoned', detail: `Go and see ${c.summons.who}` })
    else if (c.id === 'documents' ? read(0x4ac2) === CLOSED : vals.every((v) => v === CLOSED)) lines.push({ title: c.title, state: 'closed' })
    else lines.push({ title: c.title, state: 'open' })
  }
  for (const d of DEEDS) {
    const v = entry(d.entry)
    if (v === DUE) lines.push({ title: d.title, state: 'reward', detail: 'Reward waiting: see the City Clerk' })
    else if (v === CLOSED) lines.push({ title: d.title, state: 'closed' })
  }
  // clearing bounties paid once by the clerk (spec/commissions.md, clerk's visit step 3)
  if ((read(0x4a31) & 96) === 96 && read(0x4ac2) !== CLOSED) lines.push({ title: 'The library cleared', state: 'reward', detail: 'Reward waiting: see the City Clerk' })
  if (read(0x4ae7) === DUE) lines.push({ title: 'Podal Plaza cleared', state: 'reward', detail: 'Reward waiting: see the City Clerk' })
  if (read(0x4ae6) === DUE) lines.push({ title: 'The Cadorna textile house cleared', state: 'reward', detail: 'Reward waiting: see the City Clerk' })
  // graveyard bounty: kills of 7 undead types against kills already paid for
  let bounty = 0
  for (let i = 0; i < 7; i++) bounty += Math.max(0, read(0x4a39 + i) - read(0x4a8f + i))
  const order: State[] = ['reward', 'summoned', 'open', 'failed', 'closed']
  lines.sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))
  const p = read(0x4ac1)
  return { lines, bounty, proclamations: known.has('proclamations') && p < PROCLAMATIONS.length ? PROCLAMATIONS[p] : undefined }
}
