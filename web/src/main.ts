import { installNames } from './data/character'
import { unexepack } from './data/exepack'
import './style.css'
import { GameFiles, readPicked } from './store/gamefiles'
import { GAMES, lastGame, setGame, type GameProfile } from './games/profile'
import { showViewer } from './ui/viewer'
import { showTitle } from './ui/title'
import { showParty } from './ui/party'
import { setupOffline } from './pwa/register'
import { installGameFont } from './ui/gamefont'
import { installFrames } from './ui/frames'
import { applyPartyLayout, applyTextSize } from './ui/settings'
import { applyGfxClass } from './render/upscale'

const app = document.querySelector<HTMLDivElement>('#app')!

async function start() {
  applyTextSize()
  applyPartyLayout()
  applyGfxClass()
  // the game played last, else the first one with files stored
  for (const g of new Set([lastGame(), ...GAMES].filter((x): x is GameProfile => !!x))) {
    if (await GameFiles.stored(g)) return open(await GameFiles.load(g))
  }
  showImport()
}

async function open(files: GameFiles) {
  setGame(files.game)
  document.title = `GoldBox Rerolled: ${files.game.name}`
  const exe = files.get('START.EXE')
  if (exe) try { installNames(unexepack(exe).image) } catch { /* names show as #n */ }
  await installGameFont(files)
  installFrames(files)
  if (files.game.playable) title(files)
  else showViewer(app, files, showImport)
}

function title(files: GameFiles) {
  showTitle(app, files, () => party(files))
}

function party(files: GameFiles) {
  showParty(app, files, {
    title: () => title(files),
    assets: () => showViewer(app, files, showImport, () => party(files)),
    games: showImport,
    play: (start) => import('./ui/explore').then((m) => m.showExplore(app, files, start, () => party(files))),
  })
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)

/** The games screen: every game the port knows, with Play, Import and Remove; also the first-run import. */
async function showImport() {
  document.title = 'GoldBox Rerolled'
  const stored = new Map<string, boolean>()
  for (const g of GAMES) stored.set(g.id, await GameFiles.stored(g).catch(() => false))
  const any = [...stored.values()].some(Boolean)
  app.innerHTML = `
    <section class="import">
      <h1>GoldBox Rerolled</h1>
      <p>This port plays the SSI Gold Box games from the game files of your own copy (MS-DOS),
      for example the game's folder from the GOG release (the data files and <code>START.EXE</code>,
      which holds the sound effects and the rules tables). They stay on this device:
      nothing is uploaded, and after importing once the game works offline.</p>
      <ul class="games">${GAMES.map((g) => `<li>
        <div><strong>${esc(g.name)}</strong> <span class="muted">${stored.get(g.id) ? 'imported' : `not imported: choose its <code>${g.folder}</code> folder`}${g.note ? ` · ${esc(g.note)}` : ''}${g.playable ? '' : ' · assets only'}</span></div>
        <div class="actions">
          ${stored.get(g.id) ? `<button class="primary" data-play="${g.id}">${g.playable ? 'Play' : 'View'}</button>` : ''}
          <button data-import="${g.id}">${stored.get(g.id) ? 'Re-import' : 'Import'}</button>
          ${stored.get(g.id) ? `<button class="muted" data-remove="${g.id}" title="Forget this game's files (characters and saves are kept)">Remove</button>` : ''}
        </div></li>`).join('')}</ul>
      <div class="actions"><button class="${any ? '' : 'primary'}" id="folder">Choose a game folder</button> <button id="files" title="For browsers without a folder picker">Choose files</button></div>
      <p class="muted" id="status"></p>
      <input type="file" id="dirInput" webkitdirectory multiple hidden />
      <input type="file" id="fileInput" multiple hidden />
    </section>`
  const status = app.querySelector<HTMLParagraphElement>('#status')!
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
