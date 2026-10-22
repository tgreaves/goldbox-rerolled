#!/usr/bin/env python3
"""CotAB (Curse of the Azure Bonds) record decoder.

Usage:
  records_coab.py [SAVE_DIR]            pre-made party + .FX + SAVGAMA.DAT (default $COAB/SAVE)
  records_coab.py --mon GAME_DIR [N]    monsters from MON<N>CHA/ITM/SPC.DAX (all blocks if N omitted)
  records_coab.py --por FILE.CHA        convert a PoR 285-byte record the way the CotAB engine does
                                        (323c:14b3) and print the result
Layout: see spec/A-games/coab/records.md.  Offsets are CotAB record offsets.
"""
import os, sys, struct, glob

COAB = os.environ.get('COAB', 'CURSE')  # the CotAB game folder, as the web tests take it

REC = 0x1A6          # 422
ITEM = 0x3F          # 63
FX = 9
POR_REC = 0x11D      # 285

RACES = ['Monster', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling', 'Half-Orc', 'Human']
CLASSES = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk',
           'Cleric/Fighter', 'Cleric/Fighter/Magic-User', 'Cleric/Ranger', 'Cleric/Magic-User',
           'Cleric/Thief', 'Fighter/Magic-User', 'Fighter/Thief', 'Fighter/Magic-User/Thief',
           'Magic-User/Thief', 'Monster']
BASE = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk']
ALIGN = ['LG', 'LN', 'LE', 'NG', 'TN', 'NE', 'CG', 'CN', 'CE']
STATUS = ['Okay', 'Animated', 'tempgone', 'Running', 'Unconscious', 'Dying', 'Dead', 'Stoned', 'Gone']
MONEY = ['cp', 'sp', 'ep', 'gp', 'pp', 'gems', 'jewelry']
STATS = ['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA']
THIEF = ['PP', 'OL', 'F/RT', 'MS', 'HS', 'HN', 'CW', 'RL']
SAVES = ['death', 'petri', 'rod', 'breath', 'spell']

u8 = lambda d, o: d[o]
s8 = lambda d, o: d[o] - 256 if d[o] > 127 else d[o]
u16 = lambda d, o: struct.unpack_from('<H', d, o)[0]
u32 = lambda d, o: struct.unpack_from('<I', d, o)[0]
pick = lambda t, i: t[i] if 0 <= i < len(t) else '#%d' % i


def pstr(d, o, maxlen):
    n = min(d[o], maxlen)
    return d[o + 1:o + 1 + n].decode('latin-1')


def decode(d):
    """CotAB character/monster record (0x1A6 bytes) -> dict."""
    assert len(d) >= REC, len(d)
    c = {'name': pstr(d, 0, 15)}
    # 0x10..0x1B: six stats as (base, current) pairs; 0x1C current STR%, 0x1D base STR%
    c['stats'] = {s: (d[0x10 + 2 * i], d[0x11 + 2 * i]) for i, s in enumerate(STATS)}
    c['str_pct'] = (d[0x1D], d[0x1C])                     # (base, current)
    c['memorised'] = [b for b in d[0x1E:0x72] if b]       # 84 slots, >= 0x80 = being learned
    c['learn_hours'] = d[0x72]
    c['thac0'] = 60 - d[0x73]
    c['race'] = pick(RACES, d[0x74])
    c['cls'] = pick(CLASSES, d[0x75])
    c['age'] = u16(d, 0x76)
    c['hp_max'] = d[0x78]
    c['known'] = [i + 1 for i in range(100) if d[0x79 + i]]
    c['sweeps'] = d[0xDD]
    c['size'] = d[0xDE]
    c['saves'] = list(d[0xDF:0xE4])
    c['base_move'] = d[0xE4]
    c['hit_dice'] = d[0xE5]
    c['hd_copy'] = d[0xE6]
    c['undead'] = d[0xE9]
    c['thief'] = list(d[0xEA:0xF2])
    c['morale'] = d[0xF7]
    c['npc'] = d[0xF7] >= 0x80
    c['money'] = [u16(d, 0xFB + 2 * i) for i in range(7)]
    c['levels'] = {BASE[i]: d[0x109 + i] for i in range(8) if d[0x109 + i]}
    c['old_levels'] = {BASE[i]: d[0x111 + i] for i in range(8) if d[0x111 + i]}
    c['gender'] = 'F' if d[0x119] else 'M'
    c['mtype'] = d[0x11A]
    c['align'] = pick(ALIGN, d[0x11B])
    c['attacks2'] = (d[0x11C], d[0x11D])
    c['nat_dmg'] = ((d[0x11E], d[0x120], s8(d, 0x122)), (d[0x11F], d[0x121], s8(d, 0x123)))
    c['base_ac'] = 60 - d[0x124]
    c['str_bonus_on'] = d[0x125]
    c['mod_id'] = d[0x126]
    c['exp'] = u32(d, 0x127)
    c['class_mask'] = d[0x12B]
    c['hp_rolled'] = d[0x12C]
    c['slots'] = {'cleric': list(d[0x12D:0x132]), 'druid': list(d[0x132:0x137]), 'mu': list(d[0x137:0x13C])}
    c['xp_award'] = u16(d, 0x13C)
    c['xp_per_hp'] = d[0x13E]
    c['icon'] = {'head': d[0x141], 'weapon': d[0x142], 'id': d[0x143], 'size': d[0x144],
                 'colours': d[0x145:0x14B].hex()}
    c['item_count'] = d[0x14C]
    c['hands'] = d[0x185]
    c['save_bonus'] = s8(d, 0x186)
    c['encumbrance'] = u16(d, 0x187)
    c['status'] = pick(STATUS, d[0x195])
    c['in_play'] = d[0x196]
    c['side'] = d[0x197]
    c['quick'] = d[0x198]
    c['thac0_cur'] = 60 - d[0x199]
    c['ac'] = 60 - d[0x19A]
    c['ac_rear'] = 60 - d[0x19B]
    c['dmg'] = ((d[0x19E], d[0x1A0], s8(d, 0x1A2)), (d[0x19F], d[0x1A1], s8(d, 0x1A3)))
    c['hp'] = d[0x1A4]
    c['move'] = d[0x1A5]
    return c


