#!/usr/bin/env python3
"""A GRAB.COM screen dump (FRAMEnn.EGA, layout in grab.asm) as a PNG, and its 3D view compared with
the port's.

Usage:
  egaframe.py FRAME.EGA [--png screen.png] [--view view.png] [--compare port.png]

--png      the whole 320 × 200 screen, through the palette on show (attribute registers → DAC)
--view     the drawn view alone: 88 × 88 at pixels 24–111 on both axes (spec/A-games/engine/graphics.md)
--compare  the view against a frame from the headless runner (`npm run headless -- … --frame f.png`,
           any --scale): prints the number of differing pixels and exits 1 if there are any

Needs Pillow for the PNG reading and writing.
"""
import struct, sys

W, H, LINE = 320, 200, 40
VIEW_AT, VIEW = 24, 88


def load(path):
    b = open(path, 'rb').read()
    if b[:4] != b'GRAB' or len(b) != 16 + 4 * 8000 + 16 + 768:
        raise SystemExit(f'{path}: not a GRAB.COM dump')
    mode, start, offset = b[4], struct.unpack_from('<H', b, 5)[0], b[7]
    if mode != 0x0D:
        print(f'{path}: video mode {mode:#04x}, not EGA 0Dh: the picture will be wrong', file=sys.stderr)
    planes = [b[16 + 8000 * p:16 + 8000 * (p + 1)] for p in range(4)]
    attr = b[32016:32032]
    dac = b[32032:32032 + 768]
    six = lambda v: (v & 63) * 255 // 63
    palette = [tuple(six(dac[3 * (attr[i] & 63) + k]) for k in range(3)) for i in range(16)]
    pixels = bytearray(W * H)
    for y in range(H):
        for x in range(W):
            o, bit = y * LINE + x // 8, 7 - (x & 7)
            pixels[y * W + x] = sum(((planes[p][o] >> bit) & 1) << p for p in range(4))
    return {'mode': mode, 'start': start, 'offset': offset, 'pixels': pixels, 'palette': palette}


def rgb(f, x0=0, y0=0, w=W, h=H):
    out = bytearray()
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            out += bytes(f['palette'][f['pixels'][y * W + x]])
    return bytes(out)


def main(a):
    if not a or a[0].startswith('--'):
        raise SystemExit(__doc__)
    from PIL import Image
    f = load(a[0])
    opts = dict(zip(a[1::2], a[2::2]))
    if '--png' in opts:
        Image.frombytes('RGB', (W, H), rgb(f)).save(opts['--png'])
    view = rgb(f, VIEW_AT, VIEW_AT, VIEW, VIEW)
    if '--view' in opts:
        Image.frombytes('RGB', (VIEW, VIEW), view).save(opts['--view'])
    if '--compare' in opts:
        p = Image.open(opts['--compare']).convert('RGB')
        scale = p.width // VIEW
        if p.width != VIEW * scale or p.height != VIEW * scale:
            raise SystemExit(f'{opts["--compare"]}: {p.width} × {p.height} is not an 88 × 88 frame')
        p = p.resize((VIEW, VIEW), Image.NEAREST).tobytes()
        diff = sum(view[i:i + 3] != p[i:i + 3] for i in range(0, len(view), 3))
        print(f'{a[0]}: {diff} of {VIEW * VIEW} pixels differ')
        sys.exit(1 if diff else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
