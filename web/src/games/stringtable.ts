// The engine's own messages, read from the player's game files by address (spec/README.md D1,
// spec/D-appendices/strings.md §4). Each entry is the image address of the Turbo Pascal string the
// original prints, with the routine that prints it; the text itself stays in the game files. A game
// that does not print a message leaves it out. Messages the profile data holds (effect and spell
// lines, credits, monster names) are addresses in that data instead.

export type StringId =
  | 'cough'
  | 'nausea'
  | 'cloudPoisoned'
  | 'cloudKilled'
  | 'battleBegins'
  | 'teammateDying'
  | 'continueBattle'
  | 'gameSpeed'
  | 'speedRange'
  | 'bandaged'
  | 'flee'
  | 'blocked'
  | 'notWithWeapon'
  | 'attackAlly'
  | 'aim'
  | 'usesItem'
  | 'campOnlySpell'
  | 'beginsCasting'
  | 'sweeps'
  | 'backstabs'
  | 'slaysHelpless'
  | 'attacks'
  | 'fromBehind'
  | 'cruelBlow'
  | 'hittingFor'
  | 'point'
  | 'points'
  | 'ofDamage'
  | 'andMisses'
  | 'lostSpell'
  | 'goesDown'
  | 'andIsDying'
  | 'isKilled'
  | 'gotAway'
  | 'escapeBlocked'
  | 'turnsUndead'
  | 'isTurned'
  | 'isDestroyed'
  | 'nothingHappens'
  | 'abortSpell'
  | 'spellAborted'
  | 'castsASpell'
  | 'spellName'
  | 'alreadyTargeted'
  | 'charmUnaffected'
  | 'fleesInPanic'
  | 'forcedToFlee'
  | 'surrenders'
  | 'wonDuel'
  | 'foundTreasure'
  | 'duelistReceives'
  | 'experiencePoints'
  | 'lostDuel'
  | 'partyWon'
  | 'eachReceives'
  | 'partyFled'
  | 'theEnd'
  | 'monstersRejoice'
  | 'hidesShare'
  | 'his'
  | 'share'
  | 'her'
  | 'locked'
  | 'noMonster'
  | 'bothWait'
  | 'monstersFlee'
  | 'dies'
  | 'isHitFor'
  | 'pointsOfDamage'
  | 'riverStench'
  | 'wrongClass'
  | 'alreadyUsing'
  | 'handsFull'
  | 'cursed'
  | 'overloaded'
  | 'consciousOnly'
  | 'notThatClass'
  | 'notEnoughXp'
  | 'aLevel'
  | 'trainingCosts'
  | 'willBecome'
  | 'andALevel'
  | 'wishToTrain'
  | 'congratulations'
  | 'isDrained'
  | 'drainLevels'
  | 'drainALevel'
  | 'hasScribed'
  | 'hasMemorized'
  | 'partyHealed'
  | 'interrupted'
  | 'fallKilled'
  | 'fallDown'
  | 'getsBackUp'
  | 'unCursed'
  | 'itemUnCursed'
  | 'miscasts'
  | 'casts'
  | 'noEvilScum'
  | 'tooManyRangers'
  | 'toleratesNoEvil'
  | 'feelsBetter'
  | 'handsUnaffected'
  | 'diseaseCured'
  | 'mustUnready'
  | 'takeOverloaded'
  | 'cantHalve'
  | 'moneyOverloaded'
  | 'takes'
  | 'pointsOfDamageLine'
  | 'takesOnePoint'
  | 'fromFire'
  | 'fromCold'
  | 'fromElectricity'
  | 'fromAcid'
  | 'fromMagic'
  | 'unaffected'
  | 'avoidsIt'
  | 'deadForever'
  | 'drainKilled'
  | 'isCured'

export type Strings = Partial<Record<StringId, number>>

