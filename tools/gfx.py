"""Image decoder for Pool of Radiance DAX graphics (PIC, TITLE, 8X8D, CPIC, ...).

Header (17 bytes, engine FUN_1464_0111):
  u16 height (pixels), u16 width (8-pixel units), u16 x, u16 y,
  u8 count (sub-images of the same size), u8[8] CGA dither map
followed by count * height * width*4 bytes, 4 bits per pixel, high nibble first.

Animated records (PIC, FINAL, SPRIT): u8 frames, then per frame u32 delay + image.
In PIC and FINAL records every frame after the first is stored XORed with frame 1
(engine 5523:00a2); SPRIT frames are stored whole (one frame per distance).

Usage: python3 gfx.py <FILE.DAX> <out_dir>   (writes PNGs)
"""
import sys, os, struct, zlib
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dax import read_dax, unrle

# Default EGA palette (IBM 16-colour), RGB
EGA = [(0, 0, 0), (0, 0, 170), (0, 170, 0), (0, 170, 170), (170, 0, 0), (170, 0, 170),
       (170, 85, 0), (170, 170, 170), (85, 85, 85), (85, 85, 255), (85, 255, 85),
       (85, 255, 255), (255, 85, 85), (255, 85, 255), (255, 255, 85), (255, 255, 255)]


class Image:
    def __init__(self, h, w8, x, y, pixels):
        self.h, self.w, self.x, self.y, self.px = h, w8 * 8, x, y, pixels  # px: list of rows of indices


def parse_header(d, o):
    h, w8, x, y, cnt = struct.unpack_from('<HHHHB', d, o)
    return h, w8, x, y, cnt, o + 17


def parse_images(d, o):
    """One 17-byte header and its `count` sub-images. Returns (images, new_offset)."""
    h, w8, x, y, cnt, o = parse_header(d, o)
    bpr = w8 * 4
    out = []
    for _ in range(cnt):
        rows = []
        for r in range(h):
            row = []
            for b in d[o + r * bpr: o + (r + 1) * bpr]:
                row += [b >> 4, b & 15]
            rows.append(row)
        o += h * bpr
        out.append(Image(h, w8, x, y, rows))
    return out, o


def parse_record(d, xor_frames=False):
    """Try single format, then animated format. Returns (kind, [(delay, Image)]).
    xor_frames: undo the XOR-with-first-frame delta coding used by PIC and FINAL."""
    h, w8, x, y, cnt, _ = parse_header(d, 0)
    if 17 + cnt * h * w8 * 4 == len(d):
        imgs, _ = parse_images(d, 0)
        return 'single', [(0, i) for i in imgs]
    n = d[0]; o = 1; frames = []
    for _ in range(n):
        delay = struct.unpack_from('<I', d, o)[0]
        imgs, o = parse_images(d, o + 4)
        frames += [(delay, i) for i in imgs]
    if o != len(d):
        raise ValueError('layout mismatch: used %d of %d' % (o, len(d)))
    if xor_frames and len(frames) > 1:
        base = frames[0][1]
        for delay, img in frames[1:]:
            if img.h == base.h and img.w == base.w:
                img.px = [[a ^ b for a, b in zip(r1, r0)] for r1, r0 in zip(img.px, base.px)]
    return 'animated', frames


def png(path, img, palette=EGA, scale=1):
    w, h = img.w * scale, img.h * scale
    raw = bytearray()
    for row in img.px:
        line = bytearray([0])
        for c in row:
            line += bytes(palette[c]) * scale
        raw += bytes(line) * scale
    def chunk(t, data):
        return struct.pack('>I', len(data)) + t + data + struct.pack('>I', zlib.crc32(t + data) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(bytes(raw), 9)) + chunk(b'IEND', b''))


def load(path):
    b, base, ents = read_dax(path)
    for r, off, raw, comp in ents:
        d, _ = unrle(b[base + off: base + off + comp], raw, 0)
        yield r, d


if __name__ == '__main__':
    path, out = sys.argv[1], sys.argv[2]
    os.makedirs(out, exist_ok=True)
    stem = os.path.basename(path)[:-4]
    for r, d in load(path):
        kind, frames = parse_record(d, xor_frames=stem.rstrip('0123456789') in ('PIC', 'FINAL'))
        print('%s record %d: %s, %d image(s) %dx%d' % (stem, r, kind, len(frames), frames[0][1].w, frames[0][1].h))
        for i, (delay, img) in enumerate(frames):
            png(os.path.join(out, '%s_%d_%d.png' % (stem, r, i)), img, scale=2)
