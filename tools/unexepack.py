import struct, sys
src, dst = sys.argv[1], sys.argv[2]
b = open(src,'rb').read()
(sig, lastp, pages, nrel, hdrpar, minal, maxal, ss, sp, ck, ip, cs, relo, ovl) = struct.unpack_from('<2s13H', b, 0)
hdr = hdrpar*16
modlen = pages*512 - (512 - lastp if lastp else 0) - hdr
mod = bytearray(b[hdr:hdr+modlen])
eh = cs*16
f = struct.unpack_from('<8H2s', mod, eh)
rIP, rCS, memstart, exsize, rSP, rSS, destlen, skip, rb = f
assert rb == b'RB', f
print('real CS:IP %04x:%04x SS:SP %04x:%04x destlen=%#x paras skip=%d exsize=%#x' % (rCS, rIP, rSS, rSP, destlen, skip, exsize))
stub = bytes(mod[eh:eh+exsize])
msg = b'Packed file is corrupt'
mi = stub.find(msg); assert mi > 0
rt = mi + len(msg)
relocs = []; p = rt
for seg in range(16):
    n = struct.unpack_from('<H', stub, p)[0]; p += 2
    for _ in range(n):
        relocs.append((seg*0x1000, struct.unpack_from('<H', stub, p)[0])); p += 2
print('reloc table bytes used', p-rt, 'available', exsize-rt, 'relocs', len(relocs))
assert p == exsize, 'reloc table does not exactly fill stub'
buf = bytearray(max(destlen*16, eh))
buf[:eh] = mod[:eh]
s = eh - (skip-1)*16
while buf[s-1] == 0xFF: s -= 1
d = destlen*16
while True:
    s -= 1; cmd = buf[s]
    s -= 2; ln = struct.unpack_from('<H', buf, s)[0]
    if cmd & 0xFE == 0xB0:
        s -= 1; v = buf[s]; d -= ln; buf[d:d+ln] = bytes([v])*ln
    elif cmd & 0xFE == 0xB2:
        s -= ln; d -= ln; buf[d:d+ln] = bytes(buf[s:s+ln])
    else:
        raise SystemExit('bad command %#x at %#x' % (cmd, s))
    if cmd & 1: break
print('decompression finished: src=%#x dst=%#x (dst-src gap must be >= 0: %d)' % (s, d, d-s))
image = bytes(buf[:destlen*16])
# rebuild MZ
nr = len(relocs)
hsize = (0x1c + nr*4 + 15)//16*16
hsize = max(hsize, 0x20)
total = hsize + len(image)
extra = (destlen*16 + 0) 
orig_mem = modlen + minal*16
newmin = max(0, (orig_mem - len(image) + 15)//16)
h = bytearray(hsize)
struct.pack_into('<2s13H', h, 0, b'MZ', total % 512, (total+511)//512, nr, hsize//16, newmin, 0xFFFF, rSS, rSP, 0, rIP, rCS, 0x1c, 0)
for i,(sg,of) in enumerate(relocs):
    struct.pack_into('<HH', h, 0x1c+i*4, of, sg)
open(dst,'wb').write(bytes(h)+image)
print('wrote', dst, total, 'bytes; image', len(image), 'minalloc paras', newmin)
