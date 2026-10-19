#!/usr/bin/env python3
"""Dump the rules tables of Curse of the Azure Bonds (GOG 1.0, unpacked load image) and, where
the Pool of Radiance port has an equivalent table, PoR's values beside them.

Usage: tables_coab.py [coab img.bin] [por img.bin]
Addresses are DS offsets; DS is found from the Turbo Pascal startup code (see find_ds).
"""
import struct, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
SCR = os.path.normpath(os.path.join(HERE, '..', '..'))
C = open(sys.argv[1] if len(sys.argv) > 1 else os.path.join(SCR, 'coab', 'img.bin'), 'rb').read()
P_PATH = sys.argv[2] if len(sys.argv) > 2 else os.path.join(SCR, 'img.bin')
P = open(P_PATH, 'rb').read() if os.path.exists(P_PATH) else None
PDS = 0xC7C0  # PoR: DS paragraph 0x0C7C


def find_ds(img):
    """CotAB is Turbo Pascal: the entry point's first far call goes to the System unit's init,
    which starts `mov dx, DATA; mov ds, dx` (BA lo hi 8E DA)."""
    e = struct.unpack_from('<H', img, 0x2F + 3)[0] * 16 + struct.unpack_from('<H', img, 0x2F + 1)[0]
    assert img[0x2F] == 0x9A and img[e] == 0xBA and img[e + 3:e + 5] == b'\x8e\xda', 'unexpected startup'
    return struct.unpack_from('<H', img, e + 1)[0] * 16


CDS = find_ds(C)
b = lambda o: C[CDS + o]
s8 = lambda o: (C[CDS + o] ^ 0x80) - 0x80
w = lambda o: struct.unpack_from('<H', C, CDS + o)[0]
d = lambda o: struct.unpack_from('<I', C, CDS + o)[0]
pb = lambda o: P[PDS + o]
ps8 = lambda o: (P[PDS + o] ^ 0x80) - 0x80
pw = lambda o: struct.unpack_from('<H', P, PDS + o)[0]
pd = lambda o: struct.unpack_from('<I', P, PDS + o)[0]
pstr = lambda img, ds, o: img[ds + o + 1:ds + o + 1 + img[ds + o]].decode('latin1')
cstr = lambda o: pstr(C, CDS, o)

CLASSES = [cstr(0x0CB8 + 27 * k) for k in range(17)]
BASE = CLASSES[:8]
RACES = [cstr(0x0E9E + 10 * r) for r in range(8)]
ALIGN = [cstr(0x0EEE + 17 * a) for a in range(9)]
SAVES = ['death/poison', 'petrify/poly', 'rod/staff/wand', 'breath', 'spell']
SKILLS = ['PP', 'OL', 'F/RT', 'MS', 'HS', 'HN', 'CW', 'RL']


def h(t):
    print('\n## ' + t)


def row(label, vals, fmt='{:>4}'):
    print('{:<22}'.format(label) + ' '.join(fmt.format(v) for v in vals))


print('CotAB DS = image 0x%X (paragraph 0x%04X); PoR DS = image 0x%X' % (CDS, CDS >> 4, PDS))

h('Names (DS:0CB8 classes x27, DS:0E9E races x10, DS:0EEE alignments x17)')
print('classes:', CLASSES)
print('races:', RACES)
print('alignments:', ALIGN)

h('Class bits DS:3EA2[k] (PoR DS:05D6), trainer/item mask DS:3EAA[k] (PoR DS:05DE)')
row('', BASE, '{:>11}')
row('class bits', [hex(b(0x3EA2 + k)) for k in range(8)], '{:>11}')
row('trainer bits', [hex(b(0x3EAA + k)) for k in range(8)], '{:>11}')
if P:
    row('PoR class bits', [hex(pb(0x05D6 + k)) for k in range(8)], '{:>11}')
    row('PoR trainer bits', [hex(pb(0x05DE + k)) for k in range(8)], '{:>11}')

