"""Dump the engine's spell table (names DS:2912, 41-byte Pascal strings; records DS:31FA + id*16).

Needs START.EXE unpacked by unexepack.py. DS = paragraph 0x0C7C of the load image.

Usage: python3 spells.py <START_UNPACKED.EXE>
"""
import sys, struct

DS_PARA = 0x0C7C
CLASS = {0: 'Cleric', 1: 'Magic-User'}
SAVE_EFFECT = {0: '-', 1: 'negates', 2: 'half', 3: 'special'}
SAVE_KIND = ['death/poison', 'petrification', 'rod/staff/wand', 'breath', 'spell']
WHERE = {0: 'camp', 1: 'combat', 2: 'both'}


def load(path):
    b = open(path, 'rb').read()
    hdr = struct.unpack_from('<H', b, 8)[0] * 16
    img = b[hdr:]
    ds = DS_PARA * 16
    names = []
    p = ds + 0x2912
    for _ in range(56):
        names.append(img[p + 1:p + 1 + img[p]].decode('latin1')); p += 41
    spells = []
    for sid in range(1, 57):
        r = img[ds + 0x31FA + sid * 16: ds + 0x31FA + sid * 16 + 16]
        spells.append(dict(
            id=sid, name=names[sid - 1], cls=CLASS.get(r[0], r[0]), level=r[1],
            range=('touch' if r[2] == 0xFF else '%d+%d/lvl' % (r[2], r[3])),
            duration='%d+%d/lvl' % (r[4], r[5]), target=r[6], side=r[7],
            save=SAVE_EFFECT.get(r[8], r[8]), save_vs=SAVE_KIND[r[9]] if r[9] < 5 else r[9],
            effect=r[10], where=WHERE.get(r[11], r[11]), cast_time=r[12],
            ai_priority=r[13], ai_offensive=r[14], area=r[15]))
    return spells


if __name__ == '__main__':
    print('| id | name | class | lvl | range | duration | target | side | save | vs | effect | where | time | AI pri | AI off | area |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for s in load(sys.argv[1]):
        print('| %(id)d | %(name)s | %(cls)s | %(level)d | %(range)s | %(duration)s | %(target)d | %(side)d | %(save)s | '
              '%(save_vs)s | 0x%(effect)02X | %(where)s | %(cast_time)d | %(ai_priority)d | %(ai_offensive)d | %(area)d |' % s)
