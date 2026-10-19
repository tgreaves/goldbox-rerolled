// Pool of Radiance (1988), the port's first game.
import type { GameProfile } from './types'
import { POR_FIELDS } from './fields'

export const POR: GameProfile = {
  id: 'por',
  name: 'Pool of Radiance',
  folder: 'POOLRAD',
  config: 'POOL.CFG',
  markers: ['GEO1.DAX', 'SQRPACI.DAX', 'BACPAC.DAX'],
  required: ['ECL1.DAX', 'GEO1.DAX', '8X8D1.DAX', 'WALLDEF1.DAX'],
  wanted(name) {
    const n = name.toUpperCase()
    return n.endsWith('.DAX') || n === 'ITEMS' || n === 'START.EXE' || n === 'POOL.CFG' || /^CHRDAT.+\.(SAV|ITM|SPC)$/.test(n) || /^SAVGAM.\.DAT$/.test(n)
  },
  // the names used before there was more than one game, so existing imports and saves stay where they are
  stores: { files: 'poolrad', user: 'poolrad-user' },
  imageFamilies: ['TITLE', 'PIC', 'FINAL', 'SPRIT', 'HEAD', 'BODY', 'CHEAD', 'CBODY', 'CPIC',
    'ICON', 'COMSPR', 'SQRPACI', 'BACPAC', 'DUNGCOM', 'WILDCOM', 'RANDCOM', '8X8D'],
  fields: POR_FIELDS,
  playable: true,
}
