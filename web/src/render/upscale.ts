// Optional "sharp" scaling of the game's pixel art (IMP-047): every picture is enlarged 4× by
// whole pixels (nearest neighbour), so each original pixel stays a clean square, and only the last,
// small stretch to the screen is smoothed. That removes the uneven pixel widths of a plain
// fractional stretch without repainting the art. (Scale2x was tried first: on EGA art with one-pixel
// details and dithering it smears outlines into blobs.) Off by default ("Pixel").
// The choice is per browser and takes effect on the next page load (pictures are cached).

const KEY = 'poolrad.gfx'
export type Gfx = 'pixel' | 'sharp'

function read(): Gfx {
  try { return localStorage.getItem(KEY) === 'sharp' ? 'sharp' : 'pixel' } catch { return 'pixel' }
}
const mode: Gfx = read()
/** the enlargement applied to every picture this session */
export const F = mode === 'sharp' ? 4 : 1

export const gfxMode = () => mode
export function savedGfx(): Gfx { return read() }
export function setGfx(g: Gfx) {
  try { localStorage.setItem(KEY, g) } catch { /* this page only */ }
}
export function applyGfxClass() {
  document.documentElement.classList.toggle('gfx-smooth', mode === 'sharp')
}

/** Whole-pixel enlargement by `k` (nearest neighbour). */
export function nearest(src: ImageData, k: number): ImageData {
  const w = src.width, h = src.height
  const s = new Uint32Array(src.data.buffer, src.data.byteOffset, w * h)
  const out = new ImageData(w * k, h * k)
  const d = new Uint32Array(out.data.buffer)
  for (let y = 0; y < h * k; y++) {
    const row = Math.floor(y / k) * w
    for (let x = 0; x < w * k; x++) d[y * w * k + x] = s[row + Math.floor(x / k)]
  }
  return out
}

export function upscale(img: ImageData): ImageData {
  return F > 1 ? nearest(img, F) : img
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
