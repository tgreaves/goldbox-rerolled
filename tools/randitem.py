"""Reference for random treasure items: ECL TREASURE 0x80-0xFE (handler 29c3:19B0) and FUN_4c2d_1010.

Builds the 63-byte item records exactly as the original does, from an explicit sequence
of dice results, so a port can be checked byte for byte. Spec: spec/A-games/engine/records.md, "Random items".

Tables come from the shipped data: name words DS:10A7 + 21*w, random item array DS:0972,
spell names DS:2912 (START.EXE unpacked by unexepack.py; DS = paragraph 0x0C7C of the load
image) and the ITEMS file (only used for the examples' slot / AC-descriptor notes;
the generator itself never reads ITEMS).

Usage: python3 randitem.py <START_UNPACKED.EXE> <ITEMS>
"""
import sys, struct, random

DS_PARA = 0x0C7C


class Tables:
    def __init__(self, exe, items_path=None):
        b = open(exe, 'rb').read()
        img = b[struct.unpack_from('<H', b, 8)[0] * 16:]
        ds = DS_PARA * 16
        self.words = []
        for w in range(256):
            p = ds + 0x10A7 + 21 * w
            self.words.append(img[p + 1:p + 1 + img[p]].decode('latin1') if w else '')
        # 19 entries x 8 u16: n1 (0x2F), n2 (0x30), n3 (0x31), weight, value, p1, p2, p3.
        # Indexed by "magic" m = 1 + 8*e as u16 array DS:0970[m + j]; keep the raw words
        # so the misaligned javelin index 0x90 reads what the original reads.
        self.ds_words = struct.unpack_from('<%dH' % 0x140, img, ds + 0x0970)
        self.spells = []
        p = ds + 0x2912
        for _ in range(56):
            self.spells.append(img[p + 1:p + 1 + img[p]].decode('latin1')); p += 41
        self.items = None
        if items_path:
            ib = open(items_path, 'rb').read()
            self.items = [ib[2 + 16 * t:18 + 16 * t] for t in range(128)]

    def arr(self, k):           # DS:0970 + 2k, as the code indexes it
        return self.ds_words[k]


class Dice:
    """roll(sides) -> 1..sides. Takes a list of results (checked) or draws from an RNG."""
    def __init__(self, results=None, rng=None):
        self.results = list(results) if results is not None else None
        self.rng = rng or random.Random()
        self.log = []

    def __call__(self, sides):
        if self.results is not None:
            if not self.results:
                raise ValueError('dice sequence exhausted (needed a d%d)' % sides)
            r = self.results.pop(0)
            if not 1 <= r <= sides:
                raise ValueError('d%d result %d out of range' % (sides, r))
        else:
            r = self.rng.randint(1, sides)
        self.log.append((sides, r))
        return r


def plus_roll(d):                     # FUN_4c2d_0fd2
    r = d(20)
    return 1 if r <= 14 else 2 if r <= 19 else 3


WEIGHT = {}
for wt, types in ((75, (1, 13, 14, 35)), (50, (2, 20, 29, 31, 32, 33, 39, 42, 44, 46, 59)),
                  (125, (3, 24, 40)), (100, (4, 15, 23, 34, 43, 45, 51)),
                  (150, (5, 12, 17, 19, 50)), (15, (6,)), (30, (7,)), (10, (8, 0x4D)),
                  (25, (9,)), (60, (10, 26, 36)), (80, (11, 16, 25, 27, 41, 47)),
                  (175, (18,)), (20, (21,)), (40, (22, 30)), (35, (37,)), (250, (38, 53)),
                  (200, (52,)), (400, (54, 56)), (300, (55,)), (350, (57,)), (450, (58,)),
                  (1, (0x5D,))):
    for t in types:
        WEIGHT.setdefault(t, wt)       # first match wins, as in the if-chain (0x2F -> 80)
VALUE_PER_PLUS = {0x3B: 2500, 0x49: 150, 0x1C: 150, 0x35: 3000, 0x36: 3000, 0x37: 3500,
                  0x38: 3500, 0x39: 4000, 0x3A: 5000, 0x4D: 3000}       # else 2000


