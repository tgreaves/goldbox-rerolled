"""Map-area combat battlefield builder (Pool of Radiance DOS), reference implementation.

Follows FUN_34c7_0810 and its nested helpers (spec/A-games/engine/battlefield.md, "Map areas: squares -> cells"):
  012b  edge(x, y, dir)      one side of an edge: 0 open, 1 wall, 3 door
  01ad  classify(x, y, dir)  edge(x, y, dir) | edge(neighbour, opposite dir)
  0221  plot(c, r, piece)    grid[dy*5 + 10 + r][dx*6 + dy*5 + 21 + c] = piece + 1 (clipped)
  02ba  floor + west edge, 0377 north edge, 040f north-west corner, 0615 north-east corner
  0000  finishing pass (random rocks, bones, flowers); only run here when --rng is given

Usage: python3 battlefield.py <GEOn.DAX> <record> <X> <Y> [facing 0/2/4/6] [--area N] [--rng SEED]
Facing is accepted but unused: the original builds the grid north-up whatever the facing.
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import geo

ROWS, COLS = 25, 50
DX = (0, 1, 1, 1, 0, -1, -1, -1)   # DS:2736
DY = (-1, -1, 0, 1, 1, 1, 0, -1)   # DS:273F
FLOOR = 0x16                        # piece id; cell = piece + 1 = 0x17

# 040f: north-west corner, cells (r0,c1) (r0,c2) (r1,c1) (r1,c2); f = both other arms open
def _nw(W, N, f):
    if N == 0:
        a = {0: 0x16, 3: 0x0D, 1: 0x00 if f else 0x0D}[W]
    elif W == 0:
        a = 0x0F if f else 0x05
    else:
        a = 0x12 if f else 0x02
    b = {0: 0x16, 3: 0x11, 1: 0x05}[N]
    if W == 0:
        c = 0x16 if N == 0 else (0x10 if f else 0x0A)
    elif W == 3:
        c = 0x14 if f else 0x07
    else:
        c = 0x01 if f else 0x03
    if W == 1:
        d = {0: 0x0D, 3: 0x15, 1: 0x06}[N]
    else:
        d = {0: 0x16, 3: 0x17, 1: 0x0A}[N]
    return a, b, c, d


# 0615: north-east corner, cells (r0,c5) (r0,c6) (r1,c5) (r1,c6)
# g7 = east edge of the north neighbour, g8 = north edge of the east neighbour
def _ne(N, E, g7, g8):
    f = g7 == 0 and g8 == 0
    if N == 0:
        a = 0x04 if g7 == 1 else 0x16
    else:
        a = {3: 0x0F, 1: 0x05}[N]
    if N == 0:
        if g7 == 0:
            b = 0x16
        elif g7 == 3:
            b = 0x18 if (E == 0 and g8 != 0) else 0x01
        else:
            b = 0x0B if (E == 0 and g8 != 0) else 0x03
    elif E != 0:
        b = 0x09
    elif g8 != 0:
        b = 0x05
    else:
        b = 0x11 if f else 0x13
    c = {0: 0x16, 3: 0x10, 1: 0x0A}[N]
    if N == 0:
        if g7 == 0:
            d = 0x16
        elif E != 0:
            d = 0x04
        elif g8 == 0:
            d = 0x08
        else:
            d = 0x0C
    elif E != 0:
        d = 0x0E
    elif g8 == 0:
        d = 0x17
    else:
        d = 0x0A
    return a, b, c, d


def build(m, X, Y, facing=0, area=None, rng=None):
    """Return the 25x50 cell grid (list of rows). m is a geo.Map. facing is ignored (as in the original)."""
    grid = [[None] * COLS for _ in range(ROWS)]

    def edge(x, y, d):                       # FUN_34c7_012b
        if 0 <= x <= 15 and 0 <= y <= 15:
            if m.passage(x, y, d // 2) == 0:
                return 1
            return 0 if m.wall(x, y, d // 2) == 0 else 3
        return 0 if (y == Y and d in (2, 6)) else 1

    def classify(x, y, d):                   # FUN_34c7_01ad
        return edge(x, y, d) | edge(x + DX[d], y + DY[d], (d + 4) % 8)

    for dy in range(-2, 3):                  # outer loop
        for dx in range(-6, 7):              # inner loop
            x, y = X + dx, Y + dy            # no wrap: off-map squares use edge()'s border rule

            def plot(c, r, piece):           # FUN_34c7_0221
                col, row = dx * 6 + dy * 5 + 21 + c, dy * 5 + 10 + r
                if 0 <= col < COLS and 0 <= row < ROWS:
                    grid[row][col] = piece + 1

            W, N, E = classify(x, y, 6), classify(x, y, 0), classify(x, y, 2)
            # 02ba: floor, then west edge
            for r in range(2, 5):
                for c in range(0, 6):
                    plot(c, r, FLOOR)
            if W == 1:
                for r in range(2, 5):
                    plot(r - 1, r, 0x04); plot(r, r, 0x03); plot(r + 1, r, 0x0D)
            elif W == 3:
                plot(1, 2, 0x08); plot(5, 4, 0x00)
            # 0377: north edge
            p0, p1 = (0x05, 0x0A) if N == 1 else (FLOOR, FLOOR)
            plot(3, 0, p0); plot(4, 0, p0); plot(3, 1, p1); plot(4, 1, p1)
            # 040f: north-west corner
            f = classify(x, y - 1, 6) == 0 and classify(x - 1, y, 0) == 0
            a, b, c, d = _nw(W, N, f)
            plot(1, 0, a); plot(2, 0, b); plot(1, 1, c); plot(2, 1, d)
            # 0615: north-east corner
            a, b, c, d = _ne(N, E, classify(x, y - 1, 2), classify(x + 1, y, 0))
            plot(5, 0, a); plot(6, 0, b); plot(5, 1, c); plot(6, 1, d)

    if rng is not None:                      # FUN_34c7_0000 (needs the game's RNG to match exactly)
        for col in range(COLS):
            for row in range(ROWS):
                if grid[row][col] != 0x17:   # image slot DS:2747[cell*4] == 0x16 only for cell 0x17
                    continue
                v = rng.randint(1, 100)
                if v == 98:
                    grid[row][col] = 0x1A
                elif v == 99:
                    grid[row][col] = 0x1B
                elif v == 100 and area != 10 and rng.randint(1, 100) == 1:
                    grid[row][col] = 0x1C if rng.randint(1, 10) <= 6 else 0x1D
    return grid


def dump(grid):
    return '\n'.join('%2d ' % i + ' '.join('..' if v == 0x17 else ('??' if v is None else '%02x' % v)
                                          for v in row) for i, row in enumerate(grid))


if __name__ == '__main__':
    args = sys.argv[1:]
    area = seed = None
    if '--area' in args:
        i = args.index('--area'); area = int(args[i + 1]); del args[i:i + 2]
    if '--rng' in args:
        i = args.index('--rng'); seed = int(args[i + 1]); del args[i:i + 2]
    path, rid, X, Y = args[0], int(args[1]), int(args[2]), int(args[3])
    facing = int(args[4]) if len(args) > 4 else 0
    m = geo.load(path, rid)[rid]
    g = build(m, X, Y, facing, area, random.Random(seed) if seed is not None else None)
    print('# %s record %d, party (%d,%d) facing %d; ".." = floor 0x17; party square rows 10-14, cols 21-27'
          % (os.path.basename(path), rid, X, Y, facing))
    print(dump(g))