def dice(t):
    n, s, b = t
    return '%dd%d%s' % (n, s, ('%+d' % b) if b else '')


def show(c, fx=None):
    st = ' '.join('%s %d%s' % (k, v[1], '' if v[0] == v[1] else '(base %d)' % v[0]) for k, v in c['stats'].items())
    if c['stats']['STR'][1] == 18 and c['str_pct'][1]:
        st = st.replace('STR 18', 'STR 18/%02d' % (c['str_pct'][1] % 100), 1)
    lv = '/'.join('%s %d' % kv for kv in c['levels'].items()) or '-'
    print('%-15s %s %s %s, %s, age %d, %s%s' % (c['name'], c['gender'], c['race'], c['cls'], c['align'],
          c['age'], lv, '  (NPC)' if c['npc'] else ''))
    print('   %s' % st)
    print('   HP %d/%d (rolled %d)  AC %d (base %d, rear %d)  THAC0 %d  XP %d  move %d  status %s' % (
        c['hp'], c['hp_max'], c['hp_rolled'], c['ac'], c['base_ac'], c['ac_rear'], c['thac0'], c['exp'],
        c['move'], c['status']))
    print('   saves %s  attacks/2 %d+%d  damage %s / %s  hit dice %d  class mask 0x%02x' % (
        c['saves'], c['attacks2'][0], c['attacks2'][1], dice(c['dmg'][0]), dice(c['dmg'][1]),
        c['hit_dice'], c['class_mask']))
    money = ', '.join('%d %s' % (v, MONEY[i]) for i, v in enumerate(c['money']) if v)
    print('   money: %s  items %d  encumbrance %d' % (money or '-', c['item_count'], c['encumbrance']))
    if any(c['thief']):
        print('   thief %s' % ' '.join('%s %d' % (THIEF[i], v) for i, v in enumerate(c['thief'])))
    for k, v in c['slots'].items():
        if any(v):
            print('   %s spell slots L1-5 %s' % (k, v))
    if c['known']:
        print('   spells known (ids): %s' % c['known'])
    if c['memorised']:
        print('   memorised: %s' % c['memorised'])
    if c['old_levels']:
        print('   previous class levels: %s' % c['old_levels'])
    if fx:
        print('   effects: %s' % ', '.join('%d (0x%02x) dur %d power %d%s' % (
            e[0], e[0], u16(e, 1), e[3], ' [removal cb]' if e[4] else '') for e in fx))


def items(d):
    """63-byte item records, same layout as PoR (spec/A-games/engine/records.md)."""
    out = []
    for o in range(0, len(d) - ITEM + 1, ITEM):
        r = d[o:o + ITEM]
        out.append({'name': pstr(r, 0, 41), 'type': r[0x2E], 'words': tuple(r[0x2F:0x32]),
                    'plus': s8(r, 0x32), 'readied': r[0x34], 'weight': u16(r, 0x37), 'count': r[0x39],
                    'value': u16(r, 0x3A), 'props': tuple(r[0x3C:0x3F])})
    return out


def effects(d):
    return [d[o:o + FX] for o in range(0, len(d) - FX + 1, FX)]