def make_item(tab, itype, d):
    """FUN_4c2d_1010(type, item): returns a 63-byte bytearray (name cache left empty)."""
    it = bytearray(63)
    it[0x35] = 6                     # hide n1 and n2
    it[0x2E] = itype & 0xFF
    magic = 0
    t = it[0x2E]
    if 1 <= t <= 0x3B or t in (0x49, 0x4D, 0x5D):
        p = plus_roll(d)
        it[0x32] = p
        pw = (p + 0xA1) & 0xFF       # words 0xA2..0xA4 = "+1".."+3"
        if t == 0x15:
            if d(5) == 5:
                magic = 0x90         # typo: Javelin of Lightning is 0x69 (105)
            it[0x31], it[0x30] = 0x15, pw
        elif t in (0x32, 0x33):
            it[0x31], it[0x30], it[0x2F], it[0x35] = t, 0x31, pw, 4
        elif t == 0x34:
            it[0x31], it[0x30], it[0x2F], it[0x35] = t, 0x32, pw, 4
        elif 0x35 <= t <= 0x3A:
            it[0x31], it[0x30], it[0x2F], it[0x35] = t, 0x30, pw, 4
        elif t == 0x49:
            it[0x31], it[0x30] = 0x3D, pw
        elif t == 0x4D:
            it[0x31], it[0x30] = 0x4F, 0xA7
            it[0x32] = (2 * p + 2) & 0xFF
            it[0x2F] = {4: 0xDD, 6: 0xDE, 8: 0xDC}[it[0x32]]
        elif t == 0x5D:
            it[0x31], it[0x30], it[0x2F] = 0x42, 0xE0, pw
        else:                        # 0x1C and every other weapon/armour/shield
            it[0x31], it[0x30] = t, pw
        it[0x33] = 0
        it[0x39] = 0
        if t in WEIGHT:
            w = WEIGHT[t]
        elif t == 9:
            w = 25
        else:
            w = 40                   # 0x1C quarrels, 0x49 arrows (and unreachable 0x30/0x31)
        struct.pack_into('<H', it, 0x37, w)
        if t == 9:
            it[0x39] = 5
        elif t not in WEIGHT:
            it[0x39] = 10
        v = (struct.unpack('b', bytes([it[0x32]]))[0] * VALUE_PER_PLUS.get(t, 2000)) & 0xFFFF
        struct.pack_into('<H', it, 0x3A, v)
    elif t in (0x3D, 0x3E):          # magic-user / clerical scroll
        n = d(3)
        it[0x31] = 0xD1 if t == 0x3D else 0xD0
        it[0x30] = 0xD1 + n
        it[0x2F] = 0
        it[0x32] = 1
        struct.pack_into('<H', it, 0x37, 25)
        it[0x39] = 0
        v = 0
        for i in range(1, n + 1):
            lvl = d(3)
            if t == 0x3D:
                s = {1: lambda: d(13) + 8, 2: lambda: d(7) + 0x1C, 3: lambda: d(11) + 0x2C}[lvl]()
            else:
                s = {1: lambda: d(8), 2: lambda: d(7) + 0x15, 3: lambda: d(9) + 0x23}[lvl]()
            it[0x3B + i] = s
            v = (v + 300 * lvl) & 0xFFFF
        struct.pack_into('<H', it, 0x3A, v)
    elif t == 0x3F:
        magic = 0x49                 # Gauntlets of Ogre Power (never requested)
    elif t == 0x43:
        magic = 0x91                 # Cloak of Elvenkind
    elif t == 0x45:
        r = d(10)
        magic = 0x29 if r == 1 else 0x79 if r <= 6 else 0x81
    elif t == 0x4E:
        r = d(3) + 1
        magic = {2: 0x41, 3: 0x71}.get(r, 0)     # 1 (Lightning, 0x31) cannot occur; 4 -> blank
    elif t == 0x4F:
        magic = 0x39
    elif t == 0x54:
        magic = 0x09
    elif t == 0x5C:
        magic = 0x61
    elif t == 0x47:
        r = d(11)
        magic = 0x11 if r <= 5 else 0x01 if r <= 8 else 0x19 if r == 9 else 0x51 if r == 10 else 0
    elif t == 0x46:
        r = d(10)
        magic = 0x59 if r <= 7 else 0x89
    if magic:
        for j in range(3):
            it[0x2F + j] = tab.arr(magic + j) & 0xFF
        it[0x32] = 1
        it[0x33] = 1
        if magic == 0x61:
            it[0x32] = 2
            it[0x33] = 2
        struct.pack_into('<H', it, 0x37, tab.arr(magic + 3))
        it[0x39] = 0
        struct.pack_into('<H', it, 0x3A, tab.arr(magic + 4))
        for j in range(1, 4):
            it[0x3B + j] = tab.arr(magic + 4 + j) & 0xFF
    return it


def choose_type(d, prev):
    """Type choice inside the TREASURE handler; prev = the handler's uninitialised local."""
    r1 = d(100)
    if r1 <= 60:
        r2 = d(100)
        if r2 <= 47 or 50 <= r2 <= 59:
            return 0x3B if r2 == 45 else r2
        if 60 <= r2 <= 90:
            s = d(10)
            return 0x24 if s <= 4 else 0x23 if s <= 7 else {8: 0x22, 9: 0x25, 10: 0x26}[s]
        if 91 <= r2 <= 94:
            return 0x49
        if 95 <= r2 <= 97:
            return 0x5D
        if r2 >= 98:
            return 0x4D
        return prev                  # 48, 49: type left unchanged
    if r1 <= 85:
        return 0x3D
    if r1 <= 92:
        return 0x3E
    if r1 <= 98:
        m = d(16)
        return (0x47 if m <= 7 else 0x46 if m <= 9 else
                {10: 0x54, 11: 0x4E, 12: 0x4E, 13: 0x4F, 14: 0x4F, 15: 0x5C, 16: 0x43}[m])
    return 0x45


