// The running version, shown at the foot of the game list and in Settings so it is clear what is deployed.
const REPO = 'https://github.com/tgreaves/goldbox-rerolled'

/** "GoldBox Rerolled · abc1234 · built 2026-10-20", the commit linking to it on GitHub. */
export function versionHtml(): string {
  const b = typeof __BUILD__ === 'undefined' ? { commit: 'dev', dirty: false, date: '' } : __BUILD__
  const commit = /^[0-9a-f]{7,40}$/.test(b.commit) ? `<a href="${REPO}/commit/${b.commit}" target="_blank" rel="noopener">${b.commit}</a>` : b.commit
  return `GoldBox Rerolled · version ${commit}${b.dirty ? ' + local changes' : ''}${b.date ? ` · built ${b.date}` : ''}`
}

/** "92c4939 · 2026-10-25" (a "+" after the commit for a build with changes not committed): the corner tag */
export function versionShort(): string {
  const b = typeof __BUILD__ === 'undefined' ? { commit: 'dev', dirty: false, date: '' } : __BUILD__
  return `${b.commit}${b.dirty ? '+' : ''}${b.date ? ` · ${b.date}` : ''}`
}

/** The running version in a corner of every screen (IMP-106): what is deployed is always in sight, and in screenshots. */
export function mountVersionTag() {
  if (document.querySelector('.buildtag')) return
  const t = document.createElement('div')
  t.className = 'buildtag'
  t.textContent = versionShort()
  t.setAttribute('aria-hidden', 'true')
  document.body.append(t)
  // an open dialog sits above the page (the top layer): it draws the same tag (style.css, dialog[open]::before)
  document.documentElement.style.setProperty('--build', JSON.stringify(versionShort()))
}
