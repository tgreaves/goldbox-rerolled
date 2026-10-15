import { describe, expect, it } from 'vitest'
import { unpackText } from '../src/data/text'
import { unrle } from '../src/data/dax'

describe('packed text', () => {
  it('maps 6-bit codes to ASCII', () => {
    // "HI" = codes 0x08, 0x09 packed into 12 bits, padded to 2 bytes
    expect(unpackText(new Uint8Array([0b00100000, 0b10010000]))).toBe('HI')
  })
})

describe('rle', () => {
  it('copies literals and repeats runs', () => {
    expect([...unrle(new Uint8Array([1, 7, 8, 0xfe, 9]), 4)]).toEqual([7, 8, 9, 9])
  })
})
