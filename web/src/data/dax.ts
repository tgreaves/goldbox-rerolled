// DAX container and RLE (spec/containers.md)

export interface DaxEntry {
  id: number
  offset: number
  raw: number
  comp: number
}

export interface Dax {
  entries: DaxEntry[]
  base: number
  bytes: Uint8Array
}

export function readDax(bytes: Uint8Array): Dax {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const hlen = dv.getUint16(0, true)
  const entries: DaxEntry[] = []
  for (let i = 0; i + 9 <= hlen; i += 9) {
    entries.push({
      id: bytes[2 + i],
      offset: dv.getUint32(3 + i, true),
      raw: dv.getUint16(7 + i, true),
      comp: dv.getUint16(9 + i, true),
    })
  }
  return { entries, base: 2 + hlen, bytes }
}

/** n < 0x80: copy n+1 bytes; n >= 0x80: repeat the next byte 256-n times. */
export function unrle(src: Uint8Array, rawLen: number): Uint8Array {
  const out = new Uint8Array(rawLen)
  let i = 0
  let o = 0
  while (i < src.length && o < rawLen) {
    const n = src[i++]
    if (n < 0x80) {
      const len = Math.min(n + 1, rawLen - o)
      out.set(src.subarray(i, i + len), o)
      o += len
      i += n + 1
    } else {
      out.fill(src[i++], o, Math.min(o + 256 - n, rawLen))
      o += 256 - n
    }
  }
  return out
}

export function daxRecord(dax: Dax, id: number): Uint8Array | undefined {
  const e = dax.entries.find((x) => x.id === id)
  if (!e) return undefined
  const start = dax.base + e.offset
  return unrle(dax.bytes.subarray(start, start + e.comp), e.raw)
}

export function daxRecords(dax: Dax): Map<number, Uint8Array> {
  const out = new Map<number, Uint8Array>()
  for (const e of dax.entries) out.set(e.id, daxRecord(dax, e.id)!)
  return out
}
