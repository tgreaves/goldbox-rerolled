#!/usr/bin/env python3
"""Regenerate the generated routine lists of spec/D-appendices/addresses.md from the spec's citations.

  python3 tools/specaddresses.py           # rewrite the sections between the generated markers
  python3 tools/specaddresses.py --check   # exit 1 if they are out of date

Sections (between <!-- generated:NAME --> and <!-- /generated:NAME -->):
  bc-por  PoR routines (FUN_seg_off) that parts B and C cite and part A does not
  coab    CotAB image offsets that part A's coab/ files, part B and part C cite, with the citing files,
          the section of the first citation, and the PoR routine where the "Routines part A cites"
          table pairs one
A five-digit hex address in part B or C counts as CotAB's when it appears in a coab/ file, or when the
nearest game name before it in its table cell or sentence is "CotAB"; seg:off forms in coab/ files are
image paragraph and offset (4aab:18d9 = 0x4C389).
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'spec')
TARGET = os.path.join(ROOT, 'D-appendices', 'addresses.md')
FUN = re.compile(r'FUN_([0-9a-f]{4})_([0-9a-f]{4})')
HEX5 = re.compile(r'(?<![0-9A-Za-z_:])0x([0-9A-Fa-f]{5})\b')
SEGOFF = re.compile(r'(?<![0-9A-Za-z_])([0-9a-f]{4}):([0-9a-f]{4})\b')
HEADING = re.compile(r'^(#{1,6})\s+(.*)$')


def files(part):
    out = []
    for d, _, names in os.walk(os.path.join(ROOT, part)):
        out += [os.path.join(d, n) for n in names if n.endswith('.md')]
    return sorted(out)


def lines(path):
    fenced = False
    with open(path, encoding='utf-8') as f:
        for line in f:
            if line.startswith('```'):
                fenced = not fenced
                continue
            if not fenced:
                yield line.rstrip('\n')


def short(path):
    rel = os.path.relpath(path, ROOT)
    return rel.replace('A-games/engine/', '').replace('A-games/', '').replace('B-model/', 'B/').replace('C-port/', 'C/')[:-3]


def clean(heading):
    h = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', heading)
    h = re.sub(r'\s*\((O|I|\?)[,)].*$', '', h)  # drop the evidence mark and its addresses
    return h.strip().strip('`')


def game_before(text, pos, header_game):
    """The game a five-digit address belongs to by its context: the last game name before it."""
    before = text[:pos]
    p, c = before.rfind('PoR'), before.rfind('CotAB')
    if c > p:
        return 'coab'
    if p > c:
        return 'por'
    return header_game


def table_headers(line, prev_header):
    cells = [c.strip() for c in line.strip().strip('|').split('|')]
    return cells if prev_header is None else prev_header


def scan():
    part_a = files('A-games')
    part_bc = files('B-model') + files('C-port')
    a_funs = set()
    for p in part_a:
        for line in lines(p):
            a_funs.update(m.group(0) for m in FUN.finditer(line))
    # the PoR routines of the "Routines part A cites" table and their CotAB pairs
    pairs = {}
    in_table = False
    for line in lines(TARGET):
        if line.startswith('## Routines part A cites'):
            in_table = True
        elif line.startswith('## ') and in_table:
            in_table = False
        if in_table and line.startswith('| `FUN_'):
            cells = [c.strip() for c in line.strip('|').split('|')]
            for m in HEX5.finditer(cells[3]):
                pairs.setdefault(int(m.group(1), 16), cells[0].strip('`'))
    bc_por = {}
    coab = {}

    def cite(addr, path, section):
        e = coab.setdefault(addr, {'files': [], 'section': None})
        s = short(path)
        if s not in e['files']:
            e['files'].append(s)
        if e['section'] is None:
            e['section'] = f'{s}: {section}'

    coab_seen = set()
    for p in files(os.path.join('A-games', 'coab')):
        section = ''
        for line in lines(p):
            h = HEADING.match(line)
            if h:
                section = clean(h.group(2))
            for m in HEX5.finditer(line):
                a = int(m.group(1), 16)
                coab_seen.add(a)
                cite(a, p, section)
            for m in SEGOFF.finditer(line):
                seg, off = int(m.group(1), 16), int(m.group(2), 16)
                a = seg * 16 + off
                if 0x400 <= seg < 0x6000:
                    coab_seen.add(a)
                    cite(a, p, section)
    for p in part_bc:
        section = ''
        header = None
        for line in lines(p):
            h = HEADING.match(line)
            if h:
                section = clean(h.group(2))
                header = None
            for m in FUN.finditer(line):
                if m.group(0) not in a_funs:
                    e = bc_por.setdefault(m.group(0), [])
                    if short(p) not in e:
                        e.append(short(p))
            is_row = line.startswith('|')
            if is_row and header is None:
                header = [c.strip() for c in line.strip().strip('|').split('|')]
            elif not is_row:
                header = None
            for m in HEX5.finditer(line):
                a = int(m.group(1), 16)
                game = None
                if a in coab_seen:
                    game = 'coab'
                elif is_row and header:
                    idx = line[:m.start()].count('|') - 1
                    col = header[idx] if 0 <= idx < len(header) else ''
                    cell_start = line.rfind('|', 0, m.start()) + 1
                    game = game_before(line[cell_start:], m.start() - cell_start, 'coab' if 'CotAB' in col else 'por' if 'PoR' in col else None)
                else:
                    game = game_before(line, m.start(), None)
                if game == 'coab':
                    cite(a, p, section)
    return bc_por, coab, pairs


def render(bc_por, coab, pairs):
    a = ['| PoR | Image | Cited in |', '|---|---|---|']
    for f in sorted(bc_por):
        seg, off = int(f[4:8], 16), int(f[9:13], 16)
        a.append(f'| `{f}` | 0x{(seg - 0x1000) * 16 + off:05X} | {", ".join(bc_por[f])} |')
    c = ['| CotAB | Cited in | First cited in | PoR |', '|---|---|---|---|']
    for addr in sorted(coab):
        e = coab[addr]
        sec = e['section'].replace('|', '\\|')
        por = f'`{pairs[addr]}`' if addr in pairs else ''
        c.append(f'| 0x{addr:05X} | {", ".join(e["files"])} | {sec} | {por} |')
    return {'bc-por': '\n'.join(a) + '\n', 'coab': '\n'.join(c) + '\n'}


def splice(text, name, body):
    a, b = f'<!-- generated:{name} -->', f'<!-- /generated:{name} -->'
    i, j = text.index(a), text.index(b)
    return text[:i + len(a)] + '\n' + body + text[j:]


def main():
    sections = render(*scan())
    with open(TARGET, encoding='utf-8') as f:
        text = f.read()
    new = text
    for name, body in sections.items():
        new = splice(new, name, body)
    if '--check' in sys.argv:
        if new != text:
            print('addresses.md: the generated routine lists are out of date (run tools/specaddresses.py)')
            sys.exit(1)
        print('addresses.md: up to date')
        return
    with open(TARGET, 'w', encoding='utf-8') as f:
        f.write(new)
    print(f'addresses.md: {sections["bc-por"].count(chr(10)) - 2} PoR routines of parts B and C, '
          f'{sections["coab"].count(chr(10)) - 2} CotAB addresses')


if __name__ == '__main__':
    main()
