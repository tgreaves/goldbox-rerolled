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
    play: (start) => import('./ui/explore').then((m) => m.showExplore(app, files, start, () => party(files))),
  })
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => `&#${ch.charCodeAt(0)};`)

async function showImport() {
  const stored: GameProfile[] = []
  for (const g of GAMES) if (await GameFiles.stored(g).catch(() => false)) stored.push(g)
  app.innerHTML = `
    <section class="import">
      <h1>GoldBox Rerolled</h1>
      <p>This port plays the SSI Gold Box games from the game files of your own copy (MS-DOS),
      for example the game's folder from the GOG release (the data files and <code>START.EXE</code>,
      which holds the sound effects and the rules tables). They stay on this device:
      nothing is uploaded, and after importing once the game works offline.</p>
      <ul>${GAMES.map((g) => `<li><em>${esc(g.name)}</em>: the <code>${g.folder}</code> folder${g.playable ? '' : ' (in progress: its assets can be viewed, not yet played)'}</li>`).join('')}</ul>
      ${stored.length ? `<div class="actions">${stored.map((g) => `<button data-game="${g.id}">${g.playable ? 'Play' : 'View'} ${esc(g.name)}</button>`).join('')}</div>` : ''}
      <div class="actions">
        <button class="primary" id="folder">Choose a game folder</button>
        <button id="files">Choose files</button>
      </div>
      <p class="muted" id="status"></p>
      <input type="file" id="dirInput" webkitdirectory multiple hidden />
      <input type="file" id="fileInput" multiple hidden />
    </section>`
  const status = app.querySelector<HTMLParagraphElement>('#status')!
  const dirInput = app.querySelector<HTMLInputElement>('#dirInput')!
  const fileInput = app.querySelector<HTMLInputElement>('#fileInput')!

  async function take(list: Iterable<File>) {
    status.textContent = 'Reading files…'
    const { game, files: picked } = await readPicked(list)
    if (!game) {
      status.textContent = `These are not the files of a game the port knows (${GAMES.map((g) => g.name).join(', ')}).`
      return
    }
    const files = new GameFiles(picked, game)
    if (!files.complete()) {
      status.textContent = `Found ${picked.size} ${game.name} files, but not the full set (the .DAX files are needed).`
      return
    }
    status.textContent = `Saving ${picked.size} ${game.name} files for offline use…`
    await GameFiles.save(game, picked)
    await open(files)
  }

  app.querySelectorAll<HTMLButtonElement>('[data-game]').forEach((b) => b.addEventListener('click', async () => {
    const g = GAMES.find((x) => x.id === b.dataset.game)!
    status.textContent = `Loading ${g.name}…`
    await open(await GameFiles.load(g))
  }))
  app.querySelector('#folder')!.addEventListener('click', () => dirInput.click())
  app.querySelector('#files')!.addEventListener('click', () => fileInput.click())
  dirInput.addEventListener('change', () => dirInput.files && take(dirInput.files))
  fileInput.addEventListener('change', () => fileInput.files && take(fileInput.files))
}

setupOffline()
start()
