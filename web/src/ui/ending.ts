// The ending (PROGRAM 8, FUN_4804_02a4): three captions with the FINAL<block> pictures. Record 1 and
// the animation in record 2 (the dragon's death), record 3 with an extra figure for each party member
// past the first (records 4–6), then Tyranthraxus speaking (record 7) and his fall (record 8).
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, toImageData, type Picture } from '../data/image'

const PARTS: string[][] = [
  ['Mortally wounded, the dragon roars!', 'The spirit of Tyranthraxus flares up', "from the dragon's body."],
  ['"Fools, you have but slain the body', 'I possessed.  I cannot be defeated!"', 'With the power of the pool of radiance',
    'which I moved here, to my lair,', 'I will still rule, by possessing one', 'of you!"'],
  ['"No Lord Bane!  I can still rule here!', 'I have not failed.  Do not call me back', 'through the pool!"', 'Noooo...'],
]

/**
 * Frame timing: the original shows a frame for (game speed + 3) × its delay timer ticks; the tick
 * length is taken as 10 ms here (I). A click or key skips the current animation.
 */
const TICK_MS = 10

export async function playEnding(dialog: HTMLDialogElement, files: GameFiles, block: number, partySize: number, speed: number) {
  const frames = (id: number): { delay: number; picture: Picture }[] => {
    const raw = files.record(`FINAL${block}`, id)
    try { return raw ? parseRecord(raw, true).frames : [] } catch { return [] }
  }
  dialog.innerHTML = `<h2>Pool of Radiance</h2><canvas class="ending" width="120" height="120"></canvas>
    <div class="ending-text"></div><p><button class="skip">Continue</button></p>`
  dialog.classList.add('ending-panel')
  const canvas = dialog.querySelector<HTMLCanvasElement>('canvas')!
  const g = canvas.getContext('2d')!
  const text = dialog.querySelector<HTMLDivElement>('.ending-text')!
  let skip: (() => void) | null = null
  const skipNow = () => { const s = skip; skip = null; s?.() }
  dialog.querySelector('.skip')!.addEventListener('click', skipNow)
  canvas.addEventListener('click', skipNow)
  const key = (e: KeyboardEvent) => { e.preventDefault(); skipNow() }
  dialog.addEventListener('keydown', key)
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); skipNow() })
  if (!dialog.open) dialog.showModal()

  const draw = (p: Picture | undefined, x: number, y: number) => {
    if (!p) return
    const tmp = document.createElement('canvas')
    tmp.width = p.width; tmp.height = p.height
    tmp.getContext('2d')!.putImageData(toImageData(p), 0, 0)
    g.drawImage(tmp, x, y)
  }
  const say = (lines: string[]) => { text.innerHTML = ''; for (const l of lines) { const p = document.createElement('p'); p.textContent = l; text.append(p) } }
  const wait = (ms: number) => new Promise<boolean>((resolve) => {
    const t = setTimeout(() => { skip = null; resolve(false) }, ms)
    skip = () => { clearTimeout(t); resolve(true) }
  })
  /** FUN_4804_0006: cycle the frames at (x, y) until they have wrapped `loops` times */
  const animate = async (id: number, x: number, y: number, loops: number) => {
    const f = frames(id)
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