export const POR_STRINGS: Strings = {
  cough: 0x42c1b, // Stinking Cloud, saved; FUN_5216_0ae7
  nausea: 0x42c2b, // Stinking Cloud, not saved; FUN_5216_0ae7
  battleBegins: 0x26a8e, // battle start; FUN_34c7_1e31
  teammateDying: 0x22918, // round end; FUN_320c_0880
  continueBattle: 0x2292f, // no enemy left; FUN_320c_0880
  gameSpeed: 0x31240, // speed prompt; FUN_3f81_1a97
  speedRange: 0x3124e, // speed prompt, end; FUN_3f81_1a97
  bandaged: 0x230b3, // Bandage; FUN_320c_0fff
  flee: 0x22a91, // a step off the battlefield; FUN_320c_09df
  blocked: 0x22a97, // a step that cannot be taken (CotAB: "can't go there"); FUN_320c_09df
  notWithWeapon: 0x22df0, // Aim with a missile weapon; FUN_320c_0d45
  attackAlly: 0x2d46a, // aiming at the own side; FUN_3aae_2998
  aim: 0x2d57b, // aim prompt; FUN_3aae_2aa0
  usesItem: 0x3a3b7, // Use; FUN_4894_1a8a
  campOnlySpell: 0x2ced5, // Cast in combat; FUN_3aae_2414
  beginsCasting: 0x2cee5, // Cast in combat; FUN_3aae_2414
  sweeps: 0x2b95b, // sweep attack; FUN_3aae_0e82
  backstabs: 0x2ad12, // attack line; FUN_3aae_02f9
  slaysHelpless: 0x2ad1e, // attack on the helpless; FUN_3aae_02f9
  attacks: 0x2ad2d, // attack line; FUN_3aae_02f9
  fromBehind: 0x2ad35, // attack line; FUN_3aae_02f9
  cruelBlow: 0x2ad44, // attack on the helpless; FUN_3aae_02f9
  hittingFor: 0x2ad58, // attack line; FUN_3aae_02f9
  point: 0x2ad65, // attack line; FUN_3aae_02f9
  points: 0x2ad6d, // attack line; FUN_3aae_02f9
  ofDamage: 0x2ad76, // attack line; FUN_3aae_02f9
  andMisses: 0x2ad80, // attack line; FUN_3aae_02f9
  lostSpell: 0x2ad8b, // damage while casting; FUN_3aae_02f9
  goesDown: 0x2ad98, // a fall; FUN_3aae_02f9
  andIsDying: 0x2ada2, // a fall; FUN_3aae_02f9
  isKilled: 0x2adcf, // a fall; FUN_3aae_02f9
  gotAway: 0x2b72f, // flight off the battlefield; FUN_3aae_0c6a
  escapeBlocked: 0x2b738, // flight; FUN_3aae_0c6a
  turnsUndead: 0x2bc10, // Turn; FUN_3aae_116a
  isTurned: 0x2bc20, // Turn; FUN_3aae_116a
  isDestroyed: 0x2bc2a, // Turn; FUN_3aae_116a
  nothingHappens: 0x2bc37, // Turn; FUN_3aae_116a
  abortSpell: 0x3f134, // a cast without a target; FUN_4e53_0c20
  spellAborted: 0x3f142, // a cast without a target; FUN_4e53_0c20
  castsASpell: 0x41835, // a monster casts; FUN_4e53_331a
  spellName: 0x41843, // a monster casts; FUN_4e53_331a
  alreadyTargeted: 0x2cb8d, // target list; FUN_3aae_20c3
  charmUnaffected: 0x3f6f4, // Charm / Hold Person on the large; FUN_4e53_11dd
  fleesInPanic: 0x23340, // morale; FUN_3334_000f
  forcedToFlee: 0x243fa, // morale; FUN_3334_10d7
  surrenders: 0x2440c, // morale; FUN_3334_10d7
  wonDuel: 0x1e8d5, // aftermath; FUN_2e08_0916
  foundTreasure: 0x1e913, // aftermath; FUN_2e08_0916
  duelistReceives: 0x1e931, // aftermath; FUN_2e08_0916
  experiencePoints: 0x1e960, // aftermath; FUN_2e08_0916
  lostDuel: 0x1e8bd, // aftermath (CotAB: "the fight"); FUN_2e08_0916
  partyWon: 0x1e8ec, // aftermath; FUN_2e08_0916
  eachReceives: 0x1e947, // aftermath; FUN_2e08_0916
  partyFled: 0x1e8ff, // aftermath; FUN_2e08_0916
  theEnd: 0x1f54e, // the party destroyed; FUN_2e08_1527
  monstersRejoice: 0x1f557, // the party destroyed; FUN_2e08_1527
  hidesShare: 0x1f329, // an NPC takes its share (CotAB: then his/her, " share."); FUN_2e08_12e8
  locked: 0x2f4c4, // a locked door; FUN_3e76_0d6d
  noMonster: 0x36af5, // LOAD_MONSTER; FUN_45c5_0ec4
  bothWait: 0x1bb04, // encounter; FUN_29c3_1ef8
  monstersFlee: 0x1bb15, // encounter; FUN_29c3_1ef8
  dies: 0x21f21, // script DAMAGE; FUN_2fea_20cc
  isHitFor: 0x21f29, // script DAMAGE; FUN_2fea_20cc
  pointsOfDamage: 0x21f36, // script DAMAGE; FUN_2fea_20cc
  riverStench: 0x2ef54, // PoR wilderness; FUN_3e76_0818
  wrongClass: 0x39de0, // Ready; FUN_4894_14d0
  alreadyUsing: 0x39dec, // Ready; FUN_4894_14d0
  handsFull: 0x39dfb, // Ready; FUN_4894_14d0
  cursed: 0x39dd4, // Unready; FUN_4894_14d0
  overloaded: 0x3a069, // Trade; FUN_4894_1734
  consciousOnly: 0x340de, // training; FUN_417f_29ae
  notThatClass: 0x34115, // training; FUN_417f_29ae
  notEnoughXp: 0x34134, // training; FUN_417f_29ae
  aLevel: 0x34158, // training; FUN_417f_29ae
  trainingCosts: 0x340fd, // training; FUN_417f_29ae
  willBecome: 0x3414a, // training; FUN_417f_29ae
  andALevel: 0x34167, // training; FUN_417f_29ae
  wishToTrain: 0x34174, // training; FUN_417f_29ae
  congratulations: 0x3418b, // training; FUN_417f_29ae
  isDrained: 0x2931f, // energy drain; FUN_3723_2122
  drainLevels: 0x2930f, // energy drain; FUN_3723_2122
  drainALevel: 0x29317, // energy drain; FUN_3723_2122
  hasScribed: 0x3be3b, // rest; FUN_4b46_09e7
  hasMemorized: 0x3bd77, // rest; FUN_4b46_0925
  partyHealed: 0x3bcb7, // rest; FUN_4b46_0871
  interrupted: 0x3c0d9, // rest; FUN_4b46_0c9a
  fallKilled: 0x4349a, // damage outside combat; FUN_5216_1344
  fallDown: 0x43461, // damage outside combat; FUN_5216_1344
  getsBackUp: 0x439bc, // revive; FUN_5216_1869
  unCursed: 0x40a4e, // Remove Curse; FUN_4e53_2540
  itemUnCursed: 0x40a5b, // Remove Curse; FUN_4e53_2540
  casts: 0x3f12e, // cast outside combat; FUN_4e53_0c20
  mustUnready: 0x39660, // Drop; FUN_4894_0d70
  takeOverloaded: 0x3a069, // Trade; FUN_4894_1734
  cantHalve: 0x3a11c, // Halve; FUN_4894_17ed
  moneyOverloaded: 0x3c711, // money trade; FUN_4c2d_044c
  takes: 0x433e7, // damage line; FUN_5216_1344
  pointsOfDamageLine: 0x433ee, // damage line; FUN_5216_1344
  takesOnePoint: 0x43401, // damage line; FUN_5216_1344
  fromFire: 0x4341a, // damage line; FUN_5216_1344
  fromCold: 0x43424, // damage line; FUN_5216_1344
  fromElectricity: 0x4342e, // damage line; FUN_5216_1344
  fromAcid: 0x4343f, // damage line; FUN_5216_1344
  fromMagic: 0x43449, // damage line; FUN_5216_1344
  unaffected: 0x437a8, // add-effect negated; FUN_5216_1656
  avoidsIt: 0x281d2, // save avoids; FUN_3723_0fac
  deadForever: 0x2932b, // energy drain; FUN_3723_2122
  drainKilled: 0x29348, // energy drain; FUN_3723_2122
  isCured: 0x431d8, // cure; FUN_5216_1081
}

