"""GEO map decoder and renderer (Pool of Radiance DOS).

Record layout (engine 55a0:10c7, 047b, 057a, 0350), 1026 bytes:
  [0:2]      header (skipped by the engine)
  plane 0    walls: high nibble = north, low nibble = east     (index y*16+x)
  plane 1    walls: high nibble = south, low nibble = west
  plane 2    event byte for the square (ECL register 0xC04F)
  plane 3    passability, 2 bits per side: N=bits0-1 E=2-3 S=4-5 W=6-7
             0 solid, 1 passable, 2 locked door, 3 locked door (no pick)
Coordinates wrap at 0..15.

Usage: python3 geo.py <GEOn.DAX> [record_id] [--svg out_dir]
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dax import read_dax, unrle

DIRS = ('N', 'E', 'S', 'W')


class Map:
    def __init__(self, raw):
        assert len(raw) == 1026
        p = raw[2:]
        self.planes = [p[i * 256:(i + 1) * 256] for i in range(4)]

    def _i(self, x, y):
        return (y & 15) * 16 + (x & 15)

    def wall(self, x, y, d):
        """Wall type 0..15 on side d (0=N,1=E,2=S,3=W)."""
        v = self.planes[d // 2][self._i(x, y)]
        return v >> 4 if d % 2 == 0 else v & 15

    def passage(self, x, y, d):
        """Engine semantics of 55a0:0350: 1 = can move."""
        if self.wall(x, y, d) == 0:
            return 1
        return (self.planes[3][self._i(x, y)] >> (2 * d)) & 3

    def event(self, x, y):
        return self.planes[2][self._i(x, y)]

    def consistency(self):
        """Fraction of shared edges whose two sides agree on wall presence."""
        agree = total = 0
        for y in range(16):
            for x in range(16):
                for d, (dx, dy) in ((1, (1, 0)), (2, (0, 1))):
                    a = self.wall(x, y, d) != 0
                    b = self.wall(x + dx, y + dy, (d + 2) % 4) != 0
                    total += 1; agree += a == b
        return agree / total

    def ascii(self):
        rows = []
        for y in range(16):
            top = ''.join('+' + ('--' if self.wall(x, y, 0) else '  ') for x in range(16)) + '+'
            mid = ''
            for x in range(16):
                mid += ('|' if self.wall(x, y, 3) else ' ')
                e = self.event(x, y) & 0x7F
                mid += ('%2d' % e) if e else '  '
            mid += '|' if self.wall(15, y, 1) else ' '
            rows += [top, mid]
        rows.append(''.join('+' + ('--' if self.wall(x, 15, 2) else '  ') for x in range(16)) + '+')
        return '\n'.join(rows)

    def svg(self, cell=32):
        s = 16 * cell + 2
        out = ['<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" '
               'font-family="monospace" font-size="10">' % (s, s),
               '<rect width="100%" height="100%" fill="#fff"/>']
        colour = {0: '#222', 1: '#6a6', 2: '#c33', 3: '#a3c'}
        for y in range(16):
            for x in range(16):
                X, Y = 1 + x * cell, 1 + y * cell
                e = self.event(x, y) & 0x7F
                if e:
                    out.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#fe9"/>' % (X, Y, cell, cell))
                    out.append('<text x="%d" y="%d" fill="#630">%d</text>' % (X + 3, Y + 12, e))
                segs = {0: (X, Y, X + cell, Y), 1: (X + cell, Y, X + cell, Y + cell),
                        2: (X, Y + cell, X + cell, Y + cell), 3: (X, Y, X, Y + cell)}
                for d, (a, b, c, e2) in segs.items():
                    if self.wall(x, y, d):
                        col = colour[self.passage(x, y, d)]
                        out.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>'
                                   % (a, b, c, e2, col))
        out.append('</svg>')
        return '\n'.join(out)


def load(path, rid=None):
    b, base, ents = read_dax(path)
    out = {}
    for r, off, raw, comp in ents:
        if rid is None or r == rid:
            d, _ = unrle(b[base + off: base + off + comp], raw, 0)
            out[r] = Map(d)
    return out


if __name__ == '__main__':
    args = sys.argv[1:]
    svg_dir = None
    if '--svg' in args:
        i = args.index('--svg'); svg_dir = args[i + 1]; del args[i:i + 2]
    path = args[0]; rid = int(args[1]) if len(args) > 1 else None
    for r, m in load(path, rid).items():
        print('== %s record %d  edge consistency %.1f%%' % (os.path.basename(path), r, 100 * m.consistency()))
        if svg_dir:
            os.makedirs(svg_dir, exist_ok=True)
            open(os.path.join(svg_dir, '%s_%d.svg' % (os.path.basename(path)[:-4], r)), 'w').write(m.svg())
        else:
            print(m.ascii())
