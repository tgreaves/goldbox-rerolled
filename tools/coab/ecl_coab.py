"""ECL bytecode disassembler for Curse of the Azure Bonds (DOS, GOG 1.0).

Adapted from pool-of-radiance-re/tools/ecl.py. CotAB engine facts (image
addresses, see spec/A-games/coab/ecl.md):
  - dispatcher 0x1BBF2 (ovr 1885:33A2), run loop 0x1BE57, operand reader 0x1FA02
  - code buffer 0x1E00 bytes at virtual 0x8000-0x9DFF (PoR: 0x9900-0xB6FF)
  - opcodes 0x00-0x40 (0x1F has no handler); operand encoding unchanged from PoR
  - also reads Secret of the Silver Blades' scripts (the same layout and base), with its 0x41

Usage:
  python3 ecl_coab.py <ECLn.DAX> [record_id]       listing (reachable code)
  python3 ecl_coab.py --stats <ECLn.DAX> ...       summary over all records
"""
import sys, os, struct
from collections import Counter

BASE = 0x8000          # virtual address of record byte 2 (reset PC, 0x1FBF7)
SIZE = 0x1E00          # code buffer (alloc at 0x26B13, load 0x1FD3C)
VECTORS = ['on_move', 'on_step', 'camp_menu', 'camp_confirmed', 'on_enter']

# opcode -> (mnemonic, fixed operand count, index of count operand or None)
# counts are the argument of the operand-reader call (0x1FA02) in each handler
OPS = {
    0x00: ('EXIT', 0, None),            0x01: ('GOTO', 1, None),
    0x02: ('GOSUB', 1, None),           0x03: ('COMPARE', 2, None),
    0x04: ('ADD', 3, None),             0x05: ('SUBTRACT', 3, None),
    0x06: ('DIVIDE', 3, None),          0x07: ('MULTIPLY', 3, None),
    0x08: ('RANDOM', 2, None),          0x09: ('SAVE', 2, None),
    0x0A: ('LOAD_CHARACTER', 1, None),  0x0B: ('LOAD_MONSTER', 3, None),
    0x0C: ('SETUP_MONSTER', 3, None),   0x0D: ('APPROACH', 0, None),
    0x0E: ('PICTURE', 1, None),         0x0F: ('INPUT_NUMBER', 2, None),
    0x10: ('INPUT_STRING', 2, None),    0x11: ('PRINT', 1, None),
    0x12: ('PRINT_CLEAR', 1, None),     0x13: ('RETURN', 0, None),
    0x14: ('COMPARE_AND', 4, None),     0x15: ('VMENU', 3, 2),
    0x16: ('IF_EQ', 0, None),           0x17: ('IF_NE', 0, None),
    0x18: ('IF_LT', 0, None),           0x19: ('IF_GT', 0, None),
    0x1A: ('IF_LE', 0, None),           0x1B: ('IF_GE', 0, None),
    0x1C: ('CLEAR_MONSTERS', 0, None),  0x1D: ('PARTY_STRENGTH', 1, None),
    0x1E: ('CHECK_PARTY', 6, None),
    0x20: ('NEW_ECL', 1, None),         0x21: ('LOAD_AREA', 3, None),
    0x22: ('PARTY_HAS_RANGER', 2, None),0x23: ('SURPRISE', 4, None),
    0x24: ('COMBAT', 0, None),          0x25: ('ON_GOTO', 2, 1),
    0x26: ('ON_GOSUB', 2, 1),           0x27: ('TREASURE', 8, None),
    0x28: ('ROB', 3, None),             0x29: ('ENCOUNTER_MENU', 14, None),
    0x2A: ('GET_TABLE', 3, None),       0x2B: ('HMENU', 2, 1),
    0x2C: ('PARLAY', 6, None),          0x2D: ('CALL', 1, None),
    0x2E: ('DAMAGE', 5, None),          0x2F: ('AND', 3, None),
    0x30: ('OR', 3, None),              0x31: ('REDRAW', 0, None),
    0x32: ('FIND_ITEM', 1, None),       0x33: ('NEWLINE', 0, None),
    0x34: ('PASS_TIME', 2, None),       0x35: ('SAVE_TABLE', 3, None),
    0x36: ('ADD_NPC', 2, None),         0x37: ('LOAD_WALLSETS', 3, None),
    0x38: ('PROGRAM', 1, None),         0x39: ('WHO', 1, None),
    0x3A: ('PAUSE', 0, None),           0x3B: ('FIND_SPELL', 3, None),
    0x3C: ('PROTECTION', 1, None),      0x3D: ('REDRAW_SCREEN', 0, None),
    0x3E: ('DROP_CHARACTER', 0, None),  0x3F: ('FIND_EFFECT', 1, None),
    0x40: ('DESTROY_ITEMS', 1, None),
    0x41: ('ADD_EXPERIENCE', 2, None),  # Secret of the Silver Blades only (spec/A-games/sotsb/ecl.md)
}
TERMINAL = {0x00, 0x01, 0x13, 0x20}