def display_name(tab, it, detect_magic=False):
    """FUN_10ba_0442 with inInventory = 0 (as TREASURE calls it)."""
    s = ''
    if detect_magic and (it[0x32] in range(1, 128) or it[0x33] in range(1, 128) or it[0x36]):
        s += '* '
    cnt, t = it[0x39], it[0x2E]
    if cnt > 0:
        s += '%d ' % cnt
    mask = 0
    for n in (1, 2, 3):
        if it[0x2E + n] and not (it[0x35] >> (3 - n)) & 1:
            mask |= 1 << (n - 1)
    plural = False
    for n in (3, 2, 1):
        if not mask & (1 << (n - 1)):
            continue
        s += tab.words[it[0x2E + n]]
        here = ((1 << (n - 1)) == mask or (n == 1 and mask > 4 and t != 0x56)
                or (n == 2 and not mask & 1) or (n == 3 and t == 0x56)
                or (t in (0x49, 0x1C) and it[0x31] != 0xB1))
        if cnt < 2 or plural:
            s += ' '
        elif here:
            s += 's '; plural = True
        else:
            s += ' '
    return s


def treasure(tab, count, dice, prev_type=0, names=True):
    """TREASURE with item operand 0x80 + count. Returns (items in list order, last type).

    Items are prepended to the treasure list, so the list shows them newest first."""
    out, t = [], prev_type
    for _ in range(count):
        t = choose_type(dice, t)
        out.insert(0, make_item(tab, t, dice))
    if names:
        for it in out:
            nm = display_name(tab, it).encode('latin1')[:40]
            it[0] = len(nm); it[1:1 + len(nm)] = nm
    return out, t


def describe(tab, it):
    t = it[0x2E]
    ident = bytearray(it); ident[0x35] = 0
    w, v = struct.unpack_from('<H', it, 0x37)[0], struct.unpack_from('<H', it, 0x3A)[0]
    s = ('type 0x%02X  "%s" / identified "%s"\n    words %02X %02X %02X  plus %d  save %d  mask %d  '
         'weight %d  count %d  value %d  props %02X %02X %02X' % (
             t, display_name(tab, it).strip(), display_name(tab, ident).strip(),
             it[0x2F], it[0x30], it[0x31], struct.unpack('b', it[0x32:0x33])[0],
             struct.unpack('b', it[0x33:0x34])[0], it[0x35], w, it[0x39], v,
             it[0x3C], it[0x3D], it[0x3E]))
    if t in (0x3D, 0x3E):
        s += '\n    spells: ' + ', '.join(tab.spells[x - 1] for x in it[0x3C:0x3F] if x)
    if tab.items:
        e = tab.items[t]
        s += '\n    ITEMS[0x%02X]: slot %d, AC descriptor 0x%02X%s' % (
            t, e[0], e[6], ' (save bonus applies)' if e[6] == 0x80 else '')
    return s


if __name__ == '__main__':
    tab = Tables(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else None)
    examples = [
        ('Long Sword +2: d100 10, d100 60, d10 1, d20 15', [10, 60, 1, 15]),
        ('Bracers AC 2: d100 5, d100 99, d20 20', [5, 99, 20]),
        ('Chain Mail +1: d100 30, d100 55, d20 3', [30, 55, 3]),
        ('10 Arrows +3: d100 60, d100 91, d20 20', [60, 91, 20]),
        ('MU scroll, 3 spells: d100 70, d3 3, (d3 1, d13 7), (d3 3, d11 3), (d3 2, d7 6)',
         [70, 3, 1, 7, 3, 3, 2, 6]),
        ('Clerical scroll, 1 spell: d100 90, d3 1, d3 2, d7 2', [90, 1, 2, 2]),
        ('Potion of Extra Healing: d100 93, d16 1, d11 6', [93, 1, 6]),
        ('Cloak of Displacement: d100 98, d16 15', [98, 15]),
        ('Wand bug, d3+1 = 4: d100 95, d16 11, d3 3', [95, 11, 3]),
        ('Javelin bug, d5 = 5: d100 1, d100 21, d20 1, d5 5', [1, 21, 1, 5]),
    ]
    for title, rolls in examples:
        d = Dice(rolls)
        items, _ = treasure(tab, 1, d)
        assert not d.results, 'unused dice'
        print(title)
        print('   ', describe(tab, items[0]).replace('\n', '\n    '))
        print('    bytes 2E-3E:', items[0][0x2E:0x3F].hex(' '))
    print('Repeat bug (TREASURE 0x82): item 1 d100 50, d100 20, d20 16 (Hammer +2); '
          'item 2 d100 1, d100 48 -> type repeats, d20 20')
    items, _ = treasure(tab, 2, Dice([50, 20, 16, 1, 48, 20]))
    for it in items:
        print('   ', describe(tab, it).split('\n')[0])
    print('Five random items (seed 1988), list order:')
    for it in treasure(tab, 5, Dice(rng=random.Random(1988)))[0]:
        print('   ', describe(tab, it).split('\n')[0])
