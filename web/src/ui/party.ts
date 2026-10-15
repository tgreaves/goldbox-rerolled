// Party screen ("Choose a function", FUN_417f_0161; spec/architecture.md, Party screen).
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter } from '../data/character'
import { deleteCharacter, getParty, listCharacters, seedRoster, setParty, type StoredCharacter } from '../store/user'
import { escape, sheetHtml } from './sheet'
import { unexepack } from '../data/exepack'
import { parseRecord, toImageData } from '../data/image'
import { RACES, CLASSES, ALIGNMENTS } from '../data/character'
import { RACE_MENU, Tables, alignmentsFor, begin, bodyRecord, classesFor, fileStem, headRecord, rollAbilities, setName } from '../rules/chargen'
import { saveCharacter } from '../store/user'

const MAX_PARTY = 6

export async function showParty(app: HTMLElement, files: GameFiles, nav: {
  title: () => void
  assets: () => void
  play: (party: StoredCharacter[]) => void
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
      ['M', 'Modify character', false],
      ['T', 'Train character', false],
      ['V', 'View character', has],
      ['A', 'Add character', party.length < MAX_PARTY && roster.some((c) => !party.includes(c.stem))],
      ['R', 'Remove character', has],
      ['L', 'Load saved game', false],
      ['S', 'Save current game', false],
      ['B', 'Begin adventuring', has],
      ['E', 'Exit', true],
    ]
    nav2.innerHTML = items.map(([k, label, on]) =>
      `<button data-k="${k}" ${on ? '' : 'disabled'}><u>${label[0]}</u>${label.slice(1)}</button>`).join('')
  }

  function chooseFrom(title: string, list: StoredCharacter[]): Promise<StoredCharacter | null> {
    return new Promise((resolve) => {
      dialog.innerHTML = `<h2>${title}</h2><ol class="pick">${list.map((c, i) => {
        const p = parseCharacter(c.sav)
        return `<li><button data-i="${i}">${escape(p.name)} <span class="muted">${p.race} ${p.cls}, level ${p.levels.map((l) => l.level).join('/')}</span></button></li>`
      }).join('')}</ol><form method="dialog"><button>Cancel</button></form>`
      dialog.querySelectorAll<HTMLButtonElement>('ol button').forEach((b) => b.addEventListener('click', () => {
        dialog.close()
        resolve(list[Number(b.dataset.i)])
      }))
      dialog.addEventListener('close', () => resolve(null), { once: true })
      dialog.showModal()
    })
  }

  function confirm(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      dialog.innerHTML = `<p>${escape(text)}</p><form method="dialog" class="yn"><button value="y" class="primary"><u>Y</u>es</button><button value="n"><u>N</u>o</button></form>`
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'y'), { once: true })
      dialog.showModal()
    })
  }

  /** A vertical list ("Pick Race" etc.); resolves to the index, or null on Exit/Esc (abandons creation). */
  function pick(title: string, items: string[]): Promise<number | null> {
    return new Promise((resolve) => {
      let done = false
      dialog.innerHTML = `<h2>${title}</h2><ol class="pick">${items.map((t, i) =>
        `<li><button data-i="${i}">${escape(t)}</button></li>`).join('')}</ol><form method="dialog"><button>Exit</button></form>`
      dialog.querySelectorAll<HTMLButtonElement>('ol button').forEach((b) => b.addEventListener('click', () => {
        done = true
        dialog.close()
        resolve(Number(b.dataset.i))
      }))
      dialog.addEventListener('close', () => { if (!done) resolve(null) }, { once: true })
      dialog.showModal()
      dialog.querySelector<HTMLButtonElement>('ol button')?.focus()
    })
  }

  function picture(family: string, id: number) {
    const raw = files.record(family, id)
    return raw ? parseRecord(raw).frames[0].picture : null
  }

  /** Character creation (FUN_417f_056c; spec/chargen.md). */
  async function create(t: Tables) {
    const r = await pick('Pick Race', RACE_MENU.map((i) => RACES[i]))
    if (r === null) return
    const race = RACE_MENU[r]
    const g = await pick('Pick Gender', ['Male', 'Female'])
    if (g === null) return
    const classes = classesFor(t, race)
    const ci = await pick('Pick Class', classes.map((i) => CLASSES[i]))
    if (ci === null) return
    const cls = classes[ci]
    const aligns = alignmentsFor(t, cls)
    const ai = await pick('Pick Alignment', aligns.map((i) => ALIGNMENTS[i]))
    if (ai === null) return
    const c = begin(t, rng, race, g, cls, aligns[ai])
    // roll until kept
    for (;;) {
      rollAbilities(t, rng, c)
      dialog.innerHTML = sheetHtml(parseCharacter(c)) +
        `<form method="dialog" class="yn"><span>Keep this character?</span><button value="y" class="primary"><u>Y</u>es</button><button value="n"><u>N</u>o, roll again</button></form>`
      const keep = await new Promise<boolean>((resolve) => {
        dialog.addEventListener('close', () => resolve(dialog.returnValue === 'y'), { once: true })
        dialog.showModal()
      })
      if (keep) break
    }
    // name: up to 15 characters, upper case, asked again while empty
    let name = ''
    while (!name) {
      name = await new Promise<string>((resolve) => {
        dialog.innerHTML = `<form method="dialog" class="namebox"><label>Character name: <input maxlength="15" autocomplete="off"></label><button class="primary">OK</button></form>`
        const input = dialog.querySelector('input')!
        dialog.addEventListener('close', () => resolve(input.value.toUpperCase().replace(/[^ -z]/g, '').trim()), { once: true })
        dialog.showModal()
        input.focus()
      })
    }
    setName(c, name)
    // portrait: Head / Body cycle forward (HEAD3, BODY3 records from DS:286F / DS:287D), Keep
    await new Promise<void>((resolve) => {
      dialog.innerHTML = `<h2>${escape(name)}</h2><canvas class="pixel portrait" width="88" height="88"></canvas>
        <form method="dialog" class="yn"><button value="h"><u>H</u>ead</button><button value="b"><u>B</u>ody</button><button value="k" class="primary"><u>K</u>eep</button></form>`
      const canvas = dialog.querySelector('canvas')!
      const draw = () => {
        const g2 = canvas.getContext('2d')!
        g2.fillStyle = '#000'
        g2.fillRect(0, 0, 88, 88)
        const head = picture('HEAD3', headRecord(t, c[0xbb])), body = picture('BODY3', bodyRecord(t, c[0xbc]))
        if (head) g2.putImageData(toImageData(head), 0, 0)
        if (body) g2.putImageData(toImageData(body), 0, 40)
      }
      dialog.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.addEventListener('click', (e) => {
        if (b.value === 'k') return
        e.preventDefault()
        if (b.value === 'h') c[0xbb] = (c[0xbb] % 14) + 1
        else c[0xbc] = (c[0xbc] % 12) + 1
        draw()
      }))
      dialog.addEventListener('close', () => resolve(), { once: true })
      draw()
      dialog.showModal()
    })
    // saved as its own character file; the original then needs Add to put it in the party
    const stem = fileStem(name)
    await saveCharacter({ stem, sav: c })
    roster = await listCharacters()
    say(`${name} has been created. Use Add to put them in the party.`)
  }

  async function act(k: string) {
    if (dialog.open) return
    const btn = nav2.querySelector<HTMLButtonElement>(`[data-k="${k}"]`)
    if (!btn || btn.disabled) return
    const cur = party[current]
    switch (k) {
      case 'C':
        if (tables) await create(tables)
        break
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
        nav.play(party.map(byStem))
        return
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
