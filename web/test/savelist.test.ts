// The save lists' clues (IMP-104): what a save keeps in its sidecar for the Load, Save and Export rows,
// read back checked.
import { describe, expect, it } from 'vitest'
import { readSaveInfo } from '../src/ui/savelist'
import { parseSidecar, sidecar } from '../src/store/savefiles'

describe('save list clues', () => {
  const thumb = 'data:image/png;base64,iVBORw0KGgo='
  it('keeps the place, the day and the picture, and drops anything else', () => {
    expect(readSaveInfo({ place: 'YOU ARE OUTSIDE THE CITY HALL.', time: 'Day 1 · 10:54', thumb, other: 1 }))
      .toEqual({ place: 'YOU ARE OUTSIDE THE CITY HALL.', time: 'Day 1 · 10:54', thumb })
    expect(readSaveInfo({ thumb: 'javascript:alert(1)' })).toBeUndefined() // only a PNG data URL is shown as a picture
    expect(readSaveInfo(null)).toBeUndefined()
  })

  it('travel in the save sidecar', () => {
    const info = { place: 'YOU ARE BY THE GATEWAY.', time: 'Day 2 · 08:15', thumb }
    const f = sidecar({ slot: 'C', dat: new Uint8Array(), chars: [], label: '', savedAt: 0, sidecar: { rest: { info } } })!
    expect(readSaveInfo(parseSidecar(f.data).extra?.rest.info)).toEqual(info)
  })
})
