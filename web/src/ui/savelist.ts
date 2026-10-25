// The save lists' rows (IMP-104): Load, Save and Export show each save with a picture of the party's
// view, where they were in the game's own words, the party, and the game's day and time beside the date.
// The clues are taken when the save is made and kept in its .GBR sidecar (`info`); a save without them
// (an older one, or the game's own) shows what it has.
import { parseCharacter } from '../data/character'
import { escape } from './sheet'

/** what a save made by the port carries for the lists */
export interface SaveInfo {
  /** the game's last line printed while the party moved (an area's or a square's description) */
  place?: string
  /** "Day n · hh:mm", the game's clock */
  time?: string
  /** the party's view drawn small (the original's 88 × 88 view), as a PNG data URL */
  thumb?: string
}

/** The sidecar's `info`, checked: anything malformed is left out. */
export function readSaveInfo(v: unknown): SaveInfo | undefined {
  if (!v || typeof v !== 'object') return undefined
  const r = v as Record<string, unknown>
  const out: SaveInfo = {}
  if (typeof r.place === 'string') out.place = r.place.slice(0, 300)
  if (typeof r.time === 'string') out.time = r.time.slice(0, 40)
  if (typeof r.thumb === 'string' && r.thumb.startsWith('data:image/png;base64,') && r.thumb.length < 40_000) out.thumb = r.thumb
  return Object.keys(out).length ? out : undefined
}

/** "Threnderr Grone F 1 · Bakshi C/F/MU 1/1/1 …" and the party's HP: who is in it, at a glance */
export function partySummary(savs: Uint8Array[]): { who: string; hp: string } {
  const ch = savs.filter(Boolean).map((s) => parseCharacter(s))
  const short = (cls: string) => cls.split('/').map((c) => c.split(/[- ]/).map((w) => w[0] ?? '').join('').toUpperCase()).join('/')
  const who = ch.map((c) => `${c.name} ${short(c.cls)} ${c.levels.map((l) => l.level).join('/')}`).join(' · ')
  const hp = ch.length ? `HP ${ch.reduce((a, c) => a + c.hp, 0)}/${ch.reduce((a, c) => a + c.hpMax, 0)}` : ''
  return { who, hp }
}

export interface SaveRow { mark: string; kicker: string; title: string; note: string; info?: SaveInfo; party?: Uint8Array[] }

/** One save's row inside its button: the slot mark, the view, then what it is, the party, where, and when. */
export function saveRowHtml(r: SaveRow): string {
  const party = r.party?.length ? partySummary(r.party) : null
  const when = [r.note, r.info?.time].filter(Boolean).join(' · ')
  return `<span class="mark">${escape(r.mark)}</span>
    ${r.info?.thumb ? `<img class="save-thumb" src="${r.info.thumb}" alt="" width="88" height="88">` : '<span class="save-thumb none" aria-hidden="true"></span>'}
    <span class="sv"><small class="kicker">${escape(r.kicker)}</small><strong>${escape(r.title)}</strong>
      ${r.info?.place ? `<span class="save-place">${escape(r.info.place.toLowerCase())}</span>` : ''}
      ${party ? `<small class="save-party">${escape(party.who)}${party.hp ? ` · ${escape(party.hp)}` : ''}</small>` : ''}
      ${when ? `<small>${escape(when)}</small>` : ''}</span>`
}
