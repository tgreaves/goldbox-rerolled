// What the area map's landmarks (IMP-024, rules/landmarks.ts) look for in a game's script text: the
// shopkeepers' lines that tell shops apart, the temple's god, and places named in their text. The
// script structure they hang on (the shop and temple flags, PROGRAM 0 training and 9 rest) is the
// engine's and the same in both games.

export interface TextMark { re: RegExp; kind: 'shop' | 'store' | 'jeweller' | 'armoury' | 'silver' | 'tavern' | 'hall' | 'harbour' | 'gate'; label: string }

export interface LandmarkRules {
  /** a place named in its square's text, checked first */
  first: TextMark[]
  /** a shop told apart by its shopkeeper's line (else 'Shop') */
  shops: TextMark[]
  /** the temple's god, from its priests' line (group 1) */
  god: RegExp
  /** places named in their text, checked after shops, temples, training and inns */
  places: TextMark[]
}

export const POR_LANDMARKS: LandmarkRules = {
  first: [{ re: /\bTAVERN\b/, kind: 'tavern', label: 'Tavern' }],
  // the four New Phlan shops (spec/town.md)
  shops: [
    { re: /JEWELRY/, kind: 'jeweller', label: 'Jeweller' },
    { re: /ARMS AND ARMOR/, kind: 'armoury', label: 'Arms and armour' },
    { re: /SILVER/, kind: 'silver', label: 'Silversmith' },
    { re: /OFFERS YOU ITEMS FOR SALE/, kind: 'store', label: 'General store' },
  ],
  god: /(?:PRIESTS|PRIESTESS \w+) OF (\w+)/,
  places: [
    { re: /CITY HALL/, kind: 'hall', label: 'City Hall' },
    { re: /HARBOR MASTER/, kind: 'harbour', label: 'Harbour master' },
    { re: /BOARD A BOAT/, kind: 'harbour', label: 'Boats' },
    { re: /GATEWAY/, kind: 'gate', label: 'Gateway' },
  ],
}

// Tilverton's arms dealers sell "the finest Cormyr steel"; its other shops greet you alike
export const COAB_LANDMARKS: LandmarkRules = {
  ...POR_LANDMARKS,
  first: [{ re: /\bTAVERN\b|\bBARTENDER\b/, kind: 'tavern', label: 'Tavern' }],
  shops: [{ re: /CORMYR STEEL/, kind: 'armoury', label: 'Arms and armour' }, ...POR_LANDMARKS.shops],
}
