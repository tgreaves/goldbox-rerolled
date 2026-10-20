// The ending (PROGRAM 8), from the game's ending script (games/ending.ts). PoR (FUN_4804_02a4): three
// captions with the FINAL<block> pictures: record 1 and the animation in record 2 (the dragon's
// death), record 3 with an extra figure for each party member past the first (records 4–6), then
// Tyranthraxus speaking (record 7) and his fall (record 8). CotAB (0x3D02C): captions, PIC and BIGPIC
// pictures, and "Press any key" between them. The captions are read from START.EXE.
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, toImageData, type Picture } from '../data/image'
import { blit, sizeCanvas } from '../render/upscale'


/**
 * Frame timing: the original shows a frame for (game speed + 3) × its delay timer ticks, the timer
 * being DOS time in hundredths of a second (FUN_1709_0c3f). A click or key skips the current animation.
 */
const TICK_MS = 10

export async function playEnding(dialog: HTMLDialogElement, files: GameFiles, block: number, partySize: number, speed: number) {
  const script = files.game.ending
  const frames = (id: number, file = 'FINAL'): { delay: number; picture: Picture }[] => {
    const raw = files.record(`${file}${block}`, id)
    try { return raw ? parseRecord(raw, file !== 'BIGPIC').frames : [] } catch { return [] }
  }
  const ovr = files.get('GAME.OVR') ?? null
  const caption = (o: number) => ovr ? String.fromCharCode(...ovr.subarray(script.cs + o + 1, script.cs + o + 1 + ovr[script.cs + o])) : ''
  dialog.innerHTML = `<h2>${files.game.name}</h2><canvas class="ending" width="120" height="120"></canvas>
    <div class="ending-text"></div><p><button class="skip">Continue</button></p>`
  dialog.classList.add('ending-panel')
  const canvas = dialog.querySelector<HTMLCanvasElement>('canvas')!
  const g = sizeCanvas(canvas, 120, 120)
  const text = dialog.querySelector<HTMLDivElement>('.ending-text')!
  let skip: (() => void) | null = null
  const skipNow = () => { const s = skip; skip = null; s?.() }
  dialog.querySelector('.skip')!.addEventListener('click', skipNow)
  canvas.addEventListener('click', skipNow)
  const key = (e: KeyboardEvent) => { e.preventDefault(); skipNow() }
  dialog.addEventListener('keydown', key)
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); skipNow() })
  if (!dialog.open) dialog.showModal()
  if (!ovr) text.innerHTML = `<p class="muted">The captions need GAME.OVR: re-import the ${files.game.folder} folder.</p>`

  const draw = (p: Picture | undefined, x: number, y: number) => {
    if (!p) return
    blit(g, toImageData(p), x, y)
  }
  const say = (lines: string[]) => { text.innerHTML = ''; for (const l of lines) { const p = document.createElement('p'); p.textContent = l; text.append(p) } }
  const wait = (ms: number) => new Promise<boolean>((resolve) => {
    const t = setTimeout(() => { skip = null; resolve(false) }, ms)
    skip = () => { clearTimeout(t); resolve(true) }
  })
  /** FUN_4804_0006: cycle the frames at (x, y) until they have wrapped `loops` times */
  const animate = async (id: number, x: number, y: number, loops: number, file = 'FINAL') => {
    const f = frames(id, file)
    if (!f.length) return
    for (let k = 0; k < loops; k++) {
      for (const fr of f) {
        draw(fr.picture, x, y)
        if (await wait(Math.max(1, (speed + 3) * fr.delay) * TICK_MS)) { draw(f[f.length - 1].picture, x, y); return }
      }
    }
  }
  const loops = ((10 - speed) * 5) >> 1
  const pressKey = () => new Promise<void>((resolve) => { skip = resolve })

  try {
    if (script.steps) {
      let shown = 120
      for (const step of script.steps) {
        if ('text' in step) say(step.text.map(caption))
        else if ('wait' in step) await pressKey()
        else {
          const f = frames(step.picture.record, step.picture.file)
          const w = f[0]?.picture.width ?? 120, h = f[0]?.picture.height ?? 120
          if (w !== shown) { sizeCanvas(canvas, w, h); shown = w }
          if (step.picture.animate) await animate(step.picture.record, 0, 0, loops, step.picture.file)
          else draw(f[0]?.picture, 0, 0)
        }
      }
      return
    }
    const PARTS = (script.por?.parts ?? []).map((g) => g.map(caption))
    say(PARTS[0])
    draw(frames(1)[0]?.picture, 0, 0)
    await animate(2, 16, 32, loops)
    draw(frames(3)[0]?.picture, 0, 0)
    if (partySize > 1) draw(frames(4)[0]?.picture, 0, 88)
    if (partySize > 2) draw(frames(5)[0]?.picture, 104, 72)
    if (partySize > 3) draw(frames(6)[0]?.picture, 0, 72)
    say(PARTS[1])
    await animate(7, 16, 0, loops)
    say(PARTS[2])
    await animate(8, 16, 0, 1)
    await pressKey()
  } finally {
    dialog.removeEventListener('keydown', key)
    dialog.classList.remove('ending-panel')
    dialog.close()
  }
}
