import sys, struct, zlib, bz2, lzma, os
import xml.etree.ElementTree as ET
src, out = sys.argv[1], sys.argv[2]
f = open(src, 'rb')
magic, hsize, ver, tclen, tulen, ck = struct.unpack('>4sHHQQI', f.read(28))
assert magic == b'xar!'
f.seek(hsize)
toc = zlib.decompress(f.read(tclen))
open(os.path.join(out, 'toc.xml'), 'wb').write(toc)
heap = hsize + tclen
root = ET.fromstring(toc)
def walk(el, path):
    for fe in el.findall('file'):
        name = fe.findtext('name'); typ = fe.findtext('type')
        p = os.path.join(path, name)
        if typ == 'directory':
            os.makedirs(p, exist_ok=True); walk(fe, p)
        elif typ == 'file':
            d = fe.find('data')
            off = int(d.findtext('offset')); ln = int(d.findtext('length'))
            enc = d.find('encoding').get('style')
            f.seek(heap + off); raw = f.read(ln)
            if 'gzip' in enc: raw = zlib.decompress(raw)
            elif 'bzip2' in enc: raw = bz2.decompress(raw)
            elif 'xz' in enc or 'lzma' in enc: raw = lzma.decompress(raw)
            os.makedirs(path, exist_ok=True)
            open(p, 'wb').write(raw)
            print(len(raw), enc, p)
walk(root.find('toc'), out)