export const COAB_STRINGS: Strings = {
  cough: 0x4b8b5, // Stinking Cloud, saved; 0x4b8f7
  nausea: 0x4b8c5, // Stinking Cloud, not saved; 0x4b8f7
  cloudPoisoned: 0x4b8e1, // Cloudkill; 0x4b8f7
  cloudKilled: 0x4b8ed, // Cloudkill; 0x4b8f7
  battleBegins: 0x268b8, // battle start; 0x268cb
  teammateDying: 0x226bb, // round end; 0x226e3
  continueBattle: 0x226d2, // no enemy left; 0x226e3
  gameSpeed: 0x318b4, // speed prompt; 0x3191b
  speedRange: 0x318c2, // speed prompt, end; 0x3191b
  bandaged: 0x503a3, // Bandage; 0x503af
  flee: 0x22841, // a step off the battlefield; 0x22856
  blocked: 0x22847, // a step that cannot be taken (CotAB: "can't go there"); 0x22856
  notWithWeapon: 0x22c1e, // Aim with a missile weapon; 0x22c33
  attackAlly: 0x2d461, // aiming at the own side; 0x2d46f
  aim: 0x2d572, // aim prompt; 0x2d577
  usesItem: 0x3f98f, // Use; 0x3f9a8
  campOnlySpell: 0x2cc9e, // Cast in combat; 0x2ccbd
  beginsCasting: 0x2ccae, // Cast in combat; 0x2ccbd
  sweeps: 0x2b486, // sweep attack; 0x2b48d
  backstabs: 0x2a7a1, // attack line; 0x2a868
  slaysHelpless: 0x2a7ad, // attack on the helpless; 0x2a868
  attacks: 0x2a7bc, // attack line; 0x2a868
  fromBehind: 0x2a7c4, // attack line; 0x2a868
  cruelBlow: 0x2a7d3, // attack on the helpless; 0x2a868
  hittingFor: 0x2a7e7, // attack line; 0x2a868
  point: 0x2a7f4, // attack line; 0x2a868
  points: 0x2a7fc, // attack line; 0x2a868
  ofDamage: 0x2a805, // attack line; 0x2a868
  andMisses: 0x2a80f, // attack line; 0x2a868
  lostSpell: 0x2a81a, // damage while casting; 0x2a868
  goesDown: 0x2a827, // a fall; 0x2a868
  andIsDying: 0x2a831, // a fall; 0x2a868
  isKilled: 0x2a85e, // a fall; 0x2a868
  gotAway: 0x2b250, // flight off the battlefield; 0x2b26b
  escapeBlocked: 0x2b259, // flight; 0x2b26b
  turnsUndead: 0x2b73e, // Turn; 0x2b778
  isTurned: 0x2b74e, // Turn; 0x2b778
  isDestroyed: 0x2b758, // Turn; 0x2b778
  nothingHappens: 0x2b765, // Turn; 0x2b778
  abortSpell: 0x45235, // a cast without a target; 0x45251
  spellAborted: 0x45243, // a cast without a target; 0x45251
  castsASpell: 0x4a3e8, // a monster casts; 0x4a3fd
  spellName: 0x4a3f6, // a monster casts; 0x4a3fd
  alreadyTargeted: 0x2c76b, // target list; 0x2c781
  charmUnaffected: 0x45e85, // Charm / Hold Person on the large; 0x45e9e
  fleesInPanic: 0x230fc, // morale; 0x2310b
  forcedToFlee: 0x24422, // morale; 0x2443f
  surrenders: 0x24434, // morale; 0x2443f
  wonDuel: 0x1e0ef, // aftermath; 0x1e19c
  foundTreasure: 0x1e119, // aftermath; 0x1e19c
  duelistReceives: 0x1e137, // aftermath; 0x1e19c
  experiencePoints: 0x1e166, // aftermath; 0x1e19c
  lostDuel: 0x1e0d6, // aftermath (CotAB: "the fight"); 0x1e19c
  partyWon: 0x1e106, // aftermath; 0x1e19c
  eachReceives: 0x1e14d, // aftermath; 0x1e19c
  partyFled: 0x1e0c2, // aftermath; 0x1e19c
  monstersRejoice: 0x1ee32, // the party destroyed; 0x1ee82
  hidesShare: 0x1eba8, // an NPC takes its share (CotAB: then his/her, " share."); 0x1ebee
  his: 0x1ebba, // CotAB share line; 0x1ebee
  share: 0x1ebbe, // CotAB share line; 0x1ebee
  her: 0x1ebc6, // CotAB share line; 0x1ebee
  locked: 0x2fa87, // a locked door; 0x2fa90
  noMonster: 0x3563d, // LOAD_MONSTER; 0x3565c
  bothWait: 0x1a8e9, // encounter; 0x1a90d
  monstersFlee: 0x1a8fa, // encounter; 0x1a90d
  dies: 0x21b85, // script DAMAGE; 0x21bd0
  isHitFor: 0x21b8d, // script DAMAGE; 0x21bd0
  pointsOfDamage: 0x21b9a, // script DAMAGE; 0x21bd0
  wrongClass: 0x3f3d6, // Ready; 0x3f406
  alreadyUsing: 0x3f3e2, // Ready; 0x3f406
  handsFull: 0x3f3f1, // Ready; 0x3f406
  cursed: 0x3f3ca, // Unready; 0x3f406
  overloaded: 0x3f641, // Trade; 0x3f64c
  consciousOnly: 0x3b497, // training; 0x3b557
  notThatClass: 0x3b4ce, // training; 0x3b557
  notEnoughXp: 0x3b4ed, // training; 0x3b557
  aLevel: 0x3b511, // training; 0x3b557
  trainingCosts: 0x3b4b6, // training; 0x3b557
  willBecome: 0x3b503, // training; 0x3b557
  andALevel: 0x3b520, // training; 0x3b557
  wishToTrain: 0x3b52d, // training; 0x3b557
  congratulations: 0x3b544, // training; 0x3b557
  hasScribed: 0x418b6, // rest; 0x418c2
  hasMemorized: 0x417f2, // rest; 0x41800
  partyHealed: 0x41727, // rest; 0x41741
  fallKilled: 0x4ca60, // damage outside combat; 0x4ca6a
  fallDown: 0x4ca27, // damage outside combat; 0x4ca6a
  getsBackUp: 0x4cf6a, // revive; 0x4cf77
  unCursed: 0x47552, // Remove Curse; 0x47575
  miscasts: 0x45226, // CotAB miscast; 0x45251
  casts: 0x4522f, // cast outside combat; 0x45251
  noEvilScum: 0x39e42, // joining; 0x39e98
  tooManyRangers: 0x39e66, // joining; 0x39e98
  toleratesNoEvil: 0x39e80, // joining; 0x39e98
  feelsBetter: 0x40bea, // Lay on Hands; 0x40c07
  handsUnaffected: 0x40bf8, // Lay on Hands; 0x40c07
  diseaseCured: 0x40d12, // Cure Disease; 0x40d1c
  mustUnready: 0x3e3a1, // Drop; 0x3e3f1
  takeOverloaded: 0x3f641, // Trade; 0x3f64c
  cantHalve: 0x3f6f4, // Halve; 0x3f705
  moneyOverloaded: 0x421f0, // money trade; 0x421fb
  takes: 0x4c9ad, // damage line; 0x4ca6a
  pointsOfDamageLine: 0x4c9b4, // damage line; 0x4ca6a
  takesOnePoint: 0x4c9c7, // damage line; 0x4ca6a
  fromFire: 0x4c9e0, // damage line; 0x4ca6a
  fromCold: 0x4c9ea, // damage line; 0x4ca6a
  fromElectricity: 0x4c9f4, // damage line; 0x4ca6a
  fromAcid: 0x4ca05, // damage line; 0x4ca6a
  fromMagic: 0x4ca0f, // damage line; 0x4ca6a
  unaffected: 0x4cd83, // add-effect negated; 0x4cd91
  avoidsIt: 0x2824c, // save avoids; 0x28256
  isCured: 0x4c0f4, // cure; 0x4c0fd
}
