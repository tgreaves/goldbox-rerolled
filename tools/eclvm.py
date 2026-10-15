"""Headless ECL interpreter for Pool of Radiance (DOS).

Runs area scripts against a real game state (a SAVGAM*.DAT save and its
CHRDAT* characters) with the screens stubbed out. Text is printed, menus are
answered from a queue (or with the first option), and engine screens such as
combat, shops and the party screen are logged instead of run.

It exists to check ../spec/ecl.md against the shipped scripts, and it records
which variables the scripts touch. Opcode behaviour follows the handlers,
including their bugs; see spec/ecl.md for each one.

Usage:
  python3 eclvm.py <game_dir> [--save A] [--moves ffLre] [--answers 0,1,2]
                   [--trace] [--vars] [--seed N]
moves: f forward, b turn around, l/r turn, L look, s search, e encamp
"""
import sys, os, struct, random, argparse, collections
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dax import read_dax, unrle
from ecl import OPS, unpack_text, BASE
from geo import Map

A0, B0, C0 = 0x4900, 0x6B00, 0x9700
CODE_END = 0xB700
CHAR_SIZE = 0x11D
ITEM_SIZE = 0x3F

# ECL addresses with engine meaning (spec/ecl.md, engine-visible variables)
AREA_ID, PREV_X, PREV_Y, GEO_ID, NO_OVERLAND = 0x49F2, 0x49F0, 0x49F1, 0x49C5, 0x49E6
NO_ITEM_USE = 0x49E5
CANCEL_MOVE, SEARCH_LOOK, SURPRISE_RESULT, EDGE = 0x6DC9, 0x6DCA, 0x6DCB, 0x6DD5
OUTCOME, DEFEATED = 0x6DC7, 0x6DC8
SPRITE_MAX, SPRITE_DIST = 0x6DC0, 0x6DC1
REST_INTERVAL, REST_CHANCE, PORTRAIT = 0x6DD2, 0x6DD3, 0x6DE1
TEMPLE_FLAG, SHOP_FLAG, PARTY_SIZE = 0x6DE2, 0x6E6C, 0x6E3E


class Hang(Exception):
    """The original engine would loop forever (no handler for the opcode)."""


class Stub:
    """Screens and input. Override for an interactive front end."""

    def __init__(self, answers=()):
        self.answers = collections.deque(answers)

    def out(self, s):
        print(s)

    def _next(self, default):
        return self.answers.popleft() if self.answers else default

    def choose(self, prompt, options):
        a = self._next(0)
        a = max(0, min(int(a), len(options) - 1)) if options else 0
        self.out('  [menu] %s%s -> %s' % (prompt + ' ' if prompt else '', options, options[a] if options else a))
        return a

    def number(self):
        a = int(self._next(0))
        self.out('  [input number] -> %d' % a)
        return a

    def text(self):
        a = str(self._next(''))
        self.out('  [input text] -> %r' % a)
        return a

    def engine(self, what, **kw):
        self.out('  [engine] %s %s' % (what, ' '.join('%s=%s' % kv for kv in kw.items())))


def u16(b, o): return struct.unpack_from('<H', b, o)[0]
def s8(v): return v - 256 if v & 0x80 else v


