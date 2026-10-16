// Party screen ("Choose a function", FUN_417f_0161; spec/architecture.md, Party screen).
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter } from '../data/character'
import { deleteCharacter, getParty, listCharacters, seedRoster, setParty } from '../store/user'
import { escape, sheetHtml } from './sheet'
import { unexepack } from '../data/exepack'
import { Tables, fileStem } from '../rules/chargen'
import { creatorTools } from './creator'
import { saveCharacter, listSaves } from '../store/user'
import { parseSave, saveArea, saveBlock } from '../data/save'
import type { Start } from './explore'

const MAX_PARTY = 6

export async function showParty(app: HTMLElement, files: GameFiles, nav: {
  title: () => void
  assets: () => void
  play: (start: Start) => void
}) {
  await seedRoster(files)
  let roster = await listCharacters()
  let party = (await getParty()).filter((s) => roster.some((c) => c.stem === s))
  let current = 0
  let tables: Tables | null = null
  try {
    const exe = files.get('START.EXE')
    if (exe) tables = new Tables(unexepack(exe).image)
  } catch { /* START.EXE unreadable: Create stays disabled */ }
  const rng = (n: number) => Math.floor(Math.random() * n)

  app.innerHTML = `
    <div class="partyscreen">
      <header><h1>Pool of Radiance</h1><button class="muted" data-a="assets">Assets</button></header>
      <section class="members" aria-label="Party"><h2>Party</h2><table><tbody></tbody></table></section>
      <section class="info" aria-live="polite"></section>
      <nav class="functions" aria-label="Choose a function"></nav>
      <dialog class="panel"></dialog>
    </div>`
  const tbody = app.querySelector<HTMLTableSectionElement>('.members tbody')!
  const info = app.querySelector<HTMLElement>('.info')!
  const nav2 = app.querySelector<HTMLElement>('.functions')!
  const dialog = app.querySelector<HTMLDialogElement>('dialog')!

  const byStem = (s: string) => roster.find((c) => c.stem === s)!
  const say = (t: string) => { info.textContent = t }

  function draw() {
    current = Math.min(current, Math.max(0, party.length - 1))
    tbody.innerHTML = party.length
      ? party.map((s, i) => {
          const c = parseCharacter(byStem(s).sav)
          return `<tr data-i="${i}" class="${i === current ? 'current' : ''}"><td>${escape(c.name)}</td>
            <td>${c.race}</td><td>${c.cls}</td><td>AC ${c.ac}</td><td>HP ${c.hp}</td></tr>`
        }).join('')
      : '<tr><td class="muted">No characters in the party. Create or Add one.</td></tr>'
    const has = party.length > 0
    const items: [string, string, boolean][] = [
      ['C', 'Create character', tables !== null],
      ['D', 'Drop character', has],
      ['M', 'Modify character', has && tables !== null],
      ['T', 'Train character', false],
      ['V', 'View character', has],
      ['A', 'Add character', party.length < MAX_PARTY && roster.some((c) => !party.includes(c.stem))],
      ['R', 'Remove character', has],
      ['L', 'Load saved game', true],
      ['S', 'Save current game', false],
      ['B', 'Begin adventuring', has],
      ['E', 'Exit', true],
    ]
    nav2.innerHTML = items.map(([k, label, on]) =>
      `<button data-k="${k}" ${on ? '' : 'disabled'}><u>${label[0]}</u>${label.slice(1)}</button>`).join('')
  }

  const { chooseFrom, confirm, pick, create, modify } = creatorTools(dialog, files, rng, tables)

  async function act(k: string) {
    if (dialog.open) return
    const btn = nav2.querySelector<HTMLButtonElement>(`[data-k="${k}"]`)
    if (!btn || btn.disabled) return
    const cur = party[current]
    switch (k) {
      case 'C': {
        const c = tables ? await create(tables) : null
        if (!c) break
        // saved as its own character file; the original then needs Add to put it in the party
        const name = parseCharacter(c).name
        await saveCharacter({ stem: fileStem(name), sav: c })
        roster = await listCharacters()
        say(`${name} has been created. Use Add to put them in the party.`)
        break
      }
      case 'M': {
        const c = byStem(cur).sav.slice()
        if ((c[0xac] | c[0xad] | c[0xae] | c[0xaf]) !== 0) say(`${parseCharacter(c).name} can't be modified.`)
        else if (await modify(c)) {
          await saveCharacter({ ...byStem(cur), sav: c })
          roster = await listCharacters()
          say(`${parseCharacter(c).name} has been modified.`)
        }
        break
      }
      case 'V':
        dialog.innerHTML = sheetHtml(parseCharacter(byStem(cur).sav)) + '<form method="dialog"><button>Close</button></form>'
        dialog.showModal()
        break
      case 'A': {
        const c = await chooseFrom('Add character', roster.filter((r) => !party.includes(r.stem)))
        if (c) {
          party.push(c.stem)
          current = party.length - 1
          await setParty(party)
          say(`${parseCharacter(c.sav).name} joins the party.`)
        }
        break
      }
      case 'R': {
        const name = parseCharacter(byStem(cur).sav).name
        party.splice(current, 1)
        await setParty(party)
        say(`${name} leaves the party (still available to Add).`)
        break
      }
      case 'D': {
        const name = parseCharacter(byStem(cur).sav).name
        if (await confirm(`${name} will be gone forever. Drop this character?`)) {
          await deleteCharacter(cur)
          party.splice(current, 1)
          await setParty(party)
          roster = await listCharacters()
          say(`${name} has been dropped.`)
        }
        break
      }
      case 'B':
        nav.play({ kind: 'new', party: party.map(byStem) })
        return
      case 'L': {
        // browser saves first, then the saves that came with the game files
        const saves = (await listSaves()).map((g) => ({ title: `${g.slot}: ${g.label}`, note: new Date(g.savedAt).toLocaleString(),
          start: { kind: 'load' as const, dat: g.dat, party: g.chars, label: `slot ${g.slot}, ${g.label}`, known: g.known } }))
        for (const slot of 'ABCDEFGHIJ') {
          const dat = files.get(`SAVGAM${slot}.DAT`)
          if (!dat) continue
          const sv = parseSave(dat)
          const chars = sv.party.map((st) => ({ sav: files.get(`${st}.SAV`)!, itm: files.get(`${st}.ITM`), spc: files.get(`${st}.SPC`) }))
          if (chars.some((c) => !c.sav)) continue
          const names = chars.map((c) => parseCharacter(c.sav).name)
          saves.push({ title: `${slot} (game files): ${names[0]}'s party`, note: `block ${saveBlock(sv)} area ${saveArea(sv)}`,
            start: { kind: 'load', dat, party: chars, label: `game-file save ${slot}`, known: undefined } })
        }
        if (!saves.length) { say('There are no saved games.'); break }
        const i = await pick('Load saved game', saves.map((g) => `${g.title} — ${g.note}`))
        if (i === null) break
        nav.play(saves[i].start)
        return
      }
      case 'E':
        nav.title()
        return
    }
    draw()
  }

  nav2.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button')
    if (b?.dataset.k) act(b.dataset.k)
  })
  tbody.addEventListener('click', (e) => {
    const row = (e.target as HTMLElement).closest('tr')
    if (row?.dataset.i === undefined) return
    const i = Number(row.dataset.i)
    if (i === current) act('V')
    else { current = i; draw() }
  })
  app.querySelector('[data-a="assets"]')!.addEventListener('click', () => { window.removeEventListener('keydown', onKey); nav.assets() })
  const onKey = (e: KeyboardEvent) => {
    if (dialog.open) {
      if (document.activeElement instanceof HTMLInputElement) return
      // hotkeys inside dialogs: Y/N, H/B/K, or a number for list entries
      const k = e.key.toLowerCase()
      const b = dialog.querySelector<HTMLButtonElement>(`button[value="${k}"]`)
        ?? (/^[1-9]$/.test(k) ? dialog.querySelectorAll<HTMLButtonElement>('ol button')[Number(k) - 1] : null)
      if (b) {
        e.preventDefault()
        b.click()
      }
      return
    }
    if (!app.contains(nav2)) { window.removeEventListener('keydown', onKey); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      current = (current + (e.key === 'ArrowDown' ? 1 : party.length - 1)) % Math.max(1, party.length)
      draw()
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) act(e.key.toUpperCase())
  }
  window.addEventListener('keydown', onKey)
  say('Choose a function.')
  draw()
}
