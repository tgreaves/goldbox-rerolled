// Party screen ("Choose a function", FUN_417f_0161; spec/architecture.md, Party screen).
import type { GameFiles } from '../store/gamefiles'
import { joinRefusal } from '../rules/joining'
import { startEffects } from '../rules/chargen'
import { effectsFile } from '../data/effects'
import { parseCharacter } from '../data/character'
import { F } from '../games/fields'
import { deleteCharacter, getParty, listCharacters, seedRoster, setParty } from '../store/user'
import { escape, sheetHtml } from './sheet'
import { unexepack } from '../data/exepack'
import { Tables, bodyRecord, fileStem, headRecord } from '../rules/chargen'
import { parseRecord, toImageData } from '../data/image'
import { blit, sizeCanvas } from '../render/upscale'
import { buildIcon } from '../render/icon'
import { creatorTools } from './creator'
import { openSettings } from './settings'
import { enhancePanel } from './panel'
import { initSound } from '../audio/sfx'
import { saveCharacter, listSaves, writeSave, readAutosave, listConflicts } from '../store/user'
import { onPulled } from '../store/account'
import { importsFrom, rosterFrom, saveFiles, savesFrom, unzip, zip, type NamedFile } from '../store/savefiles'
import { parseSave, saveArea, saveBlock } from '../data/save'
import type { Start } from './explore'

const MAX_PARTY = 6

