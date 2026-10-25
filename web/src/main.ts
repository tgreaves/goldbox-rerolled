import { installNames } from './data/character'
import { installText } from './data/gametext'
import { unexepack } from './data/exepack'
import './style.css'
import '@fontsource/eb-garamond/latin-400.css'
import '@fontsource/eb-garamond/latin-400-italic.css'
import '@fontsource/eb-garamond/latin-600.css'
import { GameFiles, readPicked } from './store/gamefiles'
import { GAMES, lastGame, setGame, type GameProfile } from './games/profile'
import { showViewer } from './ui/viewer'
import { showTitle } from './ui/title'
import { showParty } from './ui/party'
import { setupOffline } from './pwa/register'
import { installGameFont } from './ui/gamefont'
import { installFrames } from './ui/frames'
import { applyPartyLayout, applyScreen, applyTextSize } from './ui/settings'
import { applyGfxClass } from './render/upscale'
import { startGamepad } from './ui/gamepad'
import { initAccount, onSettingsPulled, startAccount } from './store/account'
import { mountAccount } from './ui/account'
import { versionHtml } from './version'
import { setSoundDevice, soundDevice, toggleMute } from './audio/sfx'
import { generator } from './rules/dice'
import { parseRecord, toImageData } from './data/image'
import { blit, sizeCanvas } from './render/upscale'

const app = document.querySelector<HTMLDivElement>('#app')!
/**
 * The page's one dice source (spec/B-model/host-contracts.md §6): character creation on the party
 * screen and every engine the page starts draw from it, seeded from the clock.
 */
const dice = generator()

// Ctrl-S turns the sound off and on again on every screen, as the original's key reader does
// (spec/C-port/audio.md §2); it replaces the browser's "save page"
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && !e.altKey && !e.metaKey && !e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); toggleMute() }
}, true)

async function start() {
  applyTextSize()
  applyPartyLayout()
  applyScreen()
  applyGfxClass()
  startGamepad()
  // settings that came with the account (IMP-072): apply what can change without a reload
  onSettingsPulled(() => {
    applyTextSize()
    applyPartyLayout()
    applyScreen()
    let v: string | null = null
    try { v = localStorage.getItem('poolrad.sound') } catch { /* storage unavailable */ }
    setSoundDevice(v === 'tandy' || v === 'off' ? v : v === 'pc' ? 'pc' : soundDevice())
  })
  // the game played last, else the first one with files stored
  for (const g of new Set([lastGame(), ...GAMES].filter((x): x is GameProfile => !!x))) {
    if (await GameFiles.stored(g)) return open(await GameFiles.load(g))
  }
  showImport()
}

async function open(files: GameFiles) {
  setGame(files.game)
  void startAccount(files.game) // sync this game's saves and roster when signed in (IMP-072)
  document.title = `GoldBox Rerolled: ${files.game.name}`
  const exe = files.get('START.EXE')
  if (exe) try { installNames(unexepack(exe).image) } catch { /* names show as #n */ }
  installText(exe, files.get('GAME.OVR')) // the game's messages, read by address (spec/D-appendices/strings.md)
  await installGameFont(files)
  installFrames(files)
  if (files.game.playable) title(files)
  else showViewer(app, files, showImport)
}

/** The title sequence, then the party screen. */
function title(files: GameFiles) {
  showTitle(app, files, () => party(files))
}

function party(files: GameFiles) {
  // the game's demo (games/startup.ts), offered on the party screen instead of the original's start-up
  // menu (IMP-074); it comes back to the party screen
  const demo = files.game.startMenu?.demo
  showParty(app, files, dice, {
    title: () => title(files),
    assets: () => showViewer(app, files, showImport, () => party(files)),
    games: showImport,
    play: (start) => import('./ui/explore').then((m) => m.showExplore(app, files, start, () => party(files), dice)),
    demo: demo ? () => import('./ui/explore').then((m) => m.showExplore(app, files, { kind: 'demo', demo }, () => party(files), dice)) : undefined,
  })
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)

