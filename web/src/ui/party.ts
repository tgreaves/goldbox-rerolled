// Party screen ("Choose a function", FUN_417f_0161; spec/architecture.md, Party screen).
import type { GameFiles } from '../store/gamefiles'
import { parseCharacter } from '../data/character'
import { deleteCharacter, getParty, listCharacters, seedRoster, setParty, type StoredCharacter } from '../store/user'
import { escape, sheetHtml } from './sheet'
import { unexepack } from '../data/exepack'
import { parseRecord, toImageData } from '../data/image'
import { RACES, CLASSES, ALIGNMENTS } from '../data/character'
import { RACE_MENU, Tables, abilityRange, alignmentsFor, begin, bodyRecord, classesFor, combatStats, fileStem, headRecord, hpMax, hpMin, modifyStep, rollAbilities, setName } from '../rules/chargen'
import { buildIcon } from '../render/icon'
import { EGA, type Picture } from '../data/image'
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
      ['M', 'Modify character', has && tables !== null],
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
    // combat icon; "Is this icon ok?" is the Keep button
    await iconEditor(c)
    // saved as its own character file; the original then needs Add to put it in the party
    const stem = fileStem(name)
    await saveCharacter({ stem, sav: c })
    roster = await listCharacters()
    say(`${name} has been created. Use Add to put them in the party.`)
  }

  function paintIcon(canvas: HTMLCanvasElement, p: Picture | null) {
    const g2 = canvas.getContext('2d')!
    g2.fillStyle = '#000'
    g2.fillRect(0, 0, canvas.width, canvas.height)
    if (p) g2.putImageData(toImageData(p), 0, 0)
  }

  /** Combat icon editor (FUN_417f_382d), as one panel; returns false if cancelled. */
  function iconEditor(c: Uint8Array): Promise<boolean> {
    const kept = c.slice(0xbd, 0xc7)
    const PARTS = ['Body', 'Arm', 'Leg', 'Hair/Face', 'Shield', 'Weapon']
    let part = 0
    return new Promise((resolve) => {
      let done = false
      dialog.innerHTML = `<h2>Combat icon</h2>
        <div class="icons">
          <figure><canvas class="pixel ic" width="24" height="24"></canvas><canvas class="pixel ic" width="24" height="24"></canvas><figcaption>old: ready, action</figcaption></figure>
          <figure><canvas class="pixel ic" width="24" height="24"></canvas><canvas class="pixel ic" width="24" height="24"></canvas><figcaption>new: ready, action</figcaption></figure>
        </div>
        <div class="iconctl">
          <span>Head</span><button data-x="head-">◀</button><output data-o="head"></output><button data-x="head+">▶</button>
          <span>Weapon</span><button data-x="weapon-">◀</button><output data-o="weapon"></output><button data-x="weapon+">▶</button>
          <span>Size</span><button data-x="size" class="wide"></button>
        </div>
        <div class="parts">${PARTS.map((n, i) => `<button data-part="${i}">${n}</button>`).join('')}</div>
        <div class="palette"><span>Colour 1</span>${EGA.map((rgb, i) => `<button class="sw" data-c1="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
        <div class="palette"><span>Colour 2</span>${EGA.map((rgb, i) => `<button class="sw" data-c2="${i}" style="background:rgb(${rgb})" aria-label="colour ${i}"></button>`).join('')}</div>
        <form method="dialog" class="yn"><button value="e"><u>E</u>xit</button><button value="k" class="primary"><u>K</u>eep</button></form>`
      const [o1, o2, n1, n2] = [...dialog.querySelectorAll<HTMLCanvasElement>('canvas.ic')]
      const old = c.slice()
      paintIcon(o1, buildIcon(files, old, false))
      paintIcon(o2, buildIcon(files, old, true))
      const draw = () => {
        paintIcon(n1, buildIcon(files, c, false))
        paintIcon(n2, buildIcon(files, c, true))
        dialog.querySelector('[data-o="head"]')!.textContent = String(c[0xbd])
        dialog.querySelector('[data-o="weapon"]')!.textContent = String(c[0xbe])
        dialog.querySelector('[data-x="size"]')!.textContent = c[0xc0] === 2 ? 'Large' : 'Small'
        dialog.querySelectorAll<HTMLButtonElement>('[data-part]').forEach((b) => b.classList.toggle('on', Number(b.dataset.part) === part))
        dialog.querySelectorAll<HTMLButtonElement>('[data-c1]').forEach((b) => b.classList.toggle('on', Number(b.dataset.c1) === (c[0xc1 + part] & 0xf)))
        dialog.querySelectorAll<HTMLButtonElement>('[data-c2]').forEach((b) => b.classList.toggle('on', Number(b.dataset.c2) === c[0xc1 + part] >> 4))
      }
      const onClick = (e: MouseEvent) => {
        const b = (e.target as HTMLElement).closest('button')
        if (!b || b.closest('form')) return
        e.preventDefault()
        const x = b.dataset.x
        if (x === 'head+') c[0xbd] = (c[0xbd] + 1) % 14
        else if (x === 'head-') c[0xbd] = (c[0xbd] + 13) % 14
        else if (x === 'weapon+') c[0xbe] = (c[0xbe] + 1) % 32
        else if (x === 'weapon-') c[0xbe] = (c[0xbe] + 31) % 32
        else if (x === 'size') c[0xc0] = c[0xc0] === 2 ? 1 : 2
        else if (b.dataset.part) part = Number(b.dataset.part)
        else if (b.dataset.c1) c[0xc1 + part] = (c[0xc1 + part] & 0xf0) | Number(b.dataset.c1)
        else if (b.dataset.c2) c[0xc1 + part] = (c[0xc1 + part] & 0x0f) | (Number(b.dataset.c2) << 4)
        draw()
      }
      dialog.addEventListener('click', onClick)
      dialog.addEventListener('close', () => {
        dialog.removeEventListener('click', onClick)
        if (done) return
        done = true
        const keep = dialog.returnValue === 'k'
        if (!keep) c.set(kept, 0xbd)
        resolve(keep)
      }, { once: true })
      draw()
      dialog.showModal()
    })
  }

  /** Modify character (FUN_417f_209f): abilities and HP, only before any experience. */
  function modify(stem: string, c: Uint8Array): Promise<void> {
    const before = c.slice()
    const FIELDS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA', 'HP']
    let field = 0
    return new Promise((resolve) => {
      const t = tables!
      const draw = () => {
        const rows = FIELDS.map((n, f) => {
          const v = f === 6 ? c[0x32] : c[0x10 + f]
          const pct = f === 0 && c[0x10] === 18 && c[0x16] ? `/${String(c[0x16] % 100).padStart(2, '0')}` : ''
          const range = f === 6 ? `${hpMin(t, c)}–${hpMax(t, c)}` : abilityRange(t, c, f).join('–')
          return `<tr class="${f === field ? 'current' : ''}" data-f="${f}"><th>${n}</th>
            <td><button data-d="-1" aria-label="lower ${n}">−</button></td><td class="v">${v}${pct}</td>
            <td><button data-d="1" aria-label="raise ${n}">+</button></td><td class="muted">${range}</td></tr>`
        }).join('')
        dialog.querySelector('tbody')!.innerHTML = rows
      }
      dialog.innerHTML = `<h2>Modify ${escape(parseCharacter(c).name)}</h2>
        <table class="modify"><tbody></tbody></table>
        <form method="dialog" class="yn"><button value="e"><u>E</u>xit</button><button value="k" class="primary"><u>K</u>eep</button></form>`
      dialog.querySelector('tbody')!.addEventListener('click', (e) => {
        const b = (e.target as HTMLElement).closest('button')
        const row = (e.target as HTMLElement).closest('tr')
        if (!row) return
        field = Number(row.dataset.f)
        if (b) modifyStep(t, c, field, Number(b.dataset.d) as 1 | -1)
        draw()
      })
      const onArrow = (e: KeyboardEvent) => {
        if (!dialog.open) return
        const k = e.key
        if (k === 'ArrowDown' || k === '2') field = (field + 1) % 7
        else if (k === 'ArrowUp' || k === '8') field = (field + 6) % 7
        else if (k === 'ArrowRight' || k === '6') modifyStep(t, c, field, 1)
        else if (k === 'ArrowLeft' || k === '4') modifyStep(t, c, field, -1)
        else return
        e.preventDefault()
        e.stopPropagation()
        draw()
      }
      window.addEventListener('keydown', onArrow, true)
      dialog.addEventListener('close', async () => {
        window.removeEventListener('keydown', onArrow, true)
        if (dialog.returnValue === 'k') {
          c[0x85] = 1
          c[0x11b] = c[0x32]
          combatStats(c)
          await saveCharacter({ ...byStem(stem), sav: c })
          roster = await listCharacters()
          say(`${parseCharacter(c).name} has been modified.`)
        } else c.set(before)
        resolve()
      }, { once: true })
      draw()
      dialog.showModal()
    })
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
      case 'M': {
        const c = byStem(cur).sav.slice()
        if ((c[0xac] | c[0xad] | c[0xae] | c[0xaf]) !== 0) say(`${parseCharacter(c).name} can't be modified.`)
        else await modify(cur, c)
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
