// The ending (PROGRAM 8), the game's ending script (games/ending.ts) step by step: captions, pictures
// (PoR FUN_4804_02a4: FINAL<block> drawn at positions; CotAB 0x3D02C: PIC and BIGPIC), and "Press any
// key" between them. The captions are read from GAME.OVR.
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
    const raw = files.picture(file, block, id)
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
    let shown = 120
    for (const step of script.steps) {
      if ('text' in step) say(step.text.map(caption))
      else if ('wait' in step) await pressKey()
      else {
        const p = step.picture
        if (p.fromParty !== undefined && partySize < p.fromParty) continue
        const f = frames(p.record, p.file)
        const [x, y] = p.at ?? [0, 0]
        if (!p.at) {
          const w = f[0]?.picture.width ?? 120, h = f[0]?.picture.height ?? 120
          if (w !== shown) {
            sizeCanvas(canvas, w, h); shown = w
            // a BIGPIC keeps its own shape and is shown wider, as the original draws it across the screen (IMP-091)
            canvas.style.aspectRatio = `${w} / ${h}`
            canvas.classList.toggle('wide', w > h)
          }
        }
        if (p.animate) await animate(p.record, x, y, p.loops ?? loops, p.file)
        else draw(f[0]?.picture, x, y)
      }
    }
  } finally {
    dialog.removeEventListener('keydown', key)
    dialog.classList.remove('ending-panel')
    dialog.close()
  }
}