def savgam(path):
    d = open(path, 'rb').read()
    print('%s: %d bytes' % (os.path.basename(path), len(d)))
    A = d[1:0x801]; B = d[0x801:0x1001]
    print('   block %d  pos (%d,%d) facing %d  wall %d  square %d  saved states %d/%d' % (
        d[0], d[0x3201], d[0x3202], d[0x3203], d[0x3204], d[0x3205], d[0x3206], d[0x3207]))
    ws = struct.unpack_from('<6H', d, 0x3208)
    print('   wall-set slots (record, slot): %s' % [(ws[2 * i], ws[2 * i + 1]) for i in range(3)])
    n = d[0x3214]
    stems = [pstr(d, 0x3215 + 41 * i, 40) for i in range(n)]
    print('   party %d: %s' % (n, stems))
    print('   A[0x1F8] speed %d  A[0x1FE] pics %d  A[0x1CC] map-area flag %d  A[0x18A] 3D map %d  B[0x624] block %d' % (
        u16(A, 0x1F8), u16(A, 0x1FE), u16(A, 0x1CC), u16(A, 0x18A), u16(B, 0x624)))
    return stems


def party(save):
    for n in range(1, 9):
        p = os.path.join(save, 'CHRDATA%d.SAV' % n)
        if not os.path.exists(p):
            continue
        d = open(p, 'rb').read()
        assert len(d) == REC, (p, len(d))
        fxp = p[:-4] + '.FX'
        fx = effects(open(fxp, 'rb').read()) if os.path.exists(fxp) else []
        swg = p[:-4] + '.SWG'
        show(decode(d), fx)
        if os.path.exists(swg):
            for it in items(open(swg, 'rb').read()):
                print('   item', it)
        print()
    g = os.path.join(save, 'SAVGAMA.DAT')
    if os.path.exists(g):
        savgam(g)


def monsters(game, blocks):
    sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
    from dax import read_dax, unrle

    def load(path):
        if not os.path.exists(path):
            return {}
        b, base, ents = read_dax(path)
        return {rid: unrle(b[base + off:base + off + comp], raw, 0)[0] for rid, off, raw, comp in ents}
    for n in blocks:
        cha = load(os.path.join(game, 'MON%dCHA.DAX' % n))
        itm = load(os.path.join(game, 'MON%dITM.DAX' % n))
        spc = load(os.path.join(game, 'MON%dSPC.DAX' % n))
        print('== block %d: %d monsters' % (n, len(cha)))
        for rid in sorted(cha):
            d = cha[rid]
            assert len(d) == REC
            c = decode(d)
            its = items(itm.get(rid, b''))
            fx = effects(spc.get(rid, b''))
            print('#%-3d %-15s HD %d HP %d AC %d THAC0 %d natural %s x%d/2  morale 0x%02x  side %d  XP %d+%d/hp  items [%s]  fx %s' % (
                rid, c['name'], c['hit_dice'], c['hp'], c['ac'], c['thac0'], dice(c['nat_dmg'][0]), c['attacks2'][0],
                c['morale'], c['side'], c['xp_award'], c['xp_per_hp'],
                ', '.join('t%d%+d' % (i['type'], i['plus']) for i in its), [e[0] for e in fx]))


# ---- PoR -> CotAB conversion (engine 323c:14b3, nested in the loader 323c:22a0) ----
# Race/sex limits, DS:3F88 + 16*race: [0,1] STR min M/F, [2,3] STR max M/F, [4,5] STR% max M/F,
# [6,7] INT min/max, [8,9] WIS, [10,11] DEX, [12,13] CON, [14,15] CHA (bytes from the image).
RACE_LIMITS = {
    1: [8, 8, 18, 17, 99, 0, 3, 18, 3, 18, 3, 17, 12, 19, 3, 16],
    2: [3, 3, 18, 16, 75, 0, 8, 18, 3, 18, 7, 19, 6, 18, 8, 18],
    3: [6, 6, 18, 15, 50, 0, 7, 18, 3, 18, 3, 18, 8, 18, 3, 18],
    4: [3, 3, 18, 17, 90, 0, 4, 18, 3, 18, 6, 18, 6, 18, 3, 18],
    5: [6, 6, 17, 14, 0, 0, 6, 18, 3, 17, 8, 18, 10, 19, 3, 18],
    6: [6, 6, 18, 18, 99, 75, 3, 17, 3, 14, 3, 17, 13, 19, 3, 12],
    7: [3, 3, 18, 18, 100, 50, 3, 18, 3, 18, 3, 18, 3, 18, 3, 18],
}
RACE0 = [0, 5, 10, 0, 5, 5, 10, 15, 5, 10, 10, 15, 20, 10, 12, 12]   # race 0 row as shipped
POR_SPC_KEEP = {18, 26, 47, 48, 97, 107, 124}                         # set at 323c:2280


