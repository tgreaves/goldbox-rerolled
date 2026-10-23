#!/usr/bin/env python3
"""A saved game written by the original (in DOSBox) against the port's of the same moment, file by file
and byte by byte, leaving out the bytes the original never reads back (spec/VALIDATION.md §4).

Usage:
  savecompare.py GAME SLOT ORIGINAL_DIR PORT_DIR

GAME is the profile id (por); SLOT the save letter. ORIGINAL_DIR holds what run.py kept of the run
(SAVGAM<x>.DAT and the CHRDAT<x><n> files), PORT_DIR what the headless runner's --save wrote. Every
other byte must be equal; each difference is listed with its file and offset. Exits 1 on any.
"""
import os, sys

# The bytes a load never reads (spec/A-games/engine/savegame.md, "Files"; records.md): the in-memory
# pointers of the character record (effect list 0x7F, item list 0xC8, readied items 0xCC-0xFF, next
# 0x104), each item's next pointer (+0x2A) and each effect's (+5), and the stem table's slack after
# each Pascal string and every slot past the party count (0x3208, then 8 x 41 bytes). The original
# deletes an empty item or effect file where the port's export keeps it empty (IMP-006): not a difference.
NEVER_READ = {
    'por': {
        'sav': [(0x7F, 4), (0xC8, 4), (0xCC, 0x34), (0x104, 4)],
        'items': ('ITM', 63, [(0x2A, 4)]),
        'effects': ('SPC', 9, [(5, 4)]),
        'stems': (0x3208, 8, 41),
        # where SAVGAM<x>.DAT's bytes live as ECL addresses (savegame.md, layout): A, B, C, the code buffer
        'ecl': [(1, 0x800, 0x4900, 2), (0x801, 0x800, 0x6B00, 2), (0x1001, 0x400, 0x9700, 2), (0x1401, 0x1E00, 0x9900, 1)],
    },
}


def ecl_name(game, i):
    for at, size, base, step in NEVER_READ[game]['ecl']:
        if at <= i < at + size:
            return f' (ECL 0x{base + (i - at) // step:04X})'
    return ''


def skip_set(game, name, data):
    g = NEVER_READ[game]
    n = name.upper()
    if n.endswith('.SAV'):
        return {o + i for o, k in g['sav'] for i in range(k)}
    for kind in ('items', 'effects'):
        ext, size, fields = g[kind]
        if n.endswith('.' + ext):
            return {r + o + i for r in range(0, len(data), size) for o, k in fields for i in range(k)}
    if n.startswith('SAVGAM'):
        at, slots, size = g['stems']
        out = set()
        for s in range(slots):
            base = at + 1 + s * size
            used = 1 + data[base] if s < data[at] else 0
            out |= set(range(base + used, base + size))
        return out
    return set()


def main(a):
    if len(a) != 4 or a[0] not in NEVER_READ:
        raise SystemExit(__doc__)
    game, slot, orig, port = a[0], a[1].upper(), a[2], a[3]
    mine = lambda d: {n.upper(): n for n in os.listdir(d) if n.upper().startswith((f'SAVGAM{slot}.', f'CHRDAT{slot}')) and not n.upper().endswith('.GBR')}
    o, p = mine(orig), mine(port)
    bad = 0
    for n in sorted(o.keys() | p.keys()):
        if n not in o or n not in p:
            side, d = ('original', orig) if n in o else ('port', port)
            size = os.path.getsize(os.path.join(d, (o if n in o else p)[n]))
            if side == 'port' and size == 0 and not n.endswith('.SAV'):
                print(f'{n}: empty in the port, not written by the original (IMP-006)')
                continue
            print(f'{n}: only the {side} wrote it ({size} bytes)')
            bad += 1
            continue
        x = open(os.path.join(orig, o[n]), 'rb').read()
        y = open(os.path.join(port, p[n]), 'rb').read()
        if len(x) != len(y):
            print(f'{n}: {len(x)} bytes in the original, {len(y)} in the port')
            bad += 1
            continue
        skip = skip_set(game, n, x) | skip_set(game, n, y)
        diff = [i for i in range(len(x)) if x[i] != y[i] and i not in skip]
        if diff:
            bad += 1
            where = (lambda i: ecl_name(game, i)) if n.startswith('SAVGAM') else (lambda i: '')
            print(f'{n}: {len(diff)} byte(s) differ, original/port: ' + ', '.join(f'0x{i:04X}{where(i)} {x[i]:02X}/{y[i]:02X}' for i in diff[:24]))
        else:
            print(f'{n}: equal ({len(x)} bytes, {len(skip & set(range(len(x))))} never read)')
    print('saves equal' if not bad else f'{bad} file(s) differ')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