# operand counts used by the IF skip routine (0x219A2); opcodes not listed
# skip just the opcode byte. Differs from the handlers for 0x34 and 0x36.
SKIP = {}
for n, ops in ((1, [0x01, 0x02, 0x0A, 0x0E, 0x11, 0x12, 0x1D, 0x20, 0x2D, 0x32,
                    0x34, 0x36, 0x38, 0x39, 0x3C, 0x3F, 0x40]),
               (2, [0x03, 0x08, 0x09, 0x0F, 0x10, 0x1F, 0x22, 0x41]),
               (3, [0x04, 0x05, 0x06, 0x07, 0x0B, 0x0C, 0x21, 0x28, 0x2A, 0x2F,
                    0x30, 0x35, 0x37, 0x3B]),
               (4, [0x14, 0x23]), (5, [0x2E]), (6, [0x1E, 0x2C]), (8, [0x27]),
               (14, [0x29])):
    for o in ops: SKIP[o] = n

# CALL targets (handler 0x1B773): address -> name
CALLS = {0x2E10: 'refresh_square', 0x8000: 'duel', 0x8001: 'solo_combat',
         0xB200: 'sound', 0xC018: 'wall_ahead', 0xC01E: 'step_forward',
         0x6803: 'next_picture_frame'}

# engine registers (read 0x208E6 / write 0x20722)
REGS = {0xC04B: 'party_x', 0xC04C: 'party_y', 0xC04D: 'facing', 0xC04E: 'wall_ahead',
        0xC04F: 'square_event', 0xC059: 'disp_59', 0xC05F: 'disp_5F', 0xD022: 'reg_D022',
        0xC030: 'C030', 0xC04A: 'C04A',
        0x00B1: 'eng_B1', 0x00FB: 'eng_FB', 0x00FC: 'eng_FC', 0x033D: 'facing_x2',
        0x035F: 'undef_35F', 0x03DE: 'snd_3DE', 0x00B8: 'eng_B8', 0x00B9: 'eng_B9'}


def space(a):
    """Address classifier, mirror of 0x200F3."""
    if 0x4B00 <= a <= 0x4EFF: return 'A'
    if 0x7C00 <= a <= 0x7FFF: return 'B'
    if 0x7A00 <= a <= 0x7BFF: return 'C'
    if 0x8000 <= a <= 0x9DFF: return 'code'
    return 'reg'


# --- DAX container (same format as PoR; copied from tools/dax.py) ---------
def read_dax(path):
    b = open(path, 'rb').read()
    hlen = struct.unpack_from('<H', b, 0)[0]
    ents = []
    for i in range(0, hlen, 9):
        rid, off, raw, comp = struct.unpack_from('<BIHH', b, 2 + i)
        ents.append((rid, off, raw, comp))
    return b, 2 + hlen, ents


def unrle(src, rawlen):
    out = bytearray(); i = 0
    while i < len(src) and len(out) < rawlen:
        n = src[i]; i += 1
        if n < 0x80:
            out += src[i:i + n + 1]; i += n + 1
        else:
            out += bytes([src[i]]) * (256 - n); i += 1
    return bytes(out)


def unpack_text(data):
    """6-bit packed text (0x20C49): 4 codes per 3 bytes, MSB first; code 0
    skipped; code <= 0x1F -> +0x40 (0x200CB)."""
    out = []; bits = 0; n = 0
    for b in data:
        bits = (bits << 8) | b; n += 8
        while n >= 6:
            n -= 6; c = (bits >> n) & 0x3F
            if c: out.append(chr(c + 0x40 if c < 0x20 else c))
    return ''.join(out)


