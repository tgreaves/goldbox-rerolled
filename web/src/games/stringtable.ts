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
  | 'howMuch'
  | 'noGems'
  | 'fineCollection'
  | 'gemOne'
  | 'pieceOfJewelry'
  | 'gemsCount'
  | 'piecesOfJewelry'
  | 'gemValued'
  | 'gp'
  | 'jewelValued'
  | 'youCan'
  | 'shopOverloaded'
  | 'shopNoMoney'
  | 'notBlind'
  | 'notDiseased'
  | 'notPoisoned'
  | 'notDead'
  | 'notCursed'
  | 'notStoned'
  | 'cureAnyway'
  | 'willOnlyCost'
  | 'goldPieces'
  | 'payForCure'
  | 'templeNoMoney'
  | 'templeCured'
  | 'take'
  | 'makesCamp'
  | 'camp'
  | 'quitToDos'
  | 'castAny'
  | 'memorizeAny'
  | 'scribeAny'
  | 'noCastHere'
  | 'noCondition'
  | 'noSpells'
  | 'combatOnlySpell'
  | 'loseIt'
  | 'memorizeThese'
  | 'memorizeThese2'
  | 'cannotMemorize'
  | 'scribeThese'
  | 'scribeThese2'
  | 'noScrolls'
  | 'knowSpell'
  | 'scribingSpell'
  | 'cannotScribe'
  | 'funky'
  | 'noSpellEffects'
  | 'restTime'
  | 'alter'
  | 'selected'
  | 'dropFromParty'
  | 'bidsFarewell'
  | 'dumpedInDitch'
  | 'sighOfRelief'
  | 'partyKilled'
  | 'cantModify'
  | 'goldForYour'
  | 'illGiveYou'
  | 'mustBeReadied'
  | 'moveLeft'
  | 'shopLeave'
  | 'shopGoBack'
  | 'templeLeave'
  | 'templeGoBack'
  | 'treasureLeft'
  | 'treasureGoBack'
  | 'guarding'
  | 'dropIt'
  | 'isItADeal'
  | 'sold'
  | 'identifyFor'
  | 'identifyDeal'
  | 'idNoMoney'
  | 'nothingNew'
  | 'looksLike'
  | 'tradeWithWhom'
  | 'okayToLose'
  | 'tradeTo'
  | 'selectCoin'
  | 'notHere'
  | 'partyOrder'
  | 'reviveMonster'
  | 'reviveParty'
  | 'sellOverloaded'
  | 'appraiseOverloaded'
  | 'tradeHowMuch'
  | 'tradeWillYou'
  | 'dropHowMuch'
  | 'dropWillYou'
  | 'coinCopper'
  | 'coinSilver'
  | 'coinElectrum'
  | 'coinGold'
  | 'coinPlatinum'
  | 'coinGems'
  | 'coinJewelry'
  | 'takeSelectCoin'
  | 'takeWillYou'
  | 'pickNewClass'
  | 'doesntQualify'
  | 'nowFirstLevel'
  | 'nowFirstLevelEnd'

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
  howMuch: 0x3cfa1, // money: amount (pool, take); FUN_4c2d_0ceb
  noGems: 0x3dbb0, // appraise; FUN_4c2d_19b2
  fineCollection: 0x3dbf3, // appraise; FUN_4c2d_19b2
  gemOne: 0x3dbc3, // appraise; FUN_4c2d_19b2
  pieceOfJewelry: 0x3dbce, // appraise; FUN_4c2d_19b2
  gemsCount: 0x3dbc8, // appraise; FUN_4c2d_19b2
  piecesOfJewelry: 0x3dbe0, // appraise; FUN_4c2d_19b2
  gemValued: 0x3dc35, // appraise; FUN_4c2d_19b2
  gp: 0x3dc4b, // appraise; FUN_4c2d_19b2
  jewelValued: 0x3dc6a, // appraise; FUN_4c2d_19b2
  youCan: 0x3dc5f, // appraise; FUN_4c2d_19b2
  shopOverloaded: 0x1f92e, // shop Buy, treasure Take; FUN_2f70_0239
  shopNoMoney: 0x1fa4f, // shop Buy; FUN_2f70_0361
  notBlind: 0x1d36c, // temple; FUN_2d14_0249
  notDiseased: 0x1d40f, // temple; FUN_2d14_02ed
  notPoisoned: 0x1d86e, // temple; FUN_2d14_0751
  notDead: 0x1d638, // temple; FUN_2d14_0510
  notCursed: 0x1d95e, // temple; FUN_2d14_083a
  notStoned: 0x1da4a, // temple; FUN_2d14_0928
  cureAnyway: 0x1d140, // temple; FUN_2d14_0013
  willOnlyCost: 0x1d1b6, // temple; FUN_2d14_00bf
  goldPieces: 0x1d1c7, // temple; FUN_2d14_00bf
  payForCure: 0x1d1d5, // temple; FUN_2d14_00bf
  templeNoMoney: 0x1d1e3, // temple; FUN_2d14_00bf
  templeCured: 0x1d1f5, // temple; FUN_2d14_00bf
  take: 0x1eda0, // treasure; FUN_2e08_0d38
  makesCamp: 0x31633, // camp; FUN_3f81_1e6f
  camp: 0x3166b, // camp; FUN_3f81_1e6f
  quitToDos: 0x31672, // camp Save; FUN_3f81_1e6f
  castAny: 0x2fb49, // spell activity; FUN_3f81_036c
  memorizeAny: 0x2fb59, // spell activity; FUN_3f81_036c
  scribeAny: 0x2fb69, // spell activity; FUN_3f81_036c
  noCastHere: 0x2fb12, // spell activity; FUN_3f81_036c
  noCondition: 0x2fb32, // spell activity; FUN_3f81_036c
  noSpells: 0x2fc99, // Cast; FUN_3f81_04a1
  combatOnlySpell: 0x3f0de, // Cast outside combat; FUN_4e53_0c20
  loseIt: 0x3f0f8, // Cast outside combat; FUN_4e53_0c20
  memorizeThese: 0x300cf, // Memorize; FUN_3f81_090a
  memorizeThese2: 0x30102, // Memorize; FUN_3f81_090a
  cannotMemorize: 0x300e7, // Memorize; FUN_3f81_090a
  scribeThese: 0x302c9, // Scribe; FUN_3f81_0b5b
  scribeThese2: 0x30355, // Scribe; FUN_3f81_0b5b
  noScrolls: 0x302df, // Scribe; FUN_3f81_0b5b
  knowSpell: 0x302f7, // Scribe; FUN_3f81_0b5b
  scribingSpell: 0x30313, // Scribe; FUN_3f81_0b5b
  cannotScribe: 0x30336, // Scribe; FUN_3f81_0b5b
  funky: 0x306d0, // Display; FUN_3f81_0fbc
  noSpellEffects: 0x307af, // Display; FUN_3f81_0fbc
  restTime: 0x3ba43, // Rest; FUN_4b46_05f0
  alter: 0x31420, // Alter; FUN_3f81_1c59
  selected: 0x30f7e, // Alter Order; FUN_3f81_1780
  dropFromParty: 0x310a2, // Alter Drop; FUN_3f81_18e5
  bidsFarewell: 0x310b4, // Alter Drop; FUN_3f81_18e5
  dumpedInDitch: 0x310c6, // Alter Drop; FUN_3f81_18e5
  sighOfRelief: 0x310db, // Alter Drop; FUN_3f81_18e5
  partyKilled: 0x1c366, // the party destroyed outside battles; FUN_29c3_2775
  cantModify: 0x3385e, // Modify; FUN_417f_209f
  goldForYour: 0x3a5da, // Sell; FUN_4894_1cee
  illGiveYou: 0x3a5cb, // Sell; FUN_4894_1cee
  mustBeReadied: 0x39803, // Use; FUN_4894_0ef8
  moveLeft: 0x22a74, // battle step; FUN_320c_09df
  shopLeave: 0x1fbc0, // shop Exit with money left; FUN_2f70_053e
  shopGoBack: 0x1fc13, // shop Exit with money left; FUN_2f70_053e
  templeLeave: 0x1ddce, // temple Exit with money left; FUN_2d14_0d09
  templeGoBack: 0x1de19, // temple Exit with money left; FUN_2d14_0d09
  treasureLeft: 0x1eefd, // treasure Exit; FUN_2e08_0ecd
  treasureGoBack: 0x1ef1d, // treasure Exit; FUN_2e08_0ecd
  guarding: 0x0321d, // Guard; FUN_10ba_2686
  dropIt: 0x3982e, // items: Drop; FUN_4894_0ef8
  isItADeal: 0x3a5f1, // items: Sell; FUN_4894_1cee
  sold: 0x3a600, // items: Sell; FUN_4894_1cee
  identifyFor: 0x3a808, // items: identify; FUN_4894_1f52
  identifyDeal: 0x3a830, // items: identify; FUN_4894_1f52
  idNoMoney: 0x3a83f, // items: identify; FUN_4894_1f52
  nothingNew: 0x3a850, // items: identify; FUN_4894_1f52
  looksLike: 0x3a876, // items: identify; FUN_4894_1f52
  tradeWithWhom: 0x3a058, // items: Trade; FUN_4894_1734
  okayToLose: 0x39698, // items: a marked scroll; FUN_4894_0d70
  tradeTo: 0x3aa5a, // money: Trade; FUN_4894_2156
  selectCoin: 0x3aa66, // money: Trade; FUN_4894_2156
  notHere: 0x2f0db, // Area refused; FUN_3e76_0989
  partyOrder: 0x30f50, // Alter Order; FUN_3f81_1780
  reviveMonster: 0x439a8, // revived, a monster; FUN_5216_1869
  reviveParty: 0x439bc, // revived, a party member; FUN_5216_1869
  sellOverloaded: 0x3a606, // items: Sell, the platinum does not fit; FUN_4894_1cee
  appraiseOverloaded: 0x3c4ab, // appraisal sold, the platinum does not fit; FUN_4c2d_0203
  tradeHowMuch: 0x3aa7b, // money Trade; FUN_4894_2156
  tradeWillYou: 0x3aa85, // money Trade; FUN_4894_2156
  dropHowMuch: 0x3adcd, // money Drop; FUN_4894_24a7
  dropWillYou: 0x3add7, // money Drop; FUN_4894_24a7
  coinCopper: 0x3ce52, // the money prompts' coin words; FUN_4c2d_0b93
  coinSilver: 0x3ce4a, // FUN_4c2d_0b93
  coinElectrum: 0x3ce40, // FUN_4c2d_0b93
  coinGold: 0x3ce30, // FUN_4c2d_0b93
  coinPlatinum: 0x3ce36, // FUN_4c2d_0b93
  coinGems: 0x3ce2a, // FUN_4c2d_0b93
  coinJewelry: 0x3ce5a, // FUN_4c2d_0b93
  takeSelectCoin: 0x3cf8d, // money: take from the pool; FUN_4c2d_0ceb
  takeWillYou: 0x3cfab, // money: take from the pool; FUN_4c2d_0ceb
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
  howMuch: 0x42a80, // money: amount (pool, take); 0x42a9a
  noGems: 0x435e6, // appraise; 0x436b8
  fineCollection: 0x43629, // appraise; 0x436b8
  gemOne: 0x435f9, // appraise; 0x436b8
  pieceOfJewelry: 0x43604, // appraise; 0x436b8
  gemsCount: 0x435fe, // appraise; 0x436b8
  piecesOfJewelry: 0x43616, // appraise; 0x436b8
  gemValued: 0x4366b, // appraise; 0x436b8
  gp: 0x43681, // appraise; 0x436b8
  jewelValued: 0x436a0, // appraise; 0x436b8
  youCan: 0x43695, // appraise; 0x436b8
  shopOverloaded: 0x1f3a1, // shop Buy, treasure Take; 0x1f3ac
  shopNoMoney: 0x1f4c2, // shop Buy; 0x1f4d4
  notBlind: 0x1c911, // temple; 0x1c92e
  notDiseased: 0x1c9b4, // temple; 0x1c9d2
  notPoisoned: 0x1cf18, // temple; 0x1cf3b
  notDead: 0x1ccce, // temple; 0x1cce6
  notCursed: 0x1d008, // temple; 0x1d024
  notStoned: 0x1d0f4, // temple; 0x1d112
  cureAnyway: 0x1c6e2, // temple; 0x1c6f5
  willOnlyCost: 0x1c758, // temple; 0x1c7a1
  goldPieces: 0x1c769, // temple; 0x1c7a1
  payForCure: 0x1c777, // temple; 0x1c7a1
  templeNoMoney: 0x1c785, // temple; 0x1c7a1
  templeCured: 0x1c797, // temple; 0x1c7a1
  take: 0x1e5f6, // treasure; 0x1e60e
  makesCamp: 0x3217c, // camp; 0x321cb
  camp: 0x321b4, // camp; 0x321cb
  quitToDos: 0x321ba, // camp Save; 0x321cb
  castAny: 0x3010d, // spell activity; 0x30140
  memorizeAny: 0x3011d, // spell activity; 0x30140
  scribeAny: 0x3012d, // spell activity; 0x30140
  noCastHere: 0x300d6, // spell activity; 0x30140
  noCondition: 0x300f6, // spell activity; 0x30140
  noSpells: 0x3025d, // Cast; 0x30275
  loseIt: 0x451f0, // Cast outside combat; 0x45251
  memorizeThese: 0x306aa, // Memorize; 0x306f5
  memorizeThese2: 0x306dd, // Memorize; 0x306f5
  cannotMemorize: 0x306c2, // Memorize; 0x306f5
  scribeThese: 0x308a9, // Scribe; 0x3094b
  scribeThese2: 0x30935, // Scribe; 0x3094b
  noScrolls: 0x308bf, // Scribe; 0x3094b
  knowSpell: 0x308d7, // Scribe; 0x3094b
  scribingSpell: 0x308f3, // Scribe; 0x3094b
  cannotScribe: 0x30916, // Scribe; 0x3094b
  funky: 0x30cb2, // Display; 0x30dda
  noSpellEffects: 0x30dc5, // Display; 0x30dda
  restTime: 0x414a8, // Rest; 0x414b5
  alter: 0x31a97, // Alter; 0x31ad8
  selected: 0x315f2, // Alter Order; 0x31604
  dropFromParty: 0x31716, // Alter Drop; 0x31769
  bidsFarewell: 0x31728, // Alter Drop; 0x31769
  dumpedInDitch: 0x3173a, // Alter Drop; 0x31769
  sighOfRelief: 0x3174f, // Alter Drop; 0x31769
  partyKilled: 0x1b169, // the party destroyed outside battles; 0x1b1a8
  interrupted: 0x41b6a, // rest (CotAB: "Your repose is suddenly interrupted!"); 0x41b8f
  cantModify: 0x39059, // Modify; 0x39080
  goldForYour: 0x3fc9e, // Sell; 0x3fcf2
  illGiveYou: 0x3fc8f, // Sell; 0x3fcf2
  mustBeReadied: 0x3ea7e, // Use; 0x3eab3
  moveLeft: 0x22824, // battle step; 0x22856
  shopLeave: 0x1f6c9, // shop Exit with money left; 0x1f747
  shopGoBack: 0x1f71c, // shop Exit with money left; 0x1f747
  templeLeave: 0x1d40e, // temple Exit with money left; 0x1d489
  templeGoBack: 0x1d459, // temple Exit with money left; 0x1d489
  treasureLeft: 0x1e753, // treasure Exit; 0x1e7a3
  treasureGoBack: 0x1e773, // treasure Exit; 0x1e7a3
  guarding: 0x4f87a, // Guard; 0x4f883
  dropIt: 0x3eaa9, // items: Drop; 0x3eab3
  isItADeal: 0x3fcb5, // items: Sell; 0x3fcf2
  sold: 0x3fcc4, // items: Sell; 0x3fcf2
  identifyFor: 0x3fecf, // items: identify; 0x3ff59
  identifyDeal: 0x3fef7, // items: identify; 0x3ff59
  idNoMoney: 0x3ff06, // items: identify; 0x3ff59
  nothingNew: 0x3ff17, // items: identify; 0x3ff59
  looksLike: 0x3ff3d, // items: identify; 0x3ff59
  tradeWithWhom: 0x3f630, // items: Trade; 0x3f64c
  okayToLose: 0x3e3d9, // items: a marked scroll; 0x3e3f1
  tradeTo: 0x4012a, // money: Trade; 0x4016e
  selectCoin: 0x40136, // money: Trade; 0x4016e
  notHere: 0x2f7e6, // Area refused; 0x2f7ef
  partyOrder: 0x315c4, // Alter Order; 0x31604
  pickNewClass: 0x5131d, // Human Change Classes: the list's title; 0x5135D
  doesntQualify: 0x5132c, // Human Change Classes, no class allowed; 0x5135D
  nowFirstLevel: 0x51346, // Human Change Classes, done; 0x5135D
  nowFirstLevelEnd: 0x5135b, // its full stop; 0x5135D
  reviveMonster: 0x4cf56, // revived, a monster; 0x4CF77
  reviveParty: 0x4cf6a, // revived, a party member; 0x4CF77
  sellOverloaded: 0x3fcca, // items: Sell, the platinum does not fit; 0x3fcf2
  appraiseOverloaded: 0x41f84, // appraisal sold, the platinum does not fit; 0x41FAC
  tradeHowMuch: 0x40153, // money Trade; 0x4016E
  tradeWillYou: 0x4015d, // money Trade; 0x4016E
  dropHowMuch: 0x404ad, // money Drop; 0x404C7
  dropWillYou: 0x404b7, // money Drop; 0x404C7
  coinCopper: 0x4292a, // the money prompts' coin words; 0x4293B
  coinSilver: 0x42922, // 0x4293B
  coinElectrum: 0x42918, // 0x4293B
  coinGold: 0x42908, // 0x4293B
  coinPlatinum: 0x4290e, // 0x4293B
  coinGems: 0x42902, // 0x4293B
  coinJewelry: 0x42932, // 0x4293B
  takeSelectCoin: 0x42a64, // money: take from the pool; 0x42a9a
  takeWillYou: 0x42a8a, // money: take from the pool; 0x42a9a
}

