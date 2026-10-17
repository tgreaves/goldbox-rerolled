// Optional smoothing of the game's pixel art (IMP-047): every picture is enlarged 4× with Scale2x
// (EPX) applied twice, which rounds diagonal edges without blurring flat areas, and the final
// stretch to screen size is smoothed. Off by default ("Pixel": the original pixels, sharp).
// The choice is per browser and takes effect on the next page load (pictures are cached).

const KEY = 'poolrad.gfx'
export type Gfx = 'pixel' | 'smooth'

function read(): Gfx {
  try { return localStorage.getItem(KEY) === 'smooth' ? 'smooth' : 'pixel' } catch { return 'pixel' }
}
const mode: Gfx = read()
/** the enlargement applied to every picture this session */
export const F = mode === 'smooth' ? 4 : 1

export const gfxMode = () => mode
export function savedGfx(): Gfx { return read() }
export function setGfx(g: Gfx) {
  try { localStorage.setItem(KEY, g) } catch { /* this page only */ }
}
export function applyGfxClass() {
  document.documentElement.classList.toggle('gfx-smooth', mode === 'smooth')
}

/** Scale2x (EPX) on RGBA pixels: ×2. */
export function scale2x(src: ImageData): ImageData {
  const w = src.width, h = src.height
  const s = new Uint32Array(src.data.buffer, src.data.byteOffset, w * h)
  const out = new ImageData(w * 2, h * 2)
  const d = new Uint32Array(out.data.buffer)
  const at = (x: number, y: number) => s[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))]
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const P = s[y * w + x], A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1)
    let e0 = P, e1 = P, e2 = P, e3 = P
    if (C === A && C !== D && A !== B) e0 = A
    if (A === B && A !== C && B !== D) e1 = B
    if (D === C && D !== B && C !== A) e2 = C
    if (B === D && B !== A && D !== C) e3 = D
    const o = y * 2 * w * 2 + x * 2
    d[o] = e0; d[o + 1] = e1; d[o + w * 2] = e2; d[o + w * 2 + 1] = e3
  }
  return out
}

export function upscale(img: ImageData): ImageData {
  let out = img
  for (let k = F; k > 1; k >>= 1) out = scale2x(out)
  return out
}

const cache = new WeakMap<ImageData, HTMLCanvasElement>()
/** A canvas holding the picture, enlarged when smoothing is on (its logical size is width / F). */
export function pixels(img: ImageData): HTMLCanvasElement {
  let c = cache.get(img)
  if (!c) {
    const big = upscale(img)
    c = document.createElement('canvas')
    c.width = big.width; c.height = big.height
    c.getContext('2d')!.putImageData(big, 0, 0)
    cache.set(img, c)
  }
  return c
}

/** Give a canvas a backing store F times its logical size and draw in logical units. */
export function sizeCanvas(c: HTMLCanvasElement, w: number, h: number): CanvasRenderingContext2D {
  if (c.width !== w * F || c.height !== h * F) { c.width = w * F; c.height = h * F }
  const g = c.getContext('2d')!
  g.setTransform(F, 0, 0, F, 0, 0)
  g.imageSmoothingEnabled = F > 1
  return g
}

/** Draw a picture at logical (x, y) on a canvas prepared with sizeCanvas. */
export function blit(g: CanvasRenderingContext2D, img: ImageData, x: number, y: number) {
  g.drawImage(pixels(img), x, y, img.width, img.height)
}

/** Draw an already enlarged canvas (from pixels) at its logical size. */
export function blitCanvas(g: CanvasRenderingContext2D, c: HTMLCanvasElement, x: number, y: number) {
  g.drawImage(c, x, y, c.width / F, c.height / F)
}
