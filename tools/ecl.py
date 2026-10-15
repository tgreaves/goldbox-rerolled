"""ECL bytecode disassembler for the Pool of Radiance (DOS) engine.

Encoding and operand counts come from the engine's operand reader (2fea:0000),
skip routine (2fea:1ea6) and per-opcode handlers (segment 29c3). See
../spec/ecl.md for the semantics.

Usage: python3 ecl.py <ECLn.DAX> [record_id]
"""
import sys, os, struct
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dax import read_dax, unrle

BASE = 0x9900          # virtual address of record byte 2
VECTORS = ['on_move', 'on_step', 'camp_menu', 'camp_confirmed', 'on_enter']

# opcode -> (mnemonic, fixed operand count, index of count operand for variadic or None)
OPS = {
    0x00: ('EXIT', 0, None),        0x01: ('GOTO', 1, None),
    0x02: ('GOSUB', 1, None),       0x03: ('COMPARE', 2, None),
    0x04: ('ADD', 3, None),         0x05: ('SUBTRACT', 3, None),
    0x06: ('DIVIDE', 3, None),      0x07: ('MULTIPLY', 3, None),
    0x08: ('RANDOM', 2, None),       0x09: ('SAVE', 2, None),
    0x0A: ('LOAD_CHARACTER', 1, None),       0x0B: ('LOAD_MONSTER', 3, None),
    0x0C: ('SETUP_MONSTER', 3, None),       0x0D: ('APPROACH', 0, None),
    0x0E: ('PICTURE', 1, None),       0x0F: ('INPUT_NUMBER', 2, None),
    0x10: ('INPUT_STRING', 2, None),       0x11: ('PRINT', 1, None),
    0x12: ('PRINT_CLEAR', 1, None),       0x13: ('RETURN', 0, None),
    0x14: ('COMPARE_AND', 4, None),       0x15: ('VMENU', 3, 2),
    0x16: ('IF_EQ', 0, None),       0x17: ('IF_NE', 0, None),
    0x18: ('IF_LT', 0, None),       0x19: ('IF_GT', 0, None),
    0x1A: ('IF_LE', 0, None),       0x1B: ('IF_GE', 0, None),
    0x1C: ('CLEAR_MONSTERS', 0, None), 0x1D: ('PARTY_STRENGTH', 1, None),
    0x1E: ('CHECK_PARTY', 6, None),
    0x20: ('NEW_ECL', 1, None),     0x21: ('LOAD_AREA', 3, None),
    0x22: ('PARTY_HAS_2F', 2, None),       0x23: ('SURPRISE', 4, None),
    0x24: ('COMBAT', 0, None),       0x25: ('ON_GOTO', 2, 1),
    0x26: ('ON_GOSUB', 2, 1),       0x27: ('TREASURE', 8, None),
    0x28: ('ROB', 3, None),       0x29: ('ENCOUNTER_MENU', 14, None),
    0x2A: ('GET_TABLE', 3, None),       0x2B: ('HMENU', 2, 1),
    0x2C: ('PARLAY', 6, None),       0x2D: ('CALL', 1, None),
    0x2E: ('DAMAGE', 5, None),       0x2F: ('AND', 3, None),
    0x30: ('OR', 3, None),          0x31: ('OP_31', 0, None),
    0x32: ('FIND_ITEM', 1, None),       0x33: ('NEWLINE', 0, None),
    0x34: ('OP_34', 1, None),       0x35: ('SAVE_TABLE', 3, None),
    0x36: ('ADD_NPC', 2, None),       0x37: ('LOAD_WALLSETS', 3, None),
    0x38: ('PROGRAM', 1, None),       0x39: ('WHO', 1, None),
    0x3A: ('CLEAR_BOX', 0, None),   0x3B: ('FIND_IN_CHAR_LIST', 3, None),
    0x3C: ('OP_3C', 1, None),       0x3D: ('OP_3D', 0, None),
}
TERMINAL = {0x00, 0x01, 0x13, 0x20}
BRANCH_TARGETS = {0x01: [0], 0x02: [0]}


def unpack_text(data):
    """6-bit packed text, 4 chars per 3 bytes; codes < 0x20 map to +0x40."""
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
        """Value when the operand is a compile-time constant, else None."""
        if self.kind == 0: return self.lo
        if self.kind == 2: return self.word
        return None

    def __str__(self):
        k = self.kind
        if k == 0: return '#%d' % self.lo
        if k == 2: return '#0x%04X' % self.word
        if k in (1, 3): return '[0x%04X]' % self.word
        if k == 0x80: return '"%s"' % self.text
        if k == 0x81: return 'str[0x%04X]' % self.word
        return '?%02X(%02X)' % (k, self.lo)


class Script:
    def __init__(self, code):
        self.code = code  # bytes at virtual BASE

    def byte(self, a):
        return self.code[a - BASE]

    def read_operands(self, pc, count):
        """Mirror of 2fea:0000. pc points at the opcode. Returns (operands, new_pc)."""
        ops = []
        for _ in range(count):
            kind = self.byte(pc + 1); lo = self.byte(pc + 2); pc += 2
            if kind in (1, 2, 3):
                pc += 1; ops.append(Operand(kind, lo, self.byte(pc)))
            elif kind == 0x80:
                raw = self.code[pc + 1 - BASE: pc + 1 - BASE + lo]
                ops.append(Operand(kind, lo, text=unpack_text(raw), raw=raw))
                pc += lo
            elif kind == 0x81:
                pc += 1; ops.append(Operand(kind, lo, self.byte(pc)))
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
        return op, name, ops, npc

    def vectors(self):
        out = []
        for i in range(5):
            op, _, ops, _ = self.decode(BASE + 4 * i)
            assert op == 0x01
            out.append(ops[0].word)
        return out

    def walk(self):
        """Reachability from the five vectors. Returns {addr: (op,name,ops,next)}."""
        seen = {}; todo = list(self.vectors())
        while todo:
            pc = todo.pop(); prev = None
            while BASE <= pc < BASE + len(self.code) and pc not in seen:
                ins = self.decode(pc); seen[pc] = ins
                op, name, ops, npc = ins
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
            d, _ = unrle(b[base + off: base + off + comp], raw, 0)
            out[r] = Script(d[2:])
    return out


def listing(s):
    lines = []
    for i, v in enumerate(s.vectors()):
        lines.append('; vector %d %-15s -> %04X' % (i, VECTORS[i], v))
    ins = s.walk()
    for a in sorted(ins):
        op, name, ops, npc = ins[a]
        lines.append('%04X  %-14s %s' % (a, name, ', '.join(map(str, ops))))
    return lines


if __name__ == '__main__':
    path = sys.argv[1]; rid = int(sys.argv[2]) if len(sys.argv) > 2 else None
    for r, s in load(path, rid).items():
        print('; ==== %s record %d (%d bytes)' % (os.path.basename(path), r, len(s.code)))
        print('\n'.join(listing(s)))