/**
 * The original's menus (spec/D-appendices/strings.md §4.1): each the image address of the Pascal
 * string the routine hands to its menu routine, split as the original splits it (games/strings.ts
 * `menuWords`). A menu the original builds from several strings has one id per piece; the code joins
 * them as the routine does. A game without the menu leaves it out.
 */
export type MenuId =
  | 'main'
  | 'camp' | 'magic' | 'alter' | 'orderSelect' | 'orderPlace' | 'campFaster' | 'campSlower' | 'campSpeedExit' | 'rest'
  | 'yesNo' | 'listExit' | 'shopLeaveYesNo' | 'templeLeaveYesNo' | 'treasureLeaveYesNo'
  | 'shop' | 'shopNoPool' | 'temple' | 'templeNoPool' | 'templeHeal'
  | 'treasureMoney' | 'treasureItems' | 'treasureNone' | 'treasureDetect' | 'treasureExit' | 'take'
  | 'appraiseGems' | 'appraiseJewelry' | 'appraiseExit' | 'sell' | 'sellKeep'
  | 'battleMove' | 'battleViewAim' | 'battleUse' | 'battleCast' | 'battleTurn' | 'battleQuickDone'
  | 'doneGuard' | 'doneDelayQuit' | 'doneBandage' | 'doneSpeedExit'
  | 'battleSlower' | 'battleFaster' | 'battleSpeedExit' | 'aim'
  | 'encounterParlay' | 'encounterAdvance' | 'parlay'
  | 'doorBash' | 'doorPick' | 'doorKnock' | 'doorExit'
  | 'itemReady' | 'itemUse' | 'itemTrade' | 'itemDrop' | 'itemHalve' | 'itemJoin' | 'itemSell' | 'itemId'
  | 'viewTrade' | 'viewDrop' | 'viewExit'
  | 'partyCreate' | 'partyDrop' | 'partyModify' | 'partyTrain' | 'partyChangeClass' | 'partyView' | 'partyAdd' | 'partyRemove' | 'partyLoad'
  | 'partySave' | 'partyBegin' | 'partyExit'
  | 'modify' | 'iconMain' | 'iconHeadWeapon' | 'iconParts' | 'iconEdit' | 'iconSmall' | 'iconLarge' | 'iconHair' | 'iconFace'