def convert_por(p, faithful=True):
    """PoR 285-byte record -> CotAB 422-byte record, field for field as 323c:14b3 does.
    faithful=True reproduces the STR% bug (writes the race STR% cap into base STR)."""
    assert len(p) >= POR_REC
    c = bytearray(REC)
    c[0x74] = p[0x2E]; c[0x119] = p[0x9E]
    c[0:16] = p[0:16]                                   # name (string[15])
    lim = RACE_LIMITS.get(p[0x2E], RACE0); sex = p[0x9E]
    for i in range(6):
        v = p[0x10 + i]
        if i == 0:
            lo, hi = lim[0 + sex], lim[2 + sex]
        else:
            lo, hi = lim[4 + 2 * i], lim[5 + 2 * i]
        v = max(v, lo); v = min(v, hi)
        c[0x10 + 2 * i] = v; c[0x11 + 2 * i] = v
    c[0x1C] = p[0x16]
    if faithful and lim[4 + sex] > c[0x10]:             # Bug (O): compares/stores base STR, not STR%
        c[0x10] = lim[4 + sex]
    c[0x1D] = p[0x16]
    c[0x73] = p[0x2D]; c[0x75] = p[0x2F]; c[0x76:0x78] = p[0x30:0x32]; c[0x78] = p[0x32]
    c[0x79:0x79 + 0x38] = p[0x33:0x33 + 0x38]; c[0x9C] = 0   # spell 36 (Animate Dead) forgotten
    c[0xDD] = p[0x6B]; c[0xDE] = p[0x6C]; c[0xDF:0xE4] = p[0x6D:0x72]
    c[0xE4] = p[0x72]; c[0xE5] = p[0x73]; c[0xE6] = c[0xE5]
    c[0xE7] = p[0x74]; c[0xE8] = p[0x75]; c[0xE9] = p[0x76]; c[0xEA:0xF2] = p[0x77:0x7F]
    c[0xF6:0xFB] = p[0x83:0x88]
    struct.pack_into('<H', c, 0x103, 300)                # money: only 300 platinum
    c[0x109:0x111] = p[0x96:0x9E]
    c[0x11A] = p[0x9F]; c[0x11B] = p[0xA0]; c[0x11C:0x11E] = p[0xA1:0xA3]
    c[0x11E:0x120] = p[0xA3:0xA5]; c[0x120:0x122] = p[0xA5:0xA7]; c[0x122:0x124] = p[0xA7:0xA9]
    c[0x124] = p[0xA9]; c[0x125] = p[0xAA]; c[0x126] = p[0xAB]; c[0x127:0x12B] = p[0xAC:0xB0]
    c[0x12B] = p[0xB0]; c[0x12C] = p[0xB1]
    c[0x12D:0x130] = p[0xB2:0xB5]; c[0x137:0x13A] = p[0xB5:0xB8]
    c[0x13C:0x13E] = p[0xB8:0xBA]; c[0x13E] = p[0xBA]; c[0x13F] = p[0xBB]; c[0x140] = p[0xBC]
    c[0x141] = p[0xBD]; c[0x142] = p[0xBE]; c[0x144] = p[0xC0]; c[0x145:0x14B] = p[0xC1:0xC7]
    c[0x14C] = p[0xC7]; c[0x151:0x185] = p[0xCC:0x100]   # stale pointers, cleared by the recalc
    c[0x185] = p[0x100]; c[0x186] = p[0x101]; c[0x187:0x189] = p[0x102:0x104]
    c[0x195] = p[0x10C]; c[0x196] = p[0x10D]; c[0x197] = p[0x10E]; c[0x199] = p[0x110]
    c[0x19A:0x19C] = p[0x111:0x113]; c[0x19C:0x19E] = p[0x113:0x115]; c[0x19E:0x1A0] = p[0x115:0x117]
    c[0x1A0:0x1A2] = p[0x117:0x119]; c[0x1A2:0x1A4] = p[0x119:0x11B]
    c[0x1A4] = p[0x11B]; c[0x1A5] = p[0x11C]
    return bytes(c)


def main(a):
    if a and a[0] == '--mon':
        game = a[1] if len(a) > 1 else COAB
        monsters(game, [int(a[2])] if len(a) > 2 else range(1, 7))
    elif a and a[0] == '--por':
        p = open(a[1], 'rb').read()
        c = decode(convert_por(p))
        show(c)
        print('   (items are not transferred; money replaced by 300 pp; then recalc 4d05:0c20 and class bonuses 5047:03c6 run)')
    else:
        party(a[0] if a else os.path.join(COAB, 'SAVE'))


if __name__ == '__main__':
    main(sys.argv[1:])
