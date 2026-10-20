// A ZIP writer (stored entries, no compression) for the data export; no dependencies.
const CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0 }
  return t
})()

export function crc32(d: Uint8Array): number {
  let c = 0xffffffff
  for (const b of d) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function zip(files: { name: string; data: Uint8Array }[], when = new Date()): Buffer {
  const time = (when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)
  const date = ((when.getFullYear() - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()
  const parts: Buffer[] = [], central: Buffer[] = []
  let offset = 0
  for (const f of files) {
    const name = Buffer.from(f.name, 'utf8'), crc = crc32(f.data), n = f.data.length
    const local = Buffer.alloc(30 + name.length)
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(time, 10); local.writeUInt16LE(date, 12); local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(n, 18); local.writeUInt32LE(n, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30)
    const c = Buffer.alloc(46 + name.length)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8)
    c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(n, 20)
    c.writeUInt32LE(n, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42); name.copy(c, 46)
    parts.push(local, Buffer.from(f.data.buffer, f.data.byteOffset, f.data.byteLength)); central.push(c)
    offset += local.length + n
  }
  const size = central.reduce((a, c) => a + c.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10)
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...parts, ...central, end])
}