h('Hit dice DS:081A count / DS:0822 sides (PoR DS:08B6/08BE); dice stop at level DS:3EBB[k] (new)')
row('', BASE, '{:>11}')
row('dice', ['%dd%d' % (b(0x081A + k), b(0x0822 + k)) for k in range(8)], '{:>11}')
row('dice below level', [b(0x3EBB + k) for k in range(8)], '{:>11}')
row('fixed HP from then', [3 if k in (2, 3) else 2 if k in (0, 4, 6) else 1 if k == 5 else '-' for k in range(8)], '{:>11}')
if P:
    row('PoR dice', ['%dd%d' % (pb(0x08B6 + k), pb(0x08BE + k)) for k in range(8)], '{:>11}')
print('(fixed HP per level after the cap is code at 3b2ed, not a table; the count byte is used only at level 1)')

h('CON hit-point bonus DS:4281[CON] (PoR DS:408E[CON])')
row('CON', list(range(3, 26)))
row('bonus', [s8(0x4281 + c) for c in range(3, 26)])
if P:
    row('PoR bonus', [ps8(0x408E + c) for c in range(3, 19)])

h('Experience DS:4293 + k*0x63 + L*4 (u32; PoR DS:409B + k*0x38 + L*4)')


def xp(k, L):
    return d(0x4293 + k * 0x63 + L * 4)


def cap(k, f=xp, top=12):
    m = 1
    for L in range(2, top + 1):
        v = f(k, L)
        if v in (0, 0xFFFFFFFF):
            break
        m = L
    return m


row('level', list(range(2, 13)), '{:>9}')
for k in range(8):
    v = [xp(k, L) for L in range(2, 13)]
    row('%s (cap %d)' % (BASE[k], cap(k)), ['-' if x in (0, 0xFFFFFFFF) else x for x in v], '{:>9}')
if P:
    for k in range(8):
        f = lambda kk, L: pd(0x409B + kk * 0x38 + L * 4)
        print('  PoR %-10s cap %d' % (BASE[k], cap(k, f, 13)))

h('THAC0 DS:3E3A + k*13 + L, value = 60 - THAC0 (PoR DS:3C7C + k*11 + L)')
row('level', list(range(1, 13)))
for k in range(8):
    row(BASE[k], [60 - b(0x3E3A + k * 13 + L) for L in range(1, 13)])

h('Saving throws DS:45BE + k*0x3C + L*5 + i (PoR DS:426E + k*0x2D + L*5 + i)')
print('order:', SAVES, '; 12 rows of 5 per class for levels 1-12 (the unused L0 slot of class k+1 holds L12 of class k)')
for k in (0, 2, 3, 4, 5, 6):
    print(BASE[k])
    for L in range(1, 13):
        print('   L%-2d' % L, [b(0x45BE + k * 0x3C + L * 5 + i) for i in range(5)])

h('Spell slots: increments per level (DS:42BC cleric, DS:43E5 paladin, DS:4448 ranger, DS:44AB magic-user; + L*5 + n)')
print('slot arrays char+0x12D.. (cleric 1-5), +0x132.. (druid 1-5), +0x137.. (MU 1-5)')


def slots(k, L):
    cl, dr, mu = [0] * 5, [0] * 5, [0] * 5
    if k == 0:
        cl[0] = 1
        for l in range(2, L + 1):
            for n in range(5): cl[n] += b(0x42BC + l * 5 + n + 1)
    elif k == 3:
        for l in range(9, L + 1):
            for n in range(5): cl[n] += b(0x43E5 + l * 5 + n + 1)
    elif k == 4:
        for l in range(8, L + 1):
            for n in range(3): dr[n] += b(0x4448 + l * 5 + n + 1)
            for n in range(3, 5): mu[n - 3] += b(0x4448 + l * 5 + n + 1)
    elif k == 5:
        mu[0] = 1
        for l in range(2, L + 1):
            for n in range(5): mu[n] += b(0x44AB + l * 5 + n + 1)
    return cl, dr, mu


for k, nm in ((0, 'cleric'), (3, 'paladin'), (4, 'ranger'), (5, 'magic-user')):
    print(BASE[k], '(cap %d)' % cap(k))
    for L in range(1, cap(k) + 1):
        cl, dr, mu = slots(k, L)
        print('   L%-2d cleric %s druid %s MU %s' % (L, cl, dr, mu))