export type Menus = Partial<Record<MenuId, number>>

export const POR_MENUS: Menus = {
  main: 0x0cc76, // map areas, DS:04B6; FUN_3e76_0989
  camp: 0x0ccc8, // DS:0508; FUN_3f81_1e6f
  magic: 0x0ccf1, // DS:0531; FUN_3f81_13f1
  alter: 0x0cd1a, // DS:055A; FUN_3f81_1c59
  orderSelect: 0x0cd44, // DS:0584 + 0x29·k; FUN_3f81_1780
  orderPlace: 0x0cd6d, // DS:0584 + 0x29·k; FUN_3f81_1780
  campFaster: 0x31265, // speed > 0; FUN_3f81_1a97
  campSlower: 0x3126d, // speed < 9; FUN_3f81_1a97
  campSpeedExit: 0x31275, // FUN_3f81_1a97
  rest: 0x3bb39, // duration prompt; FUN_4b46_0721
  yesNo: 0x44b4a, // FUN_53aa_10d1
  shopLeaveYesNo: 0x1fbb7, // "~Yes ~No" after shopGoBack; FUN_2f70_053e
  templeLeaveYesNo: 0x1ddc5, // after templeGoBack; FUN_2d14_0d09
  treasureLeaveYesNo: 0x1eef4, // after treasureGoBack; FUN_2e08_0ecd
  listExit: 0x44834, // the vertical list's bottom line; FUN_53aa_0d9a
  shop: 0x1fb74, // pool holds money; FUN_2f70_053e
  shopNoPool: 0x1fb9b, // FUN_2f70_053e
  temple: 0x1dd7f, // pool holds money; FUN_2d14_0d09
  templeNoPool: 0x1dda7, // FUN_2d14_0d09
  templeHeal: 0x1db0d, // the cures list; FUN_2d14_09d7
  treasureMoney: 0x1eed0, // money left; FUN_2e08_0ecd
  treasureItems: 0x1eee5, // only items left; FUN_2e08_0ecd
  treasureNone: 0x1eeae, // nothing left; FUN_2e08_0ecd
  treasureDetect: 0x1eec3, // items and Detect Magic memorised; FUN_2e08_0ecd
  treasureExit: 0x1eebd, // FUN_2e08_0ecd
  take: 0x1eda7, // FUN_2e08_0d38
  appraiseGems: 0x3dc12, // FUN_4c2d_19b2
  appraiseJewelry: 0x3dc19, // FUN_4c2d_19b2
  appraiseExit: 0x3dc23, // FUN_4c2d_19b2
  sell: 0x3dc50, // in a shop that buys only; FUN_4c2d_19b2
  sellKeep: 0x3dc55, // FUN_4c2d_19b2
  battleMove: 0x226b9, // FUN_320c_0666
  battleViewAim: 0x226bf, // FUN_320c_0666
  battleUse: 0x226c9, // FUN_320c_0666
  battleCast: 0x226ce, // FUN_320c_0666
  battleTurn: 0x226d4, // FUN_320c_0666
  battleQuickDone: 0x226da, // FUN_320c_0666
  doneGuard: 0x22ebe, // FUN_320c_0e45
  doneDelayQuit: 0x22ec5, // FUN_320c_0e45
  doneBandage: 0x22ed1, // FUN_320c_0e45
  doneSpeedExit: 0x22eda, // FUN_320c_0e45
  battleSlower: 0x231a1, // speed < 9; FUN_320c_10f6
  battleFaster: 0x231a9, // speed > 0; FUN_320c_10f6
  battleSpeedExit: 0x231b1, // FUN_320c_10f6
  aim: 0x2d56f, // "Center Exit", after "Next Prev Manual "; FUN_3aae_2aa0
  encounterParlay: 0x1bacb, // the ECL menu rule (~); FUN_29c3_1ef8
  encounterAdvance: 0x1bae7, // FUN_29c3_1ef8
  parlay: 0x1c1d8, // FUN_29c3_25cb
  doorBash: 0x2f4ac, // FUN_3e76_0d6d
  doorPick: 0x2f4b1, // FUN_3e76_0d6d
  doorKnock: 0x2f4b7, // FUN_3e76_0d6d
  doorExit: 0x2f4be, // FUN_3e76_0d6d
  itemReady: 0x397c3, // items menu; FUN_4894_0ef8
  itemUse: 0x397c9, // FUN_4894_0ef8
  itemTrade: 0x397ce, // FUN_4894_0ef8
  itemDrop: 0x397d5, // FUN_4894_0ef8
  itemHalve: 0x397db, // FUN_4894_0ef8
  itemJoin: 0x397e2, // FUN_4894_0ef8
  itemSell: 0x397e8, // FUN_4894_0ef8
  itemId: 0x397ee, // FUN_4894_0ef8
  viewTrade: 0x393bb, // the view menu; FUN_4894_0ab3
  viewDrop: 0x393c2, // FUN_4894_0ab3
  viewExit: 0x393c8, // FUN_4894_0ab3
  partyCreate: 0x0cdd9, // the function table DS:0619 + 0x2A·i; FUN_417f_0161
  partyDrop: 0x0ce03, // FUN_417f_0161
  partyModify: 0x0ce2d, // FUN_417f_0161
  partyTrain: 0x0ce57, // FUN_417f_0161
  partyView: 0x0ce81, // FUN_417f_0161
  partyAdd: 0x0ceab, // FUN_417f_0161
  partyRemove: 0x0ced5, // FUN_417f_0161
  partyLoad: 0x0ceff, // FUN_417f_0161
  partySave: 0x0cf29, // FUN_417f_0161
  partyBegin: 0x0cf53, // FUN_417f_0161
  partyExit: 0x0cf7d, // FUN_417f_0161
  modify: 0x33885, // FUN_417f_209f
  iconMain: 0x0cfa8, // the icon editor's menus, DS:07BF + 0x29·level (level 1); FUN_417f_382d
  iconHeadWeapon: 0x0cfd1, // level 2; FUN_417f_382d
  iconParts: 0x0cffa, // level 3 (xxxx: Hair or Face); FUN_417f_382d
  iconEdit: 0x0d04c, // level 5; FUN_417f_382d
  iconSmall: 0x34fd0, // level 4's first word, when large; FUN_417f_382d
  iconLarge: 0x34fd6, // when small; FUN_417f_382d
  iconHair: 0x34fdc, // level 3's third word, colour 1; FUN_417f_382d
  iconFace: 0x34fe1, // colour 2; FUN_417f_382d
}