class Game:
    def __init__(self, game_dir, io=None, seed=1):
        self.dir = game_dir
        self.io = io or Stub()
        self.rng = random.Random(seed)
        self.A, self.B, self.C = [0] * 0x400, [0] * 0x400, [0] * 0x200
        self.code = bytearray(0x1E00)
        self.nodes = []            # party list DS:5D96: party, then any loaded monsters
        self.items = {}            # id(node) -> list of item bytearrays
        self.cur = None            # current character DS:5D92
        self.saved_cur = None      # DS:4436
        self.restore_cur = False   # DS:4430
        self.block, self.area = 1, 0
        self.geo = None
        self.x = self.y = self.facing2 = 0
        self.regs = {}
        self.flags = dict(EQ=0, NE=0, LT=0, GT=0, LE=0, GE=0)
        self.stack = []
        self.vectors = [BASE + 0x14] * 5
        # operand table (FUN_2fea_0000); HI and the string buffers persist between instructions
        self.kind, self.lo, self.hi = [0] * 33, [0] * 33, [0] * 33
        self.sbuf = [''] * 33
        self.opstr = {}
        self.monster_count, self.monsters_loaded, self.icon_slot = 0, False, 8
        self.money, self.treasure = [0] * 7, []
        self.access = collections.Counter()
        self.trace = False
        self.area_changed = False  # DS:442F
        self.quit = False          # DS:49FF
        self.stop = False          # DS:442E
        self.pc = BASE

    # ---------------------------------------------------------------- data
    def dax(self, name, rid):
        path = os.path.join(self.dir, name + '.DAX')
        if not os.path.exists(path):
            return None
        b, base, ents = read_dax(path)
        for r, off, raw, comp in ents:
            if r == rid:
                return unrle(b[base + off: base + off + comp], raw, 0)[0]
        return None

    def load_save(self, letter='A'):
        d = open(os.path.join(self.dir, 'SAVGAM%s.DAT' % letter), 'rb').read()
        w = lambda o, n: list(struct.unpack_from('<%dH' % n, d, o))
        self.A, self.B, self.C = w(1, 0x400), w(0x801, 0x400), w(0x1001, 0x200)
        self.code = bytearray(d[0x1401:0x3201])
        self.x, self.y, self.facing2 = d[0x3201], d[0x3202], d[0x3203]
        self.nodes = []
        for i in range(d[0x3208]):
            o = 0x3209 + 41 * i
            stem = os.path.join(self.dir, d[o + 1:o + 1 + d[o]].decode('latin1'))
            c = bytearray(open(stem + '.SAV', 'rb').read())
            self.nodes.append(c)
            raw = open(stem + '.ITM', 'rb').read() if os.path.exists(stem + '.ITM') else b''
            self.items[id(c)] = [bytearray(raw[j:j + ITEM_SIZE]) for j in range(0, len(raw) - ITEM_SIZE + 1, ITEM_SIZE)]
        self.cur = self.saved_cur = self.nodes[0] if self.nodes else bytearray(CHAR_SIZE)
        self.block = self.B[0x312]
        self.area = self.A[AREA_ID - A0]
        self.load_geo(self.A[GEO_ID - A0])
        self.reset_vm(keep=True)

    def load_geo(self, rid):
        raw = self.dax('GEO%d' % self.block, rid)
        self.geo = Map(raw) if raw else None

    def load_ecl(self, rid):
        raw = self.dax('ECL%d' % self.block, rid)
        if raw is None:
            raise RuntimeError('no ECL record %d in block %d' % (rid, self.block))
        self.code = bytearray(0x1E00)
        self.code[:len(raw) - 2] = raw[2:]

    def reset_vm(self, keep=False):
        """FUN_2fea_01b6."""
        self.stack = []
        for k in self.flags: self.flags[k] = 0
        self.vectors = [self._goto_target(BASE + 4 * i) for i in range(5)]
        self.icon_slot = 8
        self.B[PORTRAIT - B0] = 0xFF
        self.B[REST_INTERVAL - B0] = self.B[REST_CHANCE - B0] = 0
        self.A[NO_ITEM_USE - A0] = 0
        self.A[NO_OVERLAND - A0] = 1
        if not keep:
            for a in range(0x4A00, 0x4A20): self.A[a - A0] = 0
            for a in range(0x6E79, 0x6E83): self.B[a - B0] = 0

    def _goto_target(self, a):
        saved = self.pc
        self.pc = a
        self.readops(1)
        self.pc = saved
        return self.addr(1)

    # ------------------------------------------------------------- memory
    def facing(self):
        return self.facing2 >> 1

    def square(self):
        if not self.geo:
            return 0, 0
        return self.geo.wall(self.x, self.y, self.facing()), self.geo.planes[2][(self.y & 15) * 16 + (self.x & 15)]

    def read(self, a):
        self.access['r', a] += 1
        if A0 <= a < 0x4D00: return self.A[a - A0]
        if B0 <= a < 0x6F00:
            v = self.char_view_read(a - B0)
            return self.B[a - B0] if v is None else v
        if C0 <= a < 0x9900: return self.C[a - C0]
        if BASE <= a < CODE_END: return self.code[a - BASE]
        if a == 0xC04B: return self.x
        if a == 0xC04C: return self.y
        if a == 0xC04D: return self.facing()
        if a == 0xC04E: return self.square()[0]
        if a == 0xC04F: return self.square()[1]
        if a == 0x033D: return self.facing2
        return self.regs.get(a, 0)  # the original returns garbage for unknown addresses

    def write(self, a, v):
        v &= 0xFFFF
        self.access['w', a] += 1
        if A0 <= a < 0x4D00:
            self.A[a - A0] = v
        elif B0 <= a < 0x6F00:
            self.B[a - B0] = v
            self.char_view_write(a - B0, v)
        elif C0 <= a < 0x9900:
            self.C[a - C0] = v
        elif BASE <= a < CODE_END:
            self.code[a - BASE] = v & 0xFF
        elif a == 0xC04B: self.x = v & 0xFF
        elif a == 0xC04C: self.y = v & 0xFF
        elif a == 0xC04D: self.facing2 = (v % 4) * 2
        elif a in (0xC059, 0xC05F, 0x3DE, 0xB8, 0xB9): self.regs[a] = v

    def char_view_read(self, k):
        """B as a view of the current character (FUN_2fea_07bc)."""
        c = self.cur
        if k == 0x18: return c[0x14]
        if k == 0x9B: return c[0x6E]
        if k == 0xA0: return s8(c[0x73]) & 0xFFFF
        if 0xA5 <= k <= 0xAC: return c[0x76 + k - 0xA4]
        if k == 0xB8: return c[0x84]
        if k in (0xBB, 0xBD, 0xBF, 0xC1, 0xC3): return u16(c, 0x88 + k - 0xBB)
        if k == 0xD8: return s8(c[0xA0]) & 0xFFFF
        if k == 0xF7: return u16(c, 0xB8)
        if k == 0xF9: return c[0xBA]
        if k == 0x100: return 0x80 if c[0x10D] == 0 else 1
        if k == 0x10C:
            if c[0x10E] == 0 and c[0x10F] != 0: return 0x80
            return 0x81 if c[0x10E] == 1 else 0
        if k == 0x10D: return 0     # uninitialised in the original
        if k == 0x11B: return c[0x11C]
        if k in (0x2B1, 0x2B4): return self.nodes.index(c) if c in self.nodes else 0
        if k == 0x2CF:
            cha = c[0x15]
            if 8 <= cha <= 12: return 25
            if 18 <= cha <= 25: return 60
            return {3: 0, 4: 5, 5: 10, 6: 15, 7: 20, 13: 30, 14: 35, 15: 40, 16: 50, 17: 55}.get(cha, 0)
        if k == 0x312: return self.block
        return None

    def char_view_write(self, k, v):
        """B as a view of the current character (FUN_2fea_0a74)."""
        c = self.cur
        if 0x20 <= k <= 0x70: c[0x17 + k - 0x20] = v & 0xFF
        elif k == 0xB8: c[0x84] = (v - 0x32 if v > 0xB2 else v) & 0xFF
        elif k in (0xBB, 0xBD, 0xBF, 0xC1, 0xC3): struct.pack_into('<H', c, 0x88 + k - 0xBB, v)
        elif k == 0xF7: struct.pack_into('<H', c, 0xB8, v)
        elif k == 0xF9: c[0xBA] = v & 0xFF
        elif k == 0x100:
            if v > 0x7F:
                c[0x10D] = 0
                if v == 0x87: c[0x10C] = 7
        elif k == 0x10C:
            if v == 0: c[0x10E], c[0x10F] = 0, 0
            elif v == 0x80: c[0x10E], c[0x10F] = 0, 1
            elif v == 0x81: c[0x10E], c[0x10F] = 1, 1
        elif k == 0x312:
            self.block = v
            self.io.engine('switch block', block=v)
        elif k in (0x322, 0x324, 0x326) and v > 0x80:
            self.io.engine('load wallset', slot=(k - 0x320) // 2, record=v & 0x7F)

    def read_string(self, a):
        """FUN_2fea_12fb."""
        if a == B0:
            return self.cur[1:1 + self.cur[0]].decode('latin1')
        if not (A0 <= a < 0x4D00 or B0 <= a < 0x6F00 or C0 <= a < 0x9900 or BASE <= a < CODE_END):
            return ''
        out = []
        while len(out) < 255:
            v = self.read(a) & 0xFF
            if v == 0: break
            out.append(chr(v)); a += 1
        return ''.join(out)

    def store_string(self, a, s):
        """FUN_2fea_0f53. An empty string also clobbers the next 255 words in
        the original (stack garbage); here only the terminator is written."""
        if a == B0:
            n = s[:15].encode('latin1')
            self.cur[0] = len(n); self.cur[1:1 + len(n)] = n
            return
        for ch in s:
            self.write(a, ord(ch)); a += 1
        self.write(a, 0)

    # ------------------------------------------------------------ operands
    def readops(self, n):
        """FUN_2fea_0000, entered with PC on the opcode byte."""
        k = 0
        self.opstr = {}
        for i in range(1, n + 1):
            p = self.pc - BASE
            self.kind[i], self.lo[i] = self.code[p + 1], self.code[p + 2]
            self.pc += 2
            if self.kind[i] in (1, 2, 3, 0x81):
                self.hi[i] = self.code[self.pc - BASE + 1]
                self.pc += 1
            if self.kind[i] == 0x80:
                k += 1
                p = self.pc - BASE + 1
                self.sbuf[k] = unpack_text(self.code[p:p + self.lo[i]])
                self.pc += self.lo[i]
                self.opstr[i] = self.sbuf[k]
            elif self.kind[i] == 0x81:
                k += 1
                self.sbuf[k] = self.read_string(self.addr(i))
                self.opstr[i] = self.sbuf[k]
        self.pc += 1

    def addr(self, i):
        return self.hi[i] << 8 | self.lo[i]

    def val(self, i):
        """FUN_2fea_0136."""
        k = self.kind[i]
        if k == 0: return self.lo[i]
        if k in (1, 3, 0x80): return self.read(self.addr(i))
        if k in (2, 0x81): return self.addr(i)
        return 0

    def text(self, i):
        return self.opstr[i] if i in self.opstr else str(self.val(i))

    def variadic(self, fixed, count_index):
        self.readops(fixed)
        n = self.val(count_index) & 0xFF
        head = [(self.kind[i], self.lo[i], self.hi[i], self.opstr.get(i)) for i in range(1, fixed + 1)]
        self.pc -= 1
        self.readops(n)
        return n, head

    # ------------------------------------------------------------- running
    def run(self, start, label=''):
        """FUN_29c3_3171."""
        if self.trace: self.io.out('-- run %s %04X' % (label, start))
        self.pc = start
        self.stop = False
        steps = 0
        while not self.stop and not self.quit:
            steps += 1
            if steps > 200000:
                raise RuntimeError('runaway script at %04X' % self.pc)
            op = self.code[self.pc - BASE]
            name = OPS.get(op, ('?',))[0]
            h = getattr(self, 'op_' + name.lower(), None)
            if h is None:
                raise Hang('no handler for opcode %02X at %04X' % (op, self.pc))
            if self.trace: self.io.out('   %04X %s' % (self.pc, name))
            h()

    def roll(self, count, sides):
        return sum(self.rng.randrange(sides) + 1 for _ in range(count)) if sides else 0

    def set_flags(self, a, b):
        f = self.flags
        f['EQ'], f['NE'], f['LT'] = int(a == b), int(a != b), int(a < b)
        f['GT'], f['LE'], f['GE'] = int(a > b), int(a <= b), int(a >= b)

    def name(self, c):
        return c[1:1 + c[0]].decode('latin1')

    # ---------------------------------------------------- control flow ops
    def op_exit(self):
        self.readops(0)
        if self.restore_cur:
            self.cur, self.restore_cur = self.saved_cur, False
        self.stop = True
        self.stack = []

    def op_goto(self):
        self.readops(1); self.pc = self.addr(1)

    def op_gosub(self):
        self.readops(1); self.stack.append(self.pc); self.pc = self.addr(1)

    def op_return(self):
        self.readops(0)
        if self.stack: self.pc = self.stack.pop()

    def _if(self, flag):
        self.readops(0)
        if not self.flags[flag]:
            op = self.code[self.pc - BASE]
            if op in SKIP_COUNT: self.readops(SKIP_COUNT[op])
            else: self.pc += 1

    def op_if_eq(self): self._if('EQ')
    def op_if_ne(self): self._if('NE')
    def op_if_lt(self): self._if('LT')
    def op_if_gt(self): self._if('GT')
    def op_if_le(self): self._if('LE')
    def op_if_ge(self): self._if('GE')

    def _on(self, push):
        self.readops(2)
        i, n = self.val(1) & 0xFF, self.val(2) & 0xFF
        self.pc -= 1
        self.readops(n)
        if i < n:
            if push: self.stack.append(self.pc)
            self.pc = self.addr(i + 1)

    def op_on_goto(self): self._on(False)
    def op_on_gosub(self): self._on(True)

    # ---------------------------------------------------- data and maths
    def op_compare(self):
        self.readops(2)
        if self.kind[1] >= 0x80 or self.kind[2] >= 0x80:
            a, b = self.sbuf[1], self.sbuf[2]
        else:
            a, b = self.val(1), self.val(2)
        self.set_flags(a, b)

    def op_compare_and(self):
        self.readops(4)
        for k in self.flags: self.flags[k] = 0
        eq = self.val(1) == self.val(2) and self.val(3) == self.val(4)
        self.flags['EQ' if eq else 'NE'] = 1

    def op_add(self):
        self.readops(3); self.write(self.addr(3), self.val(1) + self.val(2))

    def op_subtract(self):
        self.readops(3); self.write(self.addr(3), self.val(2) - self.val(1))

    def op_multiply(self):
        self.readops(3); self.write(self.addr(3), self.val(1) * self.val(2))

    def op_divide(self):
        self.readops(3)
        if self.val(2) == 0:
            raise ZeroDivisionError('DIVIDE by 0 at %04X (runtime error 200 in the original)' % self.pc)
        self.write(self.addr(3), self.val(1) // self.val(2))

    def _bitop(self, f):
        self.readops(3)
        r = f(self.val(1), self.val(2)) & 0xFF
        self.set_flags(0, r)
        self.write(self.addr(3), r)

    def op_and(self): self._bitop(lambda a, b: a & b)
    def op_or(self): self._bitop(lambda a, b: a | b)

    def op_random(self):
        self.readops(2)
        m = self.val(1) & 0xFF
        if m < 255: m += 1
        self.write(self.addr(2), self.rng.randrange(m))

    def op_save(self):
        self.readops(2)
        if self.kind[1] < 0x80: self.write(self.addr(2), self.val(1))
        else: self.store_string(self.addr(2), self.sbuf[1])

    def op_get_table(self):
        self.readops(3)
        self.write(self.addr(3), self.read(self.addr(1) + (self.val(2) & 0xFF)))

    def op_save_table(self):
        self.readops(3)
        self.write((self.addr(2) + self.val(3)) & 0xFFFF, self.val(1))

    # ------------------------------------------------------------- text
    def op_print(self):
        self.readops(1); self.io.out(self.text(1))

    def op_print_clear(self):
        self.readops(1); self.io.out('[clear] ' + self.text(1))

    def op_newline(self): self.readops(0)
    def op_pause(self): self.readops(0)  # waits game speed x 225 ms in the original
    def op_clear_top(self): self.readops(0)

    def op_print_list(self):
        self.readops(1)
        a, glyphs = self.addr(1), []
        while True:
            g = (self.read(a) + 1) & 0xFF
            if g <= 1: break
            glyphs.append(g); a += 1
        self.io.engine('glyph row', glyphs=glyphs)

    # ------------------------------------------------------------- input
    def op_input_number(self):
        self.readops(2); self.write(self.addr(2), self.io.number() & 0xFFFF)

    def op_input_string(self):
        self.readops(2)
        s = self.io.text().upper()[:40] or ' '
        self.store_string(self.addr(2), s)

    def op_vmenu(self):
        n, head = self.variadic(3, 3)
        prompt = head[1][3] or ''
        items = [self.text(i) for i in range(1, n + 1)]
        dest = head[0][2] << 8 | head[0][1]
        self.io.out('[clear] ' + prompt)
        self.write(dest, self.io.choose('', items))

    def op_hmenu(self):
        n, head = self.variadic(2, 2)
        items = [self.text(i) for i in range(1, n + 1)]
        dest = head[0][2] << 8 | head[0][1]
        self.write(dest, self.io.choose('', items) & 0xFF)

    def op_parlay(self):
        self.readops(6)
        c = self.io.choose('', ['HAUGHTY', 'SLY', 'NICE', 'MEEK', 'ABUSIVE'])
        self.write(self.addr(6), self.val(c + 1) & 0xFF)

    def op_who(self):
        self.readops(1)
        names = [self.name(c) for c in self.nodes[:self.B[PARTY_SIZE - B0]] or self.nodes]
        self.cur = self.nodes[self.io.choose(self.text(1), names)]

    # -------------------------------------------------------- characters
    def op_load_character(self):
        self.readops(1)
        self.restore_cur = True
        n = self.val(1) & 0x7F
        if n < len(self.nodes): self.cur = self.nodes[n]

    def op_party_strength(self):
        self.readops(1)
        t = 0
        for c in self.nodes:
            t = (t + (c[0x11B] + 5 * max(c[0x111] - 60, 0) + 5 * max(c[0x110] - 39, 0)
                      + 8 * c[0x9B] + 4 * c[0x96]) // 10) & 0xFF
        self.write(self.addr(1), t)

    def op_check_party(self):
        self.readops(6)
        sel = self.addr(1) if self.kind[1] == 1 else self.val(1)
        dests = [self.addr(i) for i in (3, 4, 5, 6)]
        if sel == 0:
            self.io.engine('CHECK_PARTY effect test (effects not modelled)', effect=self.val(2))
            vals = (0, 0, 0, 0)
        elif sel in (0x6BA7, 0x6C1B):
            off = 0x79 if sel == 0x6BA7 else 0x11C
            xs = [c[off] for c in self.nodes]
            vals = (min(xs), max(xs), sum(xs) // len(xs), 0)
        else:
            return
        for d, v in zip(dests, vals): self.write(d, v)

    def op_party_has_ranger(self):
        self.readops(2)
        self.write(self.addr(1), int(any(c[0x2F] in (4, 10) for c in self.nodes)))
        self.write(self.addr(2), 0)

    def op_find_item(self):
        self.readops(1)
        t = self.val(1) & 0xFF
        found = any(it[0x2E] == t for c in self.nodes for it in self.items.get(id(c), []))
        for k in self.flags: self.flags[k] = 0
        self.flags['EQ' if found else 'NE'] = 1

    def op_find_in_char_list(self):
        self.readops(3)
        v, c = self.val(1) & 0xFF, self.nodes[0]
        idx = next((i for i in range(1, 0x53) if c[0x17 + i] == v), 0xFF)
        # the original keeps the destination addresses as bytes: results land in engine space
        self.write(self.addr(2) & 0xFF, idx)
        self.write(self.addr(3) & 0xFF, 1)

    def op_add_npc(self):
        self.readops(2)
        self.io.engine('ADD_NPC', id=self.val(1), morale=self.val(2))

    def op_rob(self):
        self.readops(3)
        p = self.val(2)
        for c in ([self.cur] if self.val(1) == 0 else self.nodes):
            for j in range(7):
                o = 0x88 + 2 * j
                struct.pack_into('<H', c, o, u16(c, o) * (100 - p) // 100)
        self.io.engine('ROB items', percent=p)

    def op_damage(self):
        """Handler 29c3:2775 (traced in this session, see spec/ecl.md)."""
        self.readops(5)
        flags, count, sides, bonus, save = (self.val(i) & 0xFF for i in range(1, 6))
        party = self.nodes[:self.B[PARTY_SIZE - B0]] or self.nodes
        dmg = lambda: bonus + self.roll(count, sides)

        def saved(c, kind, b):
            r = self.roll(1, 20)
            if r == 1: return False
            if r == 20: return True
            return c[0x6D + kind] <= r + s8(c[0x101]) + b

        def hit(c):
            r = self.roll(1, 20)
            if r == 1: return False
            if r == 20: r = 100
            return c[0x111] < r + save

        def apply(c, d):
            c[0x11B] = max(c[0x11B] - d, 0)
            self.io.engine('damage', who=self.name(c), hp=d)

        if not flags & 0x80:
            for _ in range(flags):
                c = self.rng.choice(party)
                if hit(c): apply(c, dmg())
        else:
            b, kind = flags & 0x1F, save & 7
            if not flags & 0x40:
                if not save & 0x80:
                    c = self.rng.choice(party)
                    if not saved(c, kind, b): apply(c, dmg())
                elif not (kind and saved(self.cur, kind - 1, b)):
                    apply(self.cur, dmg())
            else:
                for c in party:
                    if flags & 0x20 or not saved(c, kind, b): apply(c, dmg())
        if all(c[0x11B] == 0 for c in party):
            self.io.engine('party dead')
            self.quit = True

    # ----------------------------------------------------- encounters
    def ahead(self):
        """FUN_2fea_0482: open squares ahead, at most 2."""
        if self.A[NO_OVERLAND - A0] == 0 or not self.geo:
            return 2
        x, y, n = self.x, self.y, 0
        while n < 2 and self.geo.passage(x, y, self.facing()) == 1:
            dx, dy = [(0, -1), (1, 0), (0, 1), (-1, 0)][self.facing()]
            x, y, n = (x + dx) & 15, (y + dy) & 15, n + 1
        return n

    def op_load_monster(self):
        self.readops(3)
        if self.monster_count >= 63: return
        raw = self.dax('MON%dCHA' % self.block, self.val(1))
        if raw is None:
            self.io.engine('LOAD_MONSTER missing record', id=self.val(1)); return
        for _ in range(max(self.val(2), 1)):
            if self.monster_count >= 63: break
            m = bytearray(raw[:CHAR_SIZE].ljust(CHAR_SIZE, b'\0'))
            m[0xBF] = self.icon_slot
            self.nodes.append(m)
            self.monster_count += 1
        self.icon_slot += 1
        self.monsters_loaded = True
        self.io.engine('LOAD_MONSTER', id=self.val(1), name=self.name(m), count=max(self.val(2), 1))

    def op_clear_monsters(self):
        self.readops(0)
        self.monster_count, self.monsters_loaded, self.icon_slot = 0, False, 8
        self.money, self.treasure = [0] * 7, []

    def op_setup_monster(self):
        self.readops(3)
        self.B[SPRITE_MAX - B0] = self.val(2)
        self.B[SPRITE_DIST - B0] = min(self.val(2), self.ahead())
        self.io.engine('sprite', sprite=self.val(1), picture=self.val(3), dist=self.B[SPRITE_DIST - B0])

    def op_approach(self):
        self.readops(0)
        if self.B[SPRITE_DIST - B0]: self.B[SPRITE_DIST - B0] -= 1

    def op_picture(self):
        self.readops(1)
        n = self.val(1)
        if n != 255:
            self.io.engine('picture', pic=n, portrait=self.B[PORTRAIT - B0] != 0xFF)

    def op_surprise(self):
        self.readops(4)
        v = [self.val(i) & 0xFF for i in range(1, 5)]
        a, b = s8((v[3] + 2 - v[0]) & 0xFF), s8((v[1] + 2 - v[2]) & 0xFF)
        r1, r2 = self.roll(1, 6), self.roll(1, 6)
        res = 0
        if r1 <= a: res = 3 if r2 <= b else 1
        if r2 <= b: res = 2
        self.write(SURPRISE_RESULT, res)

    def op_encounter_menu(self):
        self.readops(14)
        moves = [c[0x11C] for c in self.nodes] or [12]
        lo, hi = min(moves), max(moves)
        r = [self.val(i) & 0xFF for i in range(5, 10)]
        texts = [self.opstr.get(i, '') for i in (10, 11, 12)]
        f, g = self.val(13), self.val(14)
        dest = self.addr(4)
        dist = min(self.val(2), self.ahead())
        self.B[SPRITE_DIST - B0] = dist
        self.io.engine('encounter sprite', sprite=self.val(1), dist=dist)
        for _ in range(50):
            t = next((texts[(dist + j) % 3] for j in range(3) if texts[(dist + j) % 3]), '')
            if t: self.io.out('[clear] ' + t)
            close = dist == 0 or self.A[NO_OVERLAND - A0] == 0
            opts = ['COMBAT', 'WAIT', 'FLEE', 'PARLAY' if close else 'ADVANCE']
            c = self.io.choose('', opts)
            if c == 3 and close: c = 4
            code = r[c]
            act = ENCOUNTER_TABLE.get(code, {}).get(c, 'exit') if code < 5 else 'exit'
            if act == 'exit': return
            if act == 'wait':
                self.io.out('Both sides wait.'); continue
            if act == 'approach' or (act == 'parlay_or_approach' and dist):
                if dist == 0: self.io.out('Both sides wait.')
                else: dist -= 1; self.B[SPRITE_DIST - B0] = dist
                continue
            if act == 'parlay_or_approach': v = 3
            elif act == 'flee_check': v = 1 if lo < f else 2
            elif act == 'pursuit_check': v = 0 if hi < g else 1
            else: v = act
            if v == 0: self.io.out('The monsters flee.')
            self.write(dest, v)
            return

    def op_combat(self):
        self.readops(0)
        if not self.monsters_loaded:
            if self.B[SHOP_FLAG - B0] == 1:
                self.B[SHOP_FLAG - B0] = 0; self.io.engine('SHOP')
            elif self.B[TEMPLE_FLAG - B0] == 1:
                self.B[TEMPLE_FLAG - B0] = 0; self.io.engine('TEMPLE')
            else:
                self.io.engine('TREASURE screen', money=self.money, items=len(self.treasure))
        else:
            names = collections.Counter(self.name(m) for m in self.nodes[len(self.nodes) - self.monster_count:])
            self.io.engine('COMBAT', monsters=dict(names))
            # aftermath FUN_2e08_1527: the stub always wins and defeats every monster
            self.B[OUTCOME - B0] = 0
            self.B[DEFEATED - B0] = self.monster_count
            del self.nodes[len(self.nodes) - self.monster_count:]
            self.monster_count, self.monsters_loaded = 0, False
            for a in (0x6DE3, 0x6DE6, 0x6E70, 0x6E71, 0x6E72): self.B[a - B0] = 0
        self.B[SEARCH_LOOK - B0] &= 1

    def op_treasure(self):
        self.readops(8)
        self.money = [self.val(i) for i in range(1, 8)]
        spec = self.val(8) & 0xFF
        if spec < 0x80:
            raw = self.dax('ITEM%d' % self.block, spec) or b''
            new = [raw[j:j + ITEM_SIZE] for j in range(0, len(raw), ITEM_SIZE)]
            self.treasure = list(reversed(new)) + self.treasure
        elif spec != 0xFF:
            self.treasure = ['random'] * (spec - 0x80) + self.treasure
        self.io.engine('TREASURE', money=self.money, item_spec=spec)

    # ---------------------------------------------------- world / engine
    def op_new_ecl(self):
        self.readops(1)
        self.A[AREA_ID - A0] = self.area
        self.area = self.val(1)
        self.io.engine('NEW_ECL', area=self.area)
        self.load_ecl(self.area)
        self.reset_vm()
        self.stop = True
        self.area_changed = True

    def op_load_area(self):
        self.readops(3)
        b1 = self.val(1) & 0xFF
        if b1 not in (0xFF, 0x7F) and self.A[NO_OVERLAND - A0]:
            self.A[GEO_ID - A0] = b1
            self.load_geo(b1)
            self.B[CANCEL_MOVE - B0] = 0
            self.io.engine('LOAD_AREA', geo=b1)

    def op_load_wallsets(self):
        self.readops(3)
        self.io.engine('LOAD_WALLSETS', sets=[self.val(i) & 0xFF for i in (1, 2, 3)])

    def op_program(self):
        self.readops(1)
        if self.restore_cur:
            self.cur, self.restore_cur = self.saved_cur, False
        n = self.val(1)
        if n == 9:
            pc = self.pc
            self.run(self.vectors[2], 'camp_menu')
            self.io.engine('camp screen (no interruption)')
            self.pc = pc
        else:
            self.io.engine('PROGRAM', n={0: 'party screen', 8: 'ending'}.get(n, n))
            if n == 0: self.quit = True
        self.op_exit_now()

    def op_exit_now(self):
        self.stop = True
        self.stack = []

    def op_call(self):
        self.readops(1)
        a = self.addr(1)
        if a == 0xC01E:
            dx, dy = [(0, -1), (1, 0), (0, 1), (-1, 0)][self.facing()]
            self.x, self.y = (self.x + dx) & 15, (self.y + dy) & 15
        self.io.engine('CALL', addr='%04X' % a)

    def op_redraw(self): self.readops(0)

    def op_delay(self):
        self.readops(1)
        self.io.engine('pass time (DELAY)')

    # --------------------------------------------------------- game loop
    def enter(self):
        """FUN_29c3_31b4: re-enter after an area change."""
        while True:
            self.area_changed = False
            self.B[EDGE - B0] = 0
            self.run(self.vectors[4], 'on_enter')
            if self.quit: return
            self.area_changed = False
            self.run(self.vectors[0], 'on_move')
            if not self.area_changed and not self.quit:
                self.run(self.vectors[1], 'on_step')
            if not self.area_changed or self.quit:
                return

    def command(self, c):
        """One exploration command in a map area (spec/architecture.md)."""
        if c in 'lrb':
            self.facing2 = (self.facing2 + {'l': 6, 'r': 2, 'b': 4}[c]) % 8
            return
        if c == 's':
            self.B[SEARCH_LOOK - B0] ^= 1
            return
        if c == 'e':
            self.run(self.vectors[2], 'camp_menu')
            self.io.engine('camp screen')
            return
        if c == 'L':
            keep = self.B[SEARCH_LOOK - B0] & 1
            self.B[SEARCH_LOOK - B0] = 1
            self.area_changed = False
            self.run(self.vectors[1], 'on_step (look)')
            if self.area_changed: self.enter()
            self.B[SEARCH_LOOK - B0] = keep
            return
        # FUN_3e76_068d: flag a move off the edge of the map
        self.B[EDGE - B0] = 0
        if self.geo and self.geo.passage(self.x, self.y, self.facing()):
            dx, dy = [(0, -1), (1, 0), (0, 1), (-1, 0)][self.facing()]
            if not (0 <= self.x + dx <= 15 and 0 <= self.y + dy <= 15):
                self.B[EDGE - B0] = 1
        self.area_changed = False
        self.run(self.vectors[0], 'on_move')
        if self.area_changed:
            self.enter(); return
        self.A[PREV_X - A0], self.A[PREV_Y - A0] = self.x, self.y
        if self.B[CANCEL_MOVE - B0] >= 0xFF:
            self.B[CANCEL_MOVE - B0] = 0
        elif self.geo:
            p = self.geo.passage(self.x, self.y, self.facing())
            if p == 1:
                dx, dy = [(0, -1), (1, 0), (0, 1), (-1, 0)][self.facing()]
                self.x, self.y = (self.x + dx) & 15, (self.y + dy) & 15
            else:
                self.io.engine('blocked' if p == 0 else 'locked door')
        self.area_changed = False
        self.run(self.vectors[1], 'on_step')
        if self.area_changed: self.enter()


# operand counts used by the IF skip routine FUN_2fea_1ea6; every other opcode
# (including the variadic 0x15, 0x25, 0x26, 0x2B) is skipped as a single byte
SKIP_COUNT = {}
for _n, _ops in {1: (0x01, 0x02, 0x0A, 0x0E, 0x11, 0x12, 0x1D, 0x20, 0x2D, 0x32, 0x34, 0x36, 0x38, 0x39, 0x3C),
                 2: (0x03, 0x08, 0x09, 0x0C, 0x0F, 0x10, 0x1F, 0x22),
                 3: (0x04, 0x05, 0x06, 0x07, 0x0B, 0x21, 0x28, 0x2A, 0x2F, 0x30, 0x35, 0x37, 0x3B),
                 4: (0x14, 0x23), 5: (0x2E,), 6: (0x1E, 0x2C), 8: (0x27,), 14: (0x29,)}.items():
    for _o in _ops: SKIP_COUNT[_o] = _n

# ENCOUNTER_MENU reaction table: code -> {choice: action}; choices 0 COMBAT,
# 1 WAIT, 2 FLEE, 3 ADVANCE, 4 PARLAY; numbers are the value stored
_P = 'parlay_or_approach'
ENCOUNTER_TABLE = {
    0: {0: 1, 1: 1, 2: 'flee_check', 3: 1, 4: 1},
    1: {0: 1, 1: 'wait', 2: 2, 3: 'approach', 4: _P},
    2: {0: 'pursuit_check', 1: 0, 2: 0, 3: 0, 4: 0},
    3: {0: 1, 1: 'approach', 2: 2, 3: 'approach', 4: _P},
    4: {0: 1, 1: _P, 2: 2, 3: _P, 4: _P},
}


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('game_dir')
    ap.add_argument('--save', default='A')
    ap.add_argument('--moves', default='', help='f b l r L s e')
    ap.add_argument('--answers', default='', help='comma-separated menu/input answers')
    ap.add_argument('--trace', action='store_true')
    ap.add_argument('--vars', action='store_true', help='print variable access summary')
    ap.add_argument('--seed', type=int, default=1)
    a = ap.parse_args()
    answers = [int(x) if x.lstrip('-').isdigit() else x for x in a.answers.split(',') if x]
    g = Game(a.game_dir, Stub(answers), a.seed)
    g.trace = a.trace
    g.load_save(a.save)
    print('== block %d area %d at (%d,%d) facing %s; party: %s' % (
        g.block, g.area, g.x, g.y, 'NESW'[g.facing()], ', '.join(g.name(c) for c in g.nodes)))
    g.run(g.vectors[4], 'on_enter')
    for c in a.moves:
        if g.quit: break
        print('== %r at (%d,%d) facing %s' % (c, g.x, g.y, 'NESW'[g.facing()]))
        g.command(c)
    print('== end: area %d at (%d,%d) facing %s' % (g.area, g.x, g.y, 'NESW'[g.facing()]))
    if a.vars:
        print('== variables touched (not code)')
        for (rw, ad), n in sorted(g.access.items(), key=lambda kv: (kv[0][1], kv[0][0])):
            if not BASE <= ad < CODE_END:
                print('  %s %04X x%d' % (rw, ad, n))


if __name__ == '__main__':
    main()
