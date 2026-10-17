// Title screen: the TITLE pictures, any key or tap to continue (spec/architecture.md, startup).
import type { GameFiles } from '../store/gamefiles'
import { parseRecord, toImageData } from '../data/image'
import { blit, sizeCanvas } from '../render/upscale'
import { daxRecords } from '../data/dax'

export function showTitle(app: HTMLElement, files: GameFiles, next: () => void) {
  const dax = files.dax('TITLE')
  const pics = dax ? [...daxRecords(dax).values()].map((d) => parseRecord(d).frames[0].picture) : []
  if (!pics.length) return next()
  app.innerHTML = `<div class="title" role="button" tabindex="0" aria-label="Continue">
    <canvas class="pixel"></canvas><p class="muted">Press any key or tap to continue</p></div>`
  const box = app.querySelector<HTMLDivElement>('.title')!
  const canvas = box.querySelector('canvas')!
  let i = 0
  const draw = () => {
    const p = pics[i]
    blit(sizeCanvas(canvas, p.width, p.height), toImageData(p), 0, 0)
  }
  const advance = () => {
    if (++i < pics.length) draw()
    else {
      window.removeEventListener('keydown', onKey)
      next()
    }
  }
  const onKey = (e: KeyboardEvent) => {
    e.preventDefault()
    advance()
  }
  window.addEventListener('keydown', onKey)
  box.addEventListener('click', advance)
  draw()
  box.focus()
}
