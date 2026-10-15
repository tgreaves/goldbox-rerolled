import struct, sys, os, glob
def read_dax(path):
    b = open(path,'rb').read()
    hlen = struct.unpack_from('<H', b, 0)[0]
    ents = []
    for i in range(0, hlen, 9):
        rid, off, raw, comp = struct.unpack_from('<BIHH', b, 2+i)
        ents.append((rid, off, raw, comp))
    base = 2 + hlen
    return b, base, ents
def unrle(src, rawlen, variant):
    out = bytearray(); i = 0
    while i < len(src) and len(out) < rawlen:
        n = src[i]; i += 1
        if n < 0x80:
            out += src[i:i+n+1]; i += n+1
        else:
            cnt = 256 - n + (1 if variant else 0)
            out += bytes([src[i]]) * cnt; i += 1
    return bytes(out), i
if __name__ == '__main__':
    d = sys.argv[1]
    tot = {0:0, 1:0}; n = 0; sizeok = 0
    for p in sorted(glob.glob(os.path.join(d, '*.DAX'))):
        b, base, ents = read_dax(p)
        if base + sum(e[3] for e in ents) == len(b): sizeok += 1
        else: print('size mismatch', os.path.basename(p))
        for rid, off, raw, comp in ents:
            n += 1
            for v in (0,1):
                out, used = unrle(b[base+off:base+off+comp], raw, v)
                if len(out) == raw and used == comp: tot[v] += 1
    print('files with consistent headers:', sizeok, 'records:', n, 'exact decodes  variant(-n):', tot[0], ' variant(-n+1):', tot[1])