/** The games screen: every game the port knows, with Play, Import and Remove; also the first-run import. */
async function showImport() {
  document.title = 'GoldBox Rerolled'
  const stored = new Map<string, boolean>()
  for (const g of GAMES) stored.set(g.id, await GameFiles.stored(g).catch(() => false))
  const any = [...stored.values()].some(Boolean)
  // the entry screen in the colours of the games' boxes (IMP-093): parchment, red ink, gold on charcoal
  app.innerHTML = `
    <section class="import entry parchment">
      <div class="box">
      <header class="plaque"><h1>GoldBox <span>Rerolled</span></h1></header>
      <p class="lede">This port plays the SSI Gold Box games from the game files of your own copy (MS-DOS),
      for example the game's folder from the GOG release (the data files and <code>START.EXE</code>,
      which holds the sound effects and the rules tables). They stay on this device:
      nothing is uploaded, and after importing once the game works offline.</p>
      <h2 class="rubric">Your games</h2>
      <ul class="games">${GAMES.map((g) => `<li class="${stored.get(g.id) ? 'stored' : ''}">
        ${stored.get(g.id) ? `<canvas class="cover" data-cover="${g.id}" width="320" height="200" role="img" aria-label="${esc(g.name)}: the title screen"></canvas>`
          : `<div class="cover blank" aria-hidden="true"><span>◆</span></div>`}
        <div class="ginfo"><div><strong>${esc(g.name)}</strong> <span class="muted">${stored.get(g.id) ? 'imported' : `not imported: choose its <code>${g.folder}</code> folder`}${g.note ? ` · ${esc(g.note)}` : ''}${g.playable ? '' : ' · assets only'}</span></div>
        <div class="actions">
          ${stored.get(g.id) ? `<button class="primary" data-play="${g.id}">${g.playable ? 'Play' : 'View'}</button>` : ''}
          <button data-import="${g.id}">${stored.get(g.id) ? 'Re-import' : 'Import'}</button>
          ${stored.get(g.id) ? `<button class="muted" data-remove="${g.id}" title="Forget this game's files (characters and saves are kept)">Remove</button>` : ''}
        </div></div></li>`).join('')}</ul>
      <div class="actions"><button class="${any ? '' : 'primary'}" id="folder">Choose a game folder</button> <button id="files" title="For browsers without a folder picker">Choose files</button></div>
      <p class="muted" id="status"></p>
      <section class="account-sec account-top" aria-label="Account"></section>
      <footer class="version muted small">${versionHtml()}</footer>
      </div>
      <input type="file" id="dirInput" webkitdirectory multiple hidden />
      <input type="file" id="fileInput" multiple hidden />
    </section>`
  const status = app.querySelector<HTMLParagraphElement>('#status')!
  // each imported game's cover: its title screen with the game's name (profile title.cover), from TITLE.DAX alone
  for (const c of app.querySelectorAll<HTMLCanvasElement>('canvas[data-cover]')) {
    const g = GAMES.find((x) => x.id === c.dataset.cover)!
    void GameFiles.loadSome(g, ['TITLE.DAX']).then((files) => {
      const pics = files ? g.title.cover.map((p) => {
        const d = files.record('TITLE', p.record)
        try { return d ? { pic: parseRecord(d).frames[0].picture, x: p.x, y: p.y } : null } catch { return null }
      }) : []
      if (!pics.length || pics.some((p) => !p)) { c.replaceWith(Object.assign(document.createElement('div'), { className: 'cover blank', innerHTML: '<span>◆</span>' })); return }
      const g2 = sizeCanvas(c, 320, 200)
      for (const p of pics) blit(g2, toImageData(p!.pic), p!.x, p!.y)
      c.classList.add('drawn')
    }).catch(() => { /* the blank cover stays */ })
  }
  // sign in or create an account before any game is open (IMP-072); after the games, which most come for;
  // hidden when no server answers
  const acct = app.querySelector<HTMLElement>('.account-sec')!
  mountAccount(acct, false)
  void initAccount()
  const dirInput = app.querySelector<HTMLInputElement>('#dirInput')!
  const fileInput = app.querySelector<HTMLInputElement>('#fileInput')!
  let expected: GameProfile | null = null

  async function take(list: Iterable<File>) {
    status.textContent = 'Reading files…'
    const { game, files: picked } = await readPicked(list)
    if (!game) {
      status.textContent = `These are not the files of a game the port knows (${GAMES.map((g) => g.name).join(', ')}).`
      return
    }
    if (expected && game !== expected) status.textContent = `These are ${game.name} files, not ${expected.name}: importing them as ${game.name}.`
    const files = new GameFiles(picked, game)
    if (!files.complete()) {
      status.textContent = `Found ${picked.size} ${game.name} files, but not the full set (the .DAX files are needed).`
      return
    }
    status.textContent = `Saving ${picked.size} ${game.name} files for offline use…`
    await GameFiles.save(game, picked)
    await open(files)
  }
  const pick = () => { dirInput.value = ''; dirInput.click() }
  fileInput.addEventListener('click', () => { fileInput.value = '' })

  app.querySelectorAll<HTMLButtonElement>('[data-play]').forEach((b) => b.addEventListener('click', async () => {
    const g = GAMES.find((x) => x.id === b.dataset.play)!
    status.textContent = `Loading ${g.name}…`
    await open(await GameFiles.load(g))
  }))
  app.querySelectorAll<HTMLButtonElement>('[data-import]').forEach((b) => b.addEventListener('click', () => {
    expected = GAMES.find((x) => x.id === b.dataset.import) ?? null
    status.textContent = expected ? `Choose the ${expected.folder} folder of ${expected.name}.` : ''
    pick()
  }))
  app.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((b) => b.addEventListener('click', async () => {
    const g = GAMES.find((x) => x.id === b.dataset.remove)!
    if (!confirm(`Remove ${g.name}'s game files from this browser? Its characters and saved games are kept, and come back when you import it again.`)) return
    await GameFiles.remove(g)
    showImport()
  }))
  app.querySelector('#folder')?.addEventListener('click', pick)
  app.querySelector('#files')?.addEventListener('click', () => fileInput.click())
  dirInput.addEventListener('change', () => dirInput.files && take(dirInput.files))
  fileInput.addEventListener('change', () => fileInput.files && take(fileInput.files))
}

setupOffline()
start()
