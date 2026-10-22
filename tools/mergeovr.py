import struct, sys
exe, ovrp, out = sys.argv[1:4]
b = bytearray(open(exe,'rb').read()); ovr = open(ovrp,'rb').read()
# FBOV (PoR, CotAB): the signature and a dword, segments from offset 8; TPOV (SotSB, an older Turbo
# Pascal overlay manager: OvrInit at image 0xC0F1 compares 'TP', 'OV'): the signature alone, segments
# from offset 4. The stubs' file offsets count from the start of the overlay file in both.
assert ovr[:4] in (b'FBOV', b'TPOV'), ovr[:4]
first = 8 if ovr[:4] == b'FBOV' else 4
hs = struct.unpack_from('<H', b, 8)[0]*16
nrel = struct.unpack_from('<H', b, 6)[0]
relocs = [struct.unpack_from('<HH', b, 0x1c+i*4) for i in range(nrel)]  # (ofs, seg)
img = bytearray(b[hs:])
ss, sp = struct.unpack_from('<HH', b, 0x0e)
# find genuine stub headers: CD 3F 00 00, fileofs dword, entries at +0x20 each CD 3F
stubs = []
for p in range(0, len(img)-0x20, 16):
    if img[p:p+4] == b'\xcd\x3f\x00\x00':
        fo, cs_, rs, ne, prev = struct.unpack_from('<IHHHH', img, p+4)
        if ne and all(img[p+0x20+5*i:p+0x22+5*i] == b'\xcd\x3f' for i in range(ne)) and first <= fo < len(ovr):
            stubs.append((p//16, fo, cs_, rs, ne, prev))
stubs.sort(key=lambda s: s[1])
# contiguity check
pos = first
for s in stubs:
    assert s[1] == pos, ('gap', hex(pos), hex(s[1])); pos = s[1] + s[2] + s[3]
print('stubs', len(stubs), 'ovr coverage end', pos, 'ovr size', len(ovr))
assert pos == len(ovr)
base = max((ss*16 + sp + 15)//16, (len(img)+15)//16)
base = (base + 0xff) & ~0xff
img += bytes(base*16 - len(img))
total_paras_est = base + sum((s[2]+15)//16 for s in stubs)
bad = 0; newrel = []
mapping = []
for sp_, fo, csz, rsz, ne, prev in stubs:
    seg = len(img)//16
    code = bytearray(ovr[fo:fo+csz]); fix = ovr[fo+csz:fo+csz+rsz]
    assert rsz % 2 == 0
    for i in range(0, rsz, 2):
        o = struct.unpack_from('<H', fix, i)[0]
        assert o+1 < csz
        v = struct.unpack_from('<H', code, o)[0]
        if v >= base: bad += 1
        newrel.append((o, seg))
    img += code + bytes((-len(code)) % 16)
    for i in range(ne):
        e = sp_*16 + 0x20 + 5*i
        ofs = struct.unpack_from('<H', img, e+2)[0]
        if ofs == 0xFFFF: continue  # an entry with no code (SotSB has some): left as INT 3Fh, never called
        assert ofs < csz
        img[e] = 0xEA; struct.pack_into('<HH', img, e+1, ofs, seg)
        newrel.append((e - sp_*16 + 3, sp_))
    mapping.append((sp_, seg, fo, csz, ne))
print('overlay segments placed from para %#x; fixups whose target segment >= base (suspicious): %d' % (base, bad))
allrel = relocs + newrel
hsize = (0x1c + len(allrel)*4 + 15)//16*16
total = hsize + len(img)
h = bytearray(b[:0x1c]) + bytes(hsize-0x1c)
struct.pack_into('<HHHH', h, 2, total % 512, (total+511)//512, len(allrel), hsize//16)
struct.pack_into('<H', h, 0x0a, 0x100)  # minalloc for heap/stack
struct.pack_into('<H', h, 0x18, 0x1c)
for i, (o, sg) in enumerate(allrel): struct.pack_into('<HH', h, 0x1c+i*4, o, sg)
open(out, 'wb').write(bytes(h) + bytes(img))
with open(out + '.map', 'w') as f:
    f.write('stub_para overlay_para ovr_fileofs code_size entries\n')
    for m in mapping: f.write('%04x %04x %06x %5d %d\n' % m)
print('wrote', out, total, 'bytes;', len(allrel), 'relocations')