class Operand:
    def __init__(self, kind, lo, hi=0, text=None, raw=b''):
        self.kind, self.lo, self.hi, self.text, self.raw = kind, lo, hi, text, raw

    @property
    def word(self):
        return self.hi << 8 | self.lo

    def value(self):
        if self.kind == 0: return self.lo
        if self.kind in (2, 0x81): return self.word
        return None

    def addr_name(self):
        a = self.word
        if a in REGS: return REGS[a]
        return None

    def __str__(self):
        k = self.kind
        if k == 0: return '#%d' % self.lo
        if k == 2: return '#0x%04X' % self.word
        if k in (1, 3):
            n = self.addr_name()
            return '[0x%04X%s]' % (self.word, ':' + n if n else '')
        if k == 0x80: return '"%s"' % self.text
        if k == 0x81: return 'str[0x%04X]' % self.word
        return '?%02X(%02X)' % (k, self.lo)


class Script:
    def __init__(self, code):
        self.code = code

    def byte(self, a):
        i = a - BASE
        if not 0 <= i < len(self.code):
            raise ValueError('read outside code at %04X' % a)
        return self.code[i]

    def read_operands(self, pc, count):
        """Mirror of 0x1FA02. pc points at the opcode (or one before the
        first operand). Returns (operands, new_pc)."""
        ops = []
        for _ in range(count):
            kind = self.byte(pc + 1); lo = self.byte(pc + 2); pc += 2
            if kind in (1, 2, 3, 0x81):
                pc += 1; ops.append(Operand(kind, lo, self.byte(pc)))
            elif kind == 0x80:
                raw = self.code[pc + 1 - BASE: pc + 1 - BASE + lo]
                if len(raw) != lo: raise ValueError('text past end at %04X' % pc)
                ops.append(Operand(kind, lo, text=unpack_text(raw), raw=raw))
                pc += lo
            else:
                ops.append(Operand(kind, lo))
        return ops, pc + 1

    def decode(self, pc):
        op = self.byte(pc)
        if op not in OPS:
            raise ValueError('bad opcode %02X at %04X' % (op, pc))
        name, n, var = OPS[op]
        ops, npc = self.read_operands(pc, n)
        if var is not None:
            cnt = ops[var].value()
            if cnt is None:
                raise ValueError('non-constant count at %04X' % pc)
            more, npc = self.read_operands(npc - 1, cnt)
            ops += more
        for o in ops:
            if o.kind not in (0, 1, 2, 3, 0x80, 0x81):
                raise ValueError('odd operand kind %02X at %04X' % (o.kind, pc))
        return op, name, ops, npc

    def vectors(self):
        out = []
        for i in range(5):
            op, _, ops, _ = self.decode(BASE + 4 * i)
            assert op == 0x01, 'vector %d is not GOTO' % i
            out.append(ops[0].word)
        return out

    def walk(self):
        """Reachability from the five vectors: {addr: (op, name, ops, next, prev_op)}."""
        seen = {}; todo = list(self.vectors())
        while todo:
            pc = todo.pop(); prev = None
            while BASE <= pc < BASE + len(self.code) and pc not in seen:
                op, name, ops, npc = self.decode(pc)
                seen[pc] = (op, name, ops, npc, prev)
                if op in (0x01, 0x02): todo.append(ops[0].word)
                if op in (0x25, 0x26): todo += [o.word for o in ops[2:]]
                # an IF makes the next instruction conditional, so a terminal
                # instruction straight after an IF still falls through
                if op in TERMINAL and not (prev is not None and 0x16 <= prev <= 0x1B):
                    break
                prev = op; pc = npc
        return seen


def load(path, rid=None):
    b, base, ents = read_dax(path)
    out = {}
    for r, off, raw, comp in ents:
        if rid is None or r == rid:
            d = unrle(b[base + off: base + off + comp], raw)
            if d[:2] != b'\x88\x13':
                raise ValueError('record %d: header %s' % (r, d[:2].hex()))
            if len(d) - 2 > SIZE:
                raise ValueError('record %d too big' % r)
            out[r] = Script(d[2:])
    return out


