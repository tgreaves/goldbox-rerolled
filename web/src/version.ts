// The running version, shown at the foot of the game list and in Settings so it is clear what is deployed.
const REPO = 'https://github.com/tgreaves/goldbox-rerolled'

/** "GoldBox Rerolled · abc1234 · built 2026-10-20", the commit linking to it on GitHub. */
export function versionHtml(): string {
  const b = typeof __BUILD__ === 'undefined' ? { commit: 'dev', dirty: false, date: '' } : __BUILD__
  const commit = /^[0-9a-f]{7,40}$/.test(b.commit) ? `<a href="${REPO}/commit/${b.commit}" target="_blank" rel="noopener">${b.commit}</a>` : b.commit
  return `GoldBox Rerolled · version ${commit}${b.dirty ? ' + local changes' : ''}${b.date ? ` · built ${b.date}` : ''}`
}
