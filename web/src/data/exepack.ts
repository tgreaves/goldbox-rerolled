// Microsoft EXEPACK unpacker for START.EXE (spec/containers.md); a port of tools/unexepack.py.
// Returns the unpacked load image (the program as loaded at its load segment), which holds
// engine data such as the sound driver's effect tables.

export interface Unpacked {
  /** load image, offset 0 = the load segment */
  image: Uint8Array
  /** relocations as [segment, offset] */
  relocs: [number, number][]
}

export function unexepack(b: Uint8Array): Unpacked {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const u16 = (o: number) => dv.getUint16(o, true)
  if (b[0] !== 0x4d || b[1] !== 0x5a) throw new Error('not an MZ executable')
  const lastp = u16(2), pages = u16(4), hdrpar = u16(8), cs = u16(0x16)
  const hdr = hdrpar * 16
  const modlen = pages * 512 - (lastp ? 512 - lastp : 0) - hdr
  const mod = b.subarray(hdr, hdr + modlen)
  const mv = new DataView(mod.buffer, mod.byteOffset, mod.byteLength)
  const eh = cs * 16
  const exsize = mv.getUint16(eh + 6, true)
  const destlen = mv.getUint16(eh + 12, true)
  const skip = mv.getUint16(eh + 14, true)
  if (mod[eh + 16] !== 0x52 || mod[eh + 17] !== 0x42) throw new Error('not EXEPACK-packed')
  // relocation table follows the stub's error message
  const stub = mod.subarray(eh, eh + exsize)
  const msg = new TextEncoder().encode('Packed file is corrupt')
  let mi = -1
  outer: for (let i = 0; i + msg.length <= stub.length; i++) {
    for (let j = 0; j < msg.length; j++) if (stub[i + j] !== msg[j]) continue outer
    mi = i
    break
  }
  if (mi < 0) throw new Error('EXEPACK stub not recognised')
  const relocs: [number, number][] = []
  let p = mi + msg.length
  const sv = new DataView(stub.buffer, stub.byteOffset, stub.byteLength)
  for (let seg = 0; seg < 16; seg++) {
    const n = sv.getUint16(p, true)
    p += 2
    for (let k = 0; k < n; k++, p += 2) relocs.push([seg * 0x1000, sv.getUint16(p, true)])
  }
  // decompress backwards
  const buf = new Uint8Array(Math.max(destlen * 16, eh))
  buf.set(mod.subarray(0, eh))
  let s = eh - (skip - 1) * 16
  while (buf[s - 1] === 0xff) s--
  let d = destlen * 16
  for (;;) {
    s -= 1
    const cmd = buf[s]
    s -= 2
    const len = buf[s] | (buf[s + 1] << 8)
    if ((cmd & 0xfe) === 0xb0) {
      s -= 1
      const v = buf[s]
      d -= len
      buf.fill(v, d, d + len)
    } else if ((cmd & 0xfe) === 0xb2) {
      s -= len
      d -= len
      buf.copyWithin(d, s, s + len)
    } else throw new Error(`EXEPACK: bad command ${cmd.toString(16)}`)
    if (cmd & 1) break
  }
  return { image: buf.slice(0, destlen * 16), relocs }
}