def listing(s):
    lines = []
    for i, v in enumerate(s.vectors()):
        lines.append('; vector %d %-15s -> %04X' % (i, VECTORS[i], v))
    ins = s.walk()
    for a in sorted(ins):
        op, name, ops, npc, prev = ins[a]
        txt = ', '.join(map(str, ops))
        if op == 0x2D and ops and ops[0].kind in (1, 2, 3):
            txt += '   ; %s' % CALLS.get(ops[0].word, '?')
        lines.append('%04X  %-15s %s' % (a, name, txt))
    return lines


def stats(paths):
    tot = Counter(); opc = Counter(); kinds = Counter(); calls = Counter()
    regs = Counter(); spaces = Counter(); skipmis = []; errs = []
    for p in paths:
        try:
            recs = load(p)
        except Exception as e:
            errs.append('%s: %s' % (p, e)); continue
        for r, s in sorted(recs.items()):
            tot['records'] += 1; tot['bytes'] += len(s.code)
            try:
                ins = s.walk()
            except Exception as e:
                errs.append('%s #%d: %s' % (os.path.basename(p), r, e)); continue
            cov = sum(v[3] - a for a, v in ins.items())
            # linear sweep of unreached gaps
            covered = bytearray(len(s.code))
            for a, v in ins.items():
                for x in range(a, v[3]): covered[x - BASE] = 1
            i = 0
            while i < len(s.code):
                if covered[i]: i += 1; continue
                j = i
                while j < len(s.code) and not covered[j]: j += 1
                tot['gaps'] += 1; tot['gapbytes'] += j - i
                pc = BASE + i; ok = True
                while pc < BASE + j:
                    try: pc = s.decode(pc)[3]
                    except Exception: ok = False; break
                if ok and pc == BASE + j: tot['gaps_clean'] += 1
                elif all(b == 0 for b in s.code[i:j]): tot['gaps_zero'] += 1
                i = j
            tot['instructions'] += len(ins); tot['covered'] += cov
            for a, (op, name, ops, npc, prev) in ins.items():
                opc[name] += 1
                if prev is not None and 0x16 <= prev <= 0x1B:
                    want = SKIP.get(op, 0)
                    if want != OPS[op][1] or OPS[op][2] is not None:
                        skipmis.append('%s #%d %04X %s after IF' % (os.path.basename(p), r, a, name))
                for o in ops:
                    kinds[o.kind] += 1
                    if o.kind in (1, 3) and op != 0x2D:
                        sp = space(o.word); spaces[sp] += 1
                        if sp == 'reg': regs['0x%04X' % o.word] += 1
                if op == 0x2D:
                    calls['%s 0x%04X' % ('kind%d' % ops[0].kind, ops[0].word)] += 1
    return tot, opc, kinds, calls, regs, spaces, skipmis, errs


if __name__ == '__main__':
    if sys.argv[1] == '--stats':
        tot, opc, kinds, calls, regs, spaces, skipmis, errs = stats(sys.argv[2:])
        print('records %(records)d  code bytes %(bytes)d  instructions %(instructions)d  '
              'reachable bytes %(covered)d' % tot,
              '(%.1f%%)' % (100.0 * tot['covered'] / max(1, tot['bytes'])))
        print('unreached gaps %(gaps)d (%(gapbytes)d bytes): decode cleanly %(gaps_clean)d, all-zero %(gaps_zero)d' % tot)
        print('decode errors:', len(errs)); [print('  ', e) for e in errs]
        print('opcodes:', ', '.join('%s %d' % kv for kv in sorted(opc.items(), key=lambda x: -x[1])))
        unused = sorted(set(n for n, _, _ in OPS.values()) - set(opc))
        print('unused opcodes:', ', '.join(unused))
        print('operand kinds:', ', '.join('%02X:%d' % kv for kv in sorted(kinds.items())))
        print('address operands by space:', dict(spaces))
        print('engine registers:', dict(sorted(regs.items())))
        print('CALL targets:', dict(calls))
        print('IF followed by skip-table mismatch:', len(skipmis)); [print('  ', x) for x in skipmis]
    else:
        path = sys.argv[1]; rid = int(sys.argv[2]) if len(sys.argv) > 2 else None
        for r, s in load(path, rid).items():
            print('; ==== %s record %d (%d bytes)' % (os.path.basename(path), r, len(s.code)))
            print('\n'.join(listing(s)))
