// Each game's start-up menu and its demo ("attract mode"), as data (docs/multi-game.md). The menu's
// title and choices are strings in START.EXE, read at run time by offset (nothing of the game's text
// is stored here). CotAB: spec/A-games/coab/ecl.md, "Start-up menu and demo"; Pool of Radiance has neither
// (no "Demo" in its START.EXE or GAME.OVR): its profile holds null and it starts with the party screen.

/**
 * The demo mode: one script's on_enter run with a party of the script's own NPCs, after which every
 * member leaves and the start-up menu comes back; no moving, camping or saving (CotAB 0x1C069–0x1C084,
 * Engine.runDemo). The original's other behaviours in that mode are flags, each with the code that
 * tests the mode flag (CotAB DS:4FD5).
 */
export interface DemoMode {
  /** the demo's script: ECL block and record (CotAB 1 and 82: 0x1FD sets DS:5C08 = 1, 0x1C001 record 0x52) */
  block: number
  record: number
  /** the game speed the demo runs at (CotAB DS:4FC2 = 9, 0x202: the slowest) */
  speed: number
  /** key reads take a key that is waiting but never wait for one (CotAB 0x6819; the text input stops
   *  after one read, 0x5514) */
  keysWait: boolean
  /** "Continue Battle:" is asked when the enemy side is gone (CotAB 0x227EF: not in the demo) */
  continueBattle: boolean
  /** after a battle: outcome, experience, NPC shares and treasure (CotAB 0x1EE98, 0x1EEAC, 0x1EF4E:
   *  in the demo only the monsters leave the list) */
  aftermath: boolean
  /** ADD_NPC's combat picture (CPIC) for these monster ids in the demo, [id, picture] (SotSB 0x4181F–0x41841:
   *  0x32 → 0x4D, 0x33 → 0x4C, 0x34 → 0x42 while DS:67E9 is set; the record keeps its id); CotAB none (0x3596E) */
  npcPictures: [number, number][]
}

/** A menu after the title sequence: Play goes to the game, the demo key runs the demo. */
export interface StartMenu {
  /** offsets in START.EXE's load image of two Pascal strings: the menu's title, and its choices (the
   *  words of one string; each word's capital letter is its key, CotAB 0x5194A, 0x51F18) */
  title: number
  choices: number
  /** the menu answers `timeoutKey` itself when no key comes in this long, in hundredths of a second
   *  (the DOS clock, CotAB 0x5668): `first` after the title sequence, `again` after a demo */
  timeout: { first: number; again: number }
  timeoutKey: string
  /** the answer that runs the demo; any other (Play, Enter on Play, Escape) starts the game */
  demoKey: string
  /** the title sequence runs again after a demo, before the menu (CotAB 0x2C7) */
  titleAgain: boolean
  demo: DemoMode
}

// image 0x17F–0x352: the menu after the title with DS:72B0 = 3000 and DS:72B4 = 'D' (0x17F–0x18B), the
// answer D sets DS:4FD5 (0x1C3); after a demo the title again (0x2C7), the keys flushed (0x6952) and the
// menu with DS:72B0 = 1000 (0x2D1). Both calls are `lcall 0x104:0x2A` (0x51C48) with the strings at
// CS:0006 and CS:0025 of the main segment (image paragraph 0).
export const COAB_STARTUP: StartMenu = {
  title: 0x06,
  choices: 0x25,
  timeout: { first: 3000, again: 1000 },
  timeoutKey: 'D',
  demoKey: 'D',
  titleAgain: true,
  demo: {
    block: 1, record: 82, speed: 9,
    keysWait: false, continueBattle: false, aftermath: false, npcPictures: [],
  },
}

// spec/A-games/sotsb/assets.md §4 and ecl.md "Start-up and new game": the menu "Play Demo" (image 0x64) under the
// game's name (0x05) with a 3 000-hundredths timeout answering D (DS:8A63, DS:8A67); the demo at block 1 record 3
// (0x21934). The timeout after a demo, the title again and the demo's flags are taken to be CotAB's (I)
export const SOTSB_STARTUP: StartMenu = {
  title: 0x05,
  choices: 0x64,
  timeout: { first: 3000, again: 1000 },
  timeoutKey: 'D',
  demoKey: 'D',
  titleAgain: true,
  demo: {
    block: 1, record: 3, speed: 9,
    keysWait: false, continueBattle: false, aftermath: false,
    npcPictures: [[0x32, 0x4d], [0x33, 0x4c], [0x34, 0x42]], // the demo's NPCs, whose own pictures CPIC1 lacks
  },
}

/** A Pascal string (length byte, then the characters) at offset `at`; null past the end. */
function pascal(img: Uint8Array, at: number): string | null {
  const n = img[at]
  if (n === undefined || at + 1 + n > img.length) return null
  return String.fromCharCode(...img.subarray(at + 1, at + 1 + n))
}

export interface MenuText {
  title: string
  choices: { label: string; key: string }[]
}

/** The menu's title and choices from START.EXE's load image (null when the strings are not there). */
export function startMenuText(img: Uint8Array | null, m: StartMenu): MenuText | null {
  if (!img) return null
  const title = pascal(img, m.title), list = pascal(img, m.choices)
  if (title === null || list === null) return null
  // 0x5194A: a choice is a run of letters and digits; its key is its capital letter
  const choices = (list.match(/[A-Za-z0-9]+/g) ?? []).map((w) => ({ label: w, key: (w.match(/[A-Z]/)?.[0] ?? w[0]).toUpperCase() }))
  return choices.length ? { title: title.trim(), choices } : null
}
