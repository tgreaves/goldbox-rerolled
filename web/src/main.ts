import './style.css'
import { GameFiles, readPicked } from './store/gamefiles'
import { showViewer } from './ui/viewer'
import { setupOffline } from './pwa/register'

const app = document.querySelector<HTMLDivElement>('#app')!

async function start() {
  const files = await GameFiles.load()
  if (files.complete()) showViewer(app, files, showImport)
  else showImport()
}

function showImport() {
  app.innerHTML = `
    <section class="import">
      <h1>Pool of Radiance</h1>
      <p>This port needs the game files from your own copy of <em>Pool of Radiance</em> (MS-DOS),
      for example the <code>POOLRAD</code> folder from the GOG release (the data files and <code>START.EXE</code>,
      which holds the sound effects). They stay on this device:
      nothing is uploaded, and after importing once the game works offline.</p>
      <div class="actions">
        <button class="primary" id="folder">Choose the POOLRAD folder</button>
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
    const picked = await readPicked(list)
    const files = new GameFiles(picked)
    if (!files.complete()) {
      status.textContent = `Found ${picked.size} game files, but not the full set (the .DAX files are needed).`
      return
    }
    status.textContent = `Saving ${picked.size} files for offline use…`
    await GameFiles.save(picked)
    showViewer(app, files, showImport)
  }

  app.querySelector('#folder')!.addEventListener('click', () => dirInput.click())
  app.querySelector('#files')!.addEventListener('click', () => fileInput.click())
  dirInput.addEventListener('change', () => dirInput.files && take(dirInput.files))
  fileInput.addEventListener('change', () => fileInput.files && take(fileInput.files))
}

setupOffline()
start()