if P:
    print('PoR absolute slots (DS:40BC cleric, DS:41D4 MU; + L*3 + n):')
    for L in range(2, 7):
        print('   L%d cleric %s MU %s' % (L, [pb(0x40BC + L * 3 + n) for n in (1, 2, 3)], [pb(0x41D4 + L * 3 + n) for n in (1, 2, 3)]))

h('Starting gold dice DS:45B3 + k*2 (count, sides) (PoR DS:4263): CotAB rolls them but discards the sum; every new character gets 300 pp (code 389ea)')
row('', BASE, '{:>11}')
row('dice', ['%dd%d' % (b(0x45B3 + 2 * k), b(0x45B4 + 2 * k)) for k in range(8)], '{:>11}')
if P:
    row('PoR', ['%dd%d' % (pb(0x4263 + 2 * k), pb(0x4264 + 2 * k)) for k in range(8)], '{:>11}')

h('Thief skills: base DS:3EC0 + L*8 + s, race DS:3F20 + r*8 + s, DEX DS:3F33 + DEX*5 + s (s 1-8 / 1-5)')
print('(PoR: DS:3CF3, DS:3D3B, DS:3D4E, same strides)')
row('level', SKILLS)
for L in range(1, 13):
    row('L%d' % L, [b(0x3EC0 + L * 8 + s) for s in range(1, 9)])
for r in range(1, 8):
    row(RACES[r], [s8(0x3F20 + r * 8 + s) for s in range(1, 9)])
print('(DEX 3-8 rows alias the race rows; DEX 19+ aliases the race ability limits)')
for x in range(9, 19):
    row('DEX %d' % x, [s8(0x3F33 + x * 5 + s) for s in range(1, 6)])

h('Race ability limits DS:3F88 + r*16 (PoR DS:3DA3 + r*16)')
print('bytes: STR min M/F, STR max M/F, 18/xx max M/F, then (min,max) INT WIS DEX CON CHA (PoR order)')
for r in range(1, 8):
    v = [b(0x3F88 + r * 16 + i) for i in range(16)]
    pv = [pb(0x3DA3 + r * 16 + i) for i in range(16)] if P else None
    print('%-9s %s%s' % (RACES[r], v, '' if pv == v else '   PoR ' + str(pv)))

h('Classes per race DS:3FFA + r*14: count, ids (PoR DS:3E17 + r*12)')
for r in range(1, 8):
    n = b(0x3FFA + r * 14)
    ids = [b(0x3FFB + r * 14 + i) for i in range(n)]
    pids = [pb(0x3E18 + r * 12 + i) for i in range(pb(0x3E17 + r * 12))] if P else []
    print('%-9s %s%s' % (RACES[r], [CLASSES[i] for i in ids], '' if pids == ids else '\n          PoR ' + str([CLASSES[i] for i in pids])))

h('Starting age DS:404E + r*28 + c*4: base(w), count, sides (PoR DS:3E5B + r*0x1C + c*4)')
row('', BASE[:7], '{:>11}')
for r in range(1, 8):
    o = 0x404E + r * 28
    row(RACES[r], ['%d+%dd%d' % (w(o + c * 4), b(o + c * 4 + 2), b(o + c * 4 + 3)) for c in range(7)], '{:>11}')

h('Ageing thresholds DS:4124 + r*10 (5 words; PoR DS:3F31 + r*10)')
for r in range(1, 8):
    print('%-9s %s' % (RACES[r], [w(0x4124 + r * 10 + 2 * i) for i in range(5)]))

h('Class ability minimums DS:4174 + c*6 (STR INT WIS DEX CON CHA; PoR DS:3F81 + c*6)')
for c in range(17):
    v = [b(0x4174 + c * 6 + a) for a in range(6)]
    pv = [pb(0x3F81 + c * 6 + a) for a in range(6)] if P else v
    print('%-26s %s%s' % (CLASSES[c], v, '' if pv == v else '   PoR ' + str(pv)))