export async function showParty(app: HTMLElement, files: GameFiles, nav: {
  title: () => void
  assets: () => void
  /** the games screen: switch game, import another, remove one */
  games: () => void
  play: (start: Start) => void
}) {
  await seedRoster(files)
  let roster = await listCharacters()
  let auto = await readAutosave()
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
      <header><h1>${files.game.name}</h1><span><button class="muted" data-a="games" title="Switch game, import another, or remove one">⇄ Games</button> <button class="muted" data-a="settings">⚙ Settings</button> <button class="muted" data-a="assets">Assets</button></span></header>
      <section class="members" aria-label="Party"><h2>Party</h2><div class="cards"></div></section>
      <section class="info" aria-live="polite"></section>
      <nav class="functions" aria-label="Choose a function"></nav>
      <dialog class="panel"></dialog>
    </div>`
  const tbody = app.querySelector<HTMLElement>('.members .cards')!
  const info = app.querySelector<HTMLElement>('.info')!
  const nav2 = app.querySelector<HTMLElement>('.functions')!
  const dialog = app.querySelector<HTMLDialogElement>('dialog')!
  enhancePanel(dialog)

  const byStem = (s: string) => roster.find((c) => c.stem === s)!
  const say = (t: string) => { info.textContent = t }

  function draw() {
    current = Math.min(current, Math.max(0, party.length - 1))
    // party cards (IMP-045): portrait, combat icon, class and levels, HP bar, AC and status
    tbody.innerHTML = party.length
      ? party.map((s, i) => {
          const c = parseCharacter(byStem(s).sav)
          const pct = Math.round((100 * c.hp) / Math.max(1, c.hpMax))
          return `<button class="pcard${i === current ? ' current' : ''}" data-i="${i}" title="${i === current ? 'View' : 'Select'} ${escape(c.name)}">
            <canvas class="pixel pc-portrait" width="88" height="88"></canvas>
            <span class="pc-body"><strong>${escape(c.name)}</strong>
              <span>${c.race} ${c.cls}</span>
              <span class="muted">level ${c.levels.map((l) => l.level).join('/')} · AC ${c.ac} · ${c.status}</span>
              <span class="hpbar${pct < 50 ? ' low' : ''}"><span style="width:${pct}%"></span></span>
              <span class="muted">HP ${c.hp} / ${c.hpMax}</span></span>
            <canvas class="pixel pc-icon" width="24" height="24"></canvas></button>`
        }).join('')
      : '<p class="muted">No characters in the party. Create or Add one.</p>'
    tbody.querySelectorAll<HTMLElement>('.pcard').forEach((card) => {
      const raw = byStem(party[Number(card.dataset.i)]).sav
      const pic = (family: string, id: number) => { const r = files.record(family, id); try { return r ? parseRecord(r).frames[0].picture : null } catch { return null } }
      const port = sizeCanvas(card.querySelector<HTMLCanvasElement>('.pc-portrait')!, 88, 88)
      port.fillStyle = '#000'; port.fillRect(0, 0, 88, 88)
      if (tables) {
        const h = pic('HEAD3', headRecord(tables, raw[F.head])), b = pic('BODY3', bodyRecord(tables, raw[F.body]))
        if (h) blit(port, toImageData(h), 0, 0)
        if (b) blit(port, toImageData(b), 0, 40)
      }
      const ic = sizeCanvas(card.querySelector<HTMLCanvasElement>('.pc-icon')!, 24, 24), p = buildIcon(files, raw, false)
      ic.fillStyle = '#000'; ic.fillRect(0, 0, 24, 24)
      if (p) blit(ic, toImageData(p), 0, 0)
    })
    const has = party.length > 0
    const items: [string, string, boolean][] = [
      ...(auto ? [['O', `Continue (autosave, ${new Date(auto.savedAt).toLocaleString()})`, true] as [string, string, boolean]] : []),
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
      ['X', 'Export saved game', true],
      ['I', 'Import saved game', true],
      ['E', 'Exit', true],
    ]
    nav2.innerHTML = items.map(([k, label, on]) => {
      const at = Math.max(0, label.toUpperCase().indexOf(k))
      return `<button data-k="${k}" ${on ? '' : 'disabled'}>${label.slice(0, at)}<u>${label[at]}</u>${label.slice(at + 1)}</button>`
    }).join('')
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
        await saveCharacter({ stem: fileStem(name), sav: c, spc: effectsFile(startEffects(c)) })
        roster = await listCharacters()
        say(`${name} has been created. Use Add to put them in the party.`)
        break
      }
      case 'M': {
        const c = byStem(cur).sav.slice()
        if ((c[F.xp] | c[F.xp + 1] | c[F.xp + 2] | c[F.xp + 3]) !== 0) say(`${parseCharacter(c).name} can't be modified.`)
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
        const refused = c ? joinRefusal(party.map((s) => byStem(s).sav), c.sav) : null
        if (refused !== null) { if (refused) say(refused); break }
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
      case 'O': // the autosave (IMP-060)
        if (auto) nav.play({ kind: 'load', dat: auto.dat, party: auto.chars, label: `autosave, ${auto.label}`, known: auto.known })
        return
      case 'L': {
        // browser saves first, then the saves that came with the game files
        const saves = (await listSaves()).map((g) => ({ title: `${g.slot}: ${g.label}`, note: new Date(g.savedAt).toLocaleString(),
          start: { kind: 'load' as const, dat: g.dat, party: g.chars, label: `slot ${g.slot}, ${g.label}`, known: g.known } }))
        if (auto) saves.unshift({ title: `Autosave: ${auto.label}`, note: new Date(auto.savedAt).toLocaleString(),
          start: { kind: 'load' as const, dat: auto.dat, party: auto.chars, label: `autosave, ${auto.label}`, known: auto.known } })
        // conflict copies the sync kept (IMP-072): the version that lost when two devices saved the same slot
        for (const c of await listConflicts().catch(() => [])) {
          if (!c.save) continue
          const g = c.save, where = c.ofId === 'AUTO' ? 'autosave' : `slot ${c.ofId}`
          saves.push({ title: `${c.ofId === 'AUTO' ? 'Autosave' : c.ofId} (conflict copy, ${c.from === 'browser' ? "this browser's" : "another device's"}): ${g.label}`, note: new Date(g.savedAt).toLocaleString(),
            start: { kind: 'load' as const, dat: g.dat, party: g.chars, label: `conflict copy of ${where}, ${g.label}`, known: g.known } })
        }
        for (const slot of 'ABCDEFGHIJ') {
          const dat = files.get(`SAVGAM${slot}.DAT`)
          if (!dat) continue
          const sv = parseSave(dat)
          const chars = sv.party.map((st) => ({ sav: files.get(`${st}.SAV`)!, itm: files.get(`${st}.${files.game.saves.items}`), spc: files.get(`${st}.${files.game.saves.effects}`) }))
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
      case 'X': {
        // IMP-006: the original's files in one ZIP, for DOSBox or another browser
        const saves = await listSaves()
        if (!saves.length) { say('There are no saved games in this browser.'); break }
        const i = await pick('Export saved game', saves.map((g) => `${g.slot}: ${g.label} — ${new Date(g.savedAt).toLocaleString()}`))
        if (i === null) break
        const g = saves[i]
        const blob = new Blob([zip(saveFiles(g)) as Uint8Array<ArrayBuffer>], { type: 'application/zip' })
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `poolrad-save-${g.slot}.zip`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
        say(`Slot ${g.slot} exported: unzip it into the game folder to play it in DOSBox.`)
        break
      }
      case 'I': {
        const input = document.createElement('input')
        input.type = 'file'
        input.multiple = true
        const S = files.game.saves
        input.accept = ['zip', 'dat', 'sav', S.items, S.effects, S.roster, 'txt', ...files.game.imports.flatMap((i) => [i.roster, 'spc'])].flatMap((x) => [`.${x.toLowerCase()}`, `.${x.toUpperCase()}`]).join(',')
        const chosen = await new Promise<File[]>((resolve) => {
          input.addEventListener('change', () => resolve([...(input.files ?? [])]), { once: true })
          input.addEventListener('cancel', () => resolve([]), { once: true })
          input.click()
        })
        if (!chosen.length) break
        try {
          const loose: NamedFile[] = []
          for (const f of chosen) {
            const data = new Uint8Array(await f.arrayBuffer())
            if (/\.zip$/i.test(f.name)) loose.push(...await unzip(data))
            else loose.push({ name: f.name, data })
          }
          const { games, missing } = savesFrom(loose)
          // roster characters as the original keeps them (PoR <name>.CHA/.ITM/.SPC and charlist.txt, CotAB .GUY/.SWG/.FX)
          const found = rosterFrom(loose)
          // characters from another game (CotAB: Pool of Radiance), converted as the original's Add does
          const brought = tables ? importsFrom(loose, tables) : { chars: [], from: [] }
          found.chars.push(...brought.chars.filter((b) => !found.chars.some((c) => c.stem === b.stem)))
          if (!games.length && !found.chars.length) {
            const lost = [...missing, ...found.missing]
            say(lost.length ? `Nothing imported; missing ${lost.join(', ')}.` : `Choose a SAVGAM file (A to J) with its CHRDAT files, characters (.${S.roster} with .${S.items} and .${S.effects}${S.roster === 'CHA' ? ' and charlist.txt' : ''}), or a ZIP of them.`)
            break
          }
          const have = new Set((await listSaves()).map((g) => g.slot))
          const done: string[] = []
          for (const g of games) {
            if (have.has(g.slot) && !(await confirm(`Slot ${g.slot} already holds a saved game. Replace it?`))) continue
            await writeSave(g)
            done.push(g.slot)
          }
          const known = new Set(roster.map((r) => r.stem))
          const added: string[] = []
          for (const c of found.chars) {
            const nm = String.fromCharCode(...c.sav.subarray(1, 1 + c.sav[0]))
            if (known.has(c.stem) && !(await confirm(`${nm} is already in the roster. Replace?`))) continue
            await saveCharacter(c)
            added.push(nm)
          }
          if (added.length) roster = await listCharacters()
          const parts = [done.length ? `Imported into slot ${done.join(', ')}; use Load to play.` : '', added.length ? `Added to the roster: ${added.join(', ')}.` : '']
          const lost = [...missing, ...found.missing]
          say(parts.some(Boolean) ? `${parts.filter(Boolean).join(' ')}${lost.length ? ` Skipped: missing ${lost.join(', ')}.` : ''}` : 'Nothing imported.')
        } catch (err) {
          say(`Import failed: ${(err as Error).message}`)
        }
        break
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
    const row = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')
    if (row?.dataset.i === undefined) return
    const i = Number(row.dataset.i)
    if (i === current) act('V')
    else { current = i; draw() }
  })
  app.querySelector('[data-a="settings"]')!.addEventListener('click', () => {
    if (dialog.open) return
    initSound(files.get('START.EXE'))
    void openSettings(dialog)
  })
  app.querySelector('[data-a="assets"]')!.addEventListener('click', () => { window.removeEventListener('keydown', onKey); nav.assets() })
  app.querySelector('[data-a="games"]')!.addEventListener('click', () => { window.removeEventListener('keydown', onKey); nav.games() })
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
  // the sync brought records from the server (IMP-072): show them
  const stopPulled = onPulled(async () => {
    if (!app.contains(nav2)) { stopPulled(); return }
    await seedRoster(files)
    roster = await listCharacters()
    auto = await readAutosave()
    party = (await getParty()).filter((s) => roster.some((c) => c.stem === s))
    if (!dialog.open) draw()
  })
  say('Choose a function.')
  draw()
}
