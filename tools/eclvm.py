"""Headless ECL interpreter for Pool of Radiance (DOS).

Runs area scripts against a real game state (a SAVGAM*.DAT save and its
CHRDAT* characters) with the screens stubbed out: text is printed, menus are
answered from a queue (or the first option), and engine screens such as
combat, shops and the party screen are logged instead of run.

Its main job is to check ../spec/ecl.md against real scripts. It also records
which variables the scripts touch, which is how the engine-visible variable
catalogue is checked.

Usage:
  python3 eclvm.py <game_dir> [--save A] [--moves fflre] [--answers 0,1,2]
                   [--area N] [--trace] [--vars]
moves: f forward, b back, l turn left, r turn right, e encamp, - stand still
"""
import sys, os, struct, random, argparse, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dax import read_dax, unrle
from ecl import OPS, Script, unpack_text, BASE, VECTORS
from geo import Map

A0, B0, C0 = 0x4900, 0x6B00, 0x9700
CODE_END = 0xB700
CHAR_SIZE = 0x11D


class Halt(Exception):
    """Raised when a script hands control back to the engine for good."""


class Stub:
    """Screens and input. Override for an interactive front end."""

    def __init__(self, answers=()):
        self.answers = collections.deque(answers)
        self.log = []

    def out(self, s):
        self.log.append(s)
        print(s)

    def choose(self, prompt, options):
        a = self.answers.popleft() if self.answers else 0
        a = max(0, min(a, len(options) - 1))
        self.out('  [menu] %s %s -> %s' % (prompt, options, options[a] if options else a))
        return a

    def number(self, prompt):
        a = self.answers.popleft() if self.answers else 0
        self.out('  [input number] %s -> %d' % (prompt, a))
        return a

    def text(self, prompt):
        a = str(self.answers.popleft()) if self.answers else ''
        self.out('  [input text] %s -> %r' % (prompt, a))
        return a

    def engine(self, what, **kw):
        self.out('  [engine] %s %s' % (what, ' '.join('%s=%s' % kv for kv in kw.items())))