h('Alignments per class DS:41DA + c*10: count, ids (PoR DS:3FE7 + c*10)')
for c in range(17):
    n = b(0x41DA + c * 10)
    ids = [b(0x41DB + c * 10 + i) for i in range(n)]
    pids = [pb(0x3FE8 + c * 10 + i) for i in range(pb(0x3FE7 + c * 10))] if P else ids
    print('%-26s %s%s' % (CLASSES[c], ids, '' if pids == ids else '   PoR ' + str(pids)))

h('Spells: names DS:27BF + id*41 (= DS:27E8 for id 1), records DS:37DC + id*16, ids 1-100')
print('(PoR: names DS:28E9 + id*41 = DS:2912 for id 1, 56 named; records DS:31FA + id*16, ids 1-67)')
print('record class byte: CotAB 0 cleric, 1 druid, 2 magic-user, 3 item/monster only; PoR 0 cleric, 1 MU, 2 item')
for i in range(1, 101):
    r = C[CDS + 0x37DC + i * 16:CDS + 0x37DC + i * 16 + 16]
    print('%3d %-34s cls %d lvl %d  %s' % (i, repr(cstr(0x27BF + i * 41)), r[0], r[1], r.hex(' ')))

h('Coins in copper DS:0CA4 (5 x u32; PoR DS:0D24)')
print([d(0x0CA4 + 4 * i) for i in range(5)])

h('Temple services DS:00E6 x41 (PoR DS:011A); prices are code immediates')
print([cstr(0x00E6 + 41 * i) for i in range(11)])

h('Item name words DS:1042 + i*21 (= DS:1057 for word 1; PoR DS:10A7 / 10BC)')
words = [cstr(0x1042 + i * 21) for i in range(1, 256)]
print(len(words), 'words; changed vs PoR:')
if P:
    pwords = [pstr(P, PDS, 0x10A7 + i * 21) for i in range(1, 256)]
    print(['%d:%s->%s' % (i + 1, a, c) for i, (a, c) in enumerate(zip(pwords, words)) if a != c])

h('Random-item word table DS:082E + 2*i (u16; PoR DS:0970)')
cw = [w(0x082E + 2 * i) for i in range(0xA0)]
print('first 0xA0 words differ from PoR at:', [hex(i) for i in range(0xA0) if P and cw[i] != pw(0x0970 + 2 * i)] if P else '')

h('Small tables')
print('sky colours DS:0A8A[16] ', list(C[CDS + 0xA8A:CDS + 0xA9A]), ' PoR DS:0C26', list(P[PDS + 0xC26:PDS + 0xC36]) if P else '')
print('colour remap DS:0ABA[16]', list(C[CDS + 0xABA:CDS + 0xACA]))
print('colour remap DS:0ACA[16]', list(C[CDS + 0xACA:CDS + 0xADA]))
print('wall piece start/w/h DS:0ADA/0AE4/0AEE', list(C[CDS + 0xADA:CDS + 0xAF8]))
print('filename chars DS:0C9A', C[CDS + 0xC9A:CDS + 0xCA4])
print('wall banks DS:2682', [w(0x2682 + 2 * i) for i in range(5)], ' rebase DS:268C', [w(0x268C + 2 * i) for i in range(5)])
print('dx DS:2696', [s8(0x2696 + i) for i in range(9)], ' dy DS:269F', [s8(0x269F + i) for i in range(9)])
print('cloud cells DS:27D9', list(C[CDS + 0x27D9:CDS + 0x27E6]))
print('icon part colours DS:3EC2[1..6]', [b(0x3EC2 + i) for i in range(1, 7)])
print('battlefield cells DS:26A4 + c*4 (move, ?, sight, image):')
for c in range(0x42):
    print('  %02x %s' % (c, C[CDS + 0x26A4 + c * 4:CDS + 0x26A8 + c * 4].hex(' ')), end='' if c % 6 != 5 else '\n')
print()

h('Sound driver')
seg = None
probe = bytes.fromhex('2bdb895c04895c06895c0889')  # PoR driver code at 0x18AE:164E
i = C.find(probe)
if i >= 0:
    print('PoR driver code 18AE:164E found at image 0x%X; CotAB driver segment 0x0699 (image 0x6990), offsets = PoR - 0xBD' % i)
