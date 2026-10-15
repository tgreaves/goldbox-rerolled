"""Character record decoder (CHRDATn.SAV / party list node, 0x11D bytes).

Field offsets come from the character-sheet code (segment 4894) and its helpers
(10ba:08ef AC, 10ba:0973 HP). Names come from the engine's DS string tables.

Usage: python3 chars.py <CHRDATxx.SAV> [...]
"""
import sys, struct

CLASSES = ['Cleric', 'Druid', 'Fighter', 'Paladin', 'Ranger', 'Magic-User', 'Thief', 'Monk',
           'Cleric/Fighter', 'Cleric/Fighter/Magic-User', 'Cleric/Ranger', 'Cleric/Magic-User',
           'Cleric/Thief', 'Fighter/Magic-User', 'Fighter/Thief', 'Fighter/Magic-User/Thief',
           'Magic-User/Thief', 'Monster']
BASE_CLASSES = CLASSES[:8]
RACES = ['Monster', 'Dwarf', 'Elf', 'Gnome', 'Half-Elf', 'Halfling', 'Half-Orc', 'Human']
ALIGNMENTS = ['Lawful Good', 'Lawful Neutral', 'Lawful Evil', 'Neutral Good', 'True Neutral',
              'Neutral Evil', 'Chaotic Good', 'Chaotic Neutral', 'Chaotic Evil']
GENDERS = ['Male', 'Female']
MONEY = ['Copper', 'Silver', 'Electrum', 'Gold', 'Platinum', 'Gems', 'Jewelry']
STATUS = ['Okay', 'Animated', 'tempgone', 'Running', 'Unconscious', 'Dying', 'Dead', 'Stoned']

SIZE = 0x11D


def pick(table, i):
    return table[i] if 0 <= i < len(table) else '#%d' % i


def decode(d):
    assert len(d) == SIZE, len(d)
    c = {}
    c['name'] = d[1:1 + d[0]].decode('latin1')
    st = list(d[0x10:0x16])
    c['stats'] = dict(zip(['STR', 'INT', 'WIS', 'DEX', 'CON', 'CHA'], st))
    c['str_pct'] = d[0x16]
    c['race'] = pick(RACES, d[0x2E])
    c['class'] = pick(CLASSES, d[0x2F])
    c['age'] = struct.unpack_from('<H', d, 0x30)[0]
    c['hp_max'] = d[0x32]
    c['money'] = dict(zip(MONEY, struct.unpack_from('<7H', d, 0x88)))
    c['levels'] = {k: v for k, v in zip(BASE_CLASSES, d[0x96:0x9E]) if v}
    c['gender'] = pick(GENDERS, d[0x9E])
    c['alignment'] = pick(ALIGNMENTS, d[0xA0])
    c['exp'] = struct.unpack_from('<I', d, 0xAC)[0]
    c['encumbrance'] = struct.unpack_from('<H', d, 0x102)[0]
    c['status'] = pick(STATUS, d[0x10C])
    c['thac0'] = 60 - d[0x110]
    c['ac'] = 60 - d[0x111]
    c['damage'] = '%dd%d%+d' % (d[0x115], d[0x117], struct.unpack_from('<b', d, 0x119)[0])
    c['hp'] = d[0x11B]
    c['movement'] = d[0x11C]
    c['npc'] = d[0x84] >= 0x80
    return c


if __name__ == '__main__':
    for p in sys.argv[1:]:
        c = decode(open(p, 'rb').read())
        print(p.split('/')[-1], c)