export const COAB_MENUS: Menus = {
  main: 0x0afb8, // map areas, DS:03D8; 0x2F7EF
  camp: 0x0b00a, // DS:042A; 0x321CB
  magic: 0x0b033, // DS:0453; 0x31275
  alter: 0x0b05c, // DS:047C; 0x31AD8
  orderSelect: 0x0b086, // DS:04A6 + 0x29·k; 0x31604
  orderPlace: 0x0b0af, // DS:04A6 + 0x29·k; 0x31604
  campFaster: 0x318d9, // speed > 0; 0x3191B
  campSlower: 0x318e1, // speed < 9; 0x3191B
  campSpeedExit: 0x318e9, // 0x3191B
  rest: 0x415aa, // duration prompt; 0x415F1
  yesNo: 0x52a2d, // 0x52A54
  shopLeaveYesNo: 0x1f6c0, // "~Yes ~No" after shopGoBack; 0x1f747
  templeLeaveYesNo: 0x1d405, // after templeGoBack; 0x1d489
  treasureLeaveYesNo: 0x1e74a, // after treasureGoBack; 0x1e7a3
  listExit: 0x52709, // the vertical list's bottom line; 0x5270F
  shop: 0x1f67d, // pool holds money; 0x1F747
  shopNoPool: 0x1f6a4, // 0x1F747
  temple: 0x1d3bf, // pool holds money; 0x1D489
  templeNoPool: 0x1d3e7, // 0x1D489
  templeHeal: 0x1d1b7, // the cures list; 0x1D1C1
  treasureMoney: 0x1e726, // money left; 0x1E7A3
  treasureItems: 0x1e73b, // only items left; 0x1E7A3
  treasureNone: 0x1e704, // nothing left; 0x1E7A3
  treasureDetect: 0x1e719, // items and Detect Magic memorised; 0x1E7A3
  treasureExit: 0x1e713, // 0x1E7A3
  take: 0x1e5fd, // 0x1E60E
  appraiseGems: 0x43648, // 0x436B8
  appraiseJewelry: 0x4364f, // 0x436B8
  appraiseExit: 0x43659, // 0x436B8
  sell: 0x43686, // 0x436B8
  sellKeep: 0x4368b, // 0x436B8
  battleMove: 0x2244b, // 0x224B8
  battleViewAim: 0x22451, // 0x224B8
  battleUse: 0x2245b, // 0x224B8
  battleCast: 0x22460, // 0x224B8
  battleTurn: 0x22466, // 0x224B8
  battleQuickDone: 0x2246c, // 0x224B8
  doneGuard: 0x22cec, // 0x22D33
  doneDelayQuit: 0x22cf3, // 0x22D33
  doneBandage: 0x22cff, // 0x22D33
  doneSpeedExit: 0x22d08, // 0x22D33
  battleSlower: 0x22f15, // speed < 9; 0x22F2A
  battleFaster: 0x22f1d, // speed > 0; 0x22F2A
  battleSpeedExit: 0x22f25, // 0x22F2A
  aim: 0x2d566, // "Center Exit", after "Next Prev Manual "; 0x2D577
  encounterParlay: 0x1a8b0, // the ECL menu rule (~); 0x1A90D
  encounterAdvance: 0x1a8cc, // 0x1A90D
  parlay: 0x1afe4, // 0x1B007
  doorBash: 0x2fa6f, // 0x2FA90
  doorPick: 0x2fa74, // 0x2FA90
  doorKnock: 0x2fa7a, // 0x2FA90
  doorExit: 0x2fa81, // 0x2FA90
  itemReady: 0x3ea3e, // items menu; 0x3EAB3
  itemUse: 0x3ea44, // 0x3EAB3
  itemTrade: 0x3ea49, // 0x3EAB3
  itemDrop: 0x3ea50, // 0x3EAB3
  itemHalve: 0x3ea56, // 0x3EAB3
  itemJoin: 0x3ea5d, // 0x3EAB3
  itemSell: 0x3ea63, // 0x3EAB3
  itemId: 0x3ea69, // 0x3EAB3
  viewTrade: 0x3e062, // the view menu; 0x3E0A0
  viewDrop: 0x3e069, // 0x3E0A0
  viewExit: 0x3e07b, // 0x3E0A0
  partyCreate: 0x0b133, // the function table DS:0553 + 0x2A·i; 0x36A1C
  partyDrop: 0x0b15d, // 0x36A1C
  partyModify: 0x0b187, // 0x36A1C
  partyTrain: 0x0b1b1, // 0x36A1C
  partyChangeClass: 0x0b1db, // Human Change Classes, hot key H (0x36CEF); 0x36A1C
  partyView: 0x0b205, // 0x36A1C
  partyAdd: 0x0b22f, // 0x36A1C
  partyRemove: 0x0b259, // 0x36A1C
  partyLoad: 0x0b283, // 0x36A1C
  partySave: 0x0b2ad, // 0x36A1C
  partyBegin: 0x0b2d7, // 0x36A1C
  partyExit: 0x0b301, // 0x36A1C
  modify: 0x39076, // 0x39080
  iconMain: 0x0b32c, // the icon editor's menus, DS:0723 + 0x29·level (level 1); 0x3A716
  iconHeadWeapon: 0x0b355, // level 2; 0x3A716
  iconParts: 0x0b37e, // level 3 (xxxx: Hair or Face); 0x3A716
  iconEdit: 0x0b3d0, // level 5; 0x3A716
  iconSmall: 0x3a6bb, // level 4's first word, when large; 0x3A716
  iconLarge: 0x3a6c1, // when small; 0x3A716
  iconHair: 0x3a6da, // level 3's third word, colour 1; 0x3A716
  iconFace: 0x3a6df, // colour 2; 0x3A716
}