class Game:
    def __init__(self, game_dir, io=None, seed=1):
        self.dir = game_dir
        self.io = io or Stub()
        self.rng = random.Random(seed)
        self.A = [0] * 0x400
        self.B = [0] * 0x400
        self.C = [0] * 0x200
        self.code = bytearray(0x1E00)
        self.party = []            # bytearrays, CHAR_SIZE each
        self.cur = 0               # index of the current character
        self.block = 1
        self.area = 0
        self.geo = None
        self.x = self.y = 0
        self.facing2 = 0           # facing x 2, as the engine stores it
        self.regs = {0xB1: 0, 0xFB: 0, 0xFC: 0}
        self.flags = dict(EQ=0, NE=0, LT=0, GT=0, LE=0, GE=0)
        self.stack = []
        self.access = collections.Counter()   # (rw, addr) -> count
        self.engine_flags = set()
        self.trace = False
        self.area_changed = False

    # ---------------------------------------------------------------- data
    def dax(self, family, rid):
        b, base, ents = read_dax(os.path.join(self.dir, '%s%d.DAX' % (family, self.block)))
        for r, off, raw, comp in ents:
            if r == rid:
                return unrle(b[base + off: base + off + comp], raw, 0)[0]
        return None

    def load_save(self, letter='A'):
        d = open(os.path.join(self.dir, 'SAVGAM%s.DAT' % letter), 'rb').read()
        w = lambda o, n: list(struct.unpack_from('<%dH' % n, d, o))
        self.A = w(1, 0x400)
        self.B = w(0x801, 0x400)
        self.C = w(0x1001, 0x200)
        self.code = bytearray(d[0x1401:0x3201])
        self.x, self.y, self.facing2 = d[0x3201], d[0x3202], d[0x3203]
        n = d[0x3208]
        self.party = []
        for i in range(n):
            o = 0x3209 + 41 * i
            stem = d[o + 1:o + 1 + d[o]].decode('latin1')
            self.party.append(bytearray(open(os.path.join(self.dir, stem + '.SAV'), 'rb').read()))
        self.block = self.B[0x312]
        self.area = self.A[0xF2]          # ECL 0x49F2
        self.load_geo(self.A[0xC5])       # ECL 0x49C5
        self.reset_vm(keep=True)

    def load_geo(self, rid):
        raw = self.dax('GEO', rid)
        self.geo = Map(raw) if raw else None

    def load_ecl(self, rid):
        raw = self.dax('ECL', rid)
        self.code = bytearray(0x1E00)
        self.code[:len(raw) - 2] = raw[2:]

    def reset_vm(self, keep=False):
        self.stack = []
        for k in self.flags: self.flags[k] = 0
        if not keep:
            for a in range(0x4A00, 0x4A20): self.A[a - A0] = 0
            for a in range(0x6E79, 0x6E82): self.B[a - B0] = 0
        s = Script(bytes(self.code))
        self.vectors = s.vectors()

    # ------------------------------------------------------------- memory
    @property
    def char(self):
        return self.party[self.cur] if self.party else bytearray(CHAR_SIZE)

    def facing(self):
        return self.facing2 >> 1

    def square(self):
        """(wall ahead, event byte) for the engine registers 0xC04E/0xC04F."""
        if not self.geo:
            return 0, 0
        return self.geo.wall(self.x, self.y, self.facing()), self.geo.planes[2][(self.y & 15) * 16 + (self.x & 15)]

    def read(self, a):
        self.access['r', a] += 1
        if A0 <= a < 0x4D00:
            return self.A[a - A0]
        if B0 <= a < 0x6F00:
            v = self.char_view_read(a - B0)
            return self.B[a - B0] if v is None else v
        if C0 <= a < 0x9900:
            return self.C[a - C0]
        if BASE <= a < CODE_END:
            return self.code[a - BASE]
        if a == 0xC04B: return self.x
        if a == 0xC04C: return self.y
        if a == 0xC04D: return self.facing()
        if a == 0xC04E: return self.square()[0]
        if a == 0xC04F: return self.square()[1]
        if a == 0x33D: return self.facing2
        if a in self.regs: return self.regs[a]
        return 0                    # undefined in the original

    def write(self, v, a):
        v &= 0xFFFF
        self.access['w', a] += 1
        if A0 <= a < 0x4D00:
            self.A[a - A0] = v
            if a in (0x49FD, 0x49FE): self.engine_flags.add('redraw')
        elif B0 <= a < 0x6F00:
            self.B[a - B0] = v
            self.char_view_write(v, a - B0)
        elif C0 <= a < 0x9900:
            self.C[a - C0] = v
        elif BASE <= a < CODE_END:
            self.code[a - BASE] = v & 0xFF
        elif a == 0xC04B: self.x = v & 0xFF; self.engine_flags.add('moved')
        elif a == 0xC04C: self.y = v & 0xFF; self.engine_flags.add('moved')
        elif a == 0xC04D: self.facing2 = (v % 4) * 2 if v < 0x8000 else 0; self.engine_flags.add('moved')
        elif a in (0xC059, 0xC05F, 0x3DE, 0xB8, 0xB9): self.regs[a] = v

    def char_view_read(self, k):
        """ecl.md, B as a view of the current character (FUN_2fea_07bc)."""
        c = self.char
        u16 = lambda o: struct.unpack_from('<H', c, o)[0]
        s8 = lambda o: struct.unpack_from('<b', c, o)[0] & 0xFFFF
        if k == 0x18: return c[0x14]
        if k == 0x9B: return c[0x6E]
        if k == 0xA0: return s8(0x73)
        if 0xA5 <= k <= 0xAC: return c[0x76 + k - 0xA4]
        if k == 0xB8: return c[0x84]
        if k in (0xBB, 0xBD, 0xBF, 0xC1, 0xC3): return u16(0x88 + k - 0xBB)
        if k == 0xD8: return s8(0xA0)
        if k == 0xF7: return u16(0xB8)
        if k == 0xF9: return c[0xBA]
        if k == 0x100: return 0x80 if c[0x10D] == 0 else 1
        if k == 0x10C:
            if c[0x10E] == 0 and c[0x10F] != 0: return 0x80
            return 0x81 if c[0x10E] == 1 else 0
        if k == 0x10D: return 0     # uninitialised in the original
        if k == 0x11B: return c[0x11C]
        if k in (0x2B1, 0x2B4): return self.cur
        if k == 0x2CF:
            cha = c[0x15]
            table = {3: 0, 4: 5, 5: 10, 6: 15, 7: 20, 13: 30, 14: 35, 15: 40, 16: 50, 17: 55}
            if 8 <= cha <= 12: return 25
            if 18 <= cha <= 25: return 60
            return table.get(cha, 0)
        if k == 0x312: return self.block
        return None

    def char_view_write(self, v, k):
        """ecl.md, B as a view of the current character (FUN_2fea_0a74)."""
        c = self.char
        if k == 0 and v == 0: self.engine_flags.add('84D3')
        elif 0x20 <= k <= 0x70: c[0x17 + k - 0x20] = v & 0xFF
        elif k == 0xB8: c[0x84] = (v - 0x32 if v > 0xB2 else v) & 0xFF
        elif k in (0xBB, 0xBD, 0xBF, 0xC1, 0xC3): struct.pack_into('<H', c, 0x88 + k - 0xBB, v)
        elif k == 0xF7: struct.pack_into('<H', c, 0xB8, v)
        elif k == 0xF9: c[0xBA] = v & 0xFF
        elif k == 0x100:
            if v > 0x7F:
                c[0x10D] = 0
                if v == 0x87: c[0x10C] = 7
            if v == 0: self.engine_flags.add('84D2')
        elif k == 0x10C:
            if v == 0: c[0x10E], c[0x10F] = 0, 0
            elif v == 0x80: c[0x10E], c[0x10F] = 0, 1
            elif v == 0x81: c[0x10E], c[0x10F] = 1, 1
        elif k == 0x312: self.block = v; self.io.engine('switch block', block=v)
        elif k in (0x322, 0x324, 0x326) and v > 0x80:
            self.io.engine('load wallset', slot=(k - 0x320) // 2, record=v & 0x7F)

    def read_string(self, a):
        out = []
        while len(out) < 80:
            v = self.read(a)
            if v == 0: break
            out.append(chr(v & 0xFF)); a += 1
        return ''.join(out)

    def write_string(self, s, a):
        for ch in s:
            self.write(ord(ch), a); a += 1
        self.write(0, a)
