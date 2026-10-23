#!/usr/bin/env python3
"""A headless script of the port's, typed into the original (spec/VALIDATION.md §4): the port runs the
script (web/headless/run.ts, with the shop, the temple and the camp run on its answers), its transcript
is turned into the original's keys, those are typed into the original in DOSBox, and the two saves the
script ends with are compared by savecompare.py.

Usage:
  scriptcheck.py por POOLRAD_DIR SCRIPT.json --slot X [--out DIR] [--no-grab] [--pace S]

SCRIPT.json is the headless runner's script (host-contracts.md §8.1), with "town": true and
"camp": true so that the shop, the temple and the camp take their answers, and ending in the camp's
Save (the original saves only from camp). An F12 follows every key, so each screen is kept (FRAMEnn.png,
nn the key's number) and the original has time for the screens a key brings up; --no-grab leaves them out.

The keys (the original's input, spec/A-games/engine/input-and-menus.md):
- the exploration commands f l r b as the arrows, e (Encamp) as E;
- a horizontal menu's answer as the hot key the port's menu gives for it (the menu routine's rule, a
  word chosen by any of its capitals or digits), or else the first capital or digit of the item that
  no earlier item has (a key equal to any character of the items selects the first word holding it);
- a vertical list's answer as End (the highlight down) or Home (up) from the row the list opens on
  (the first, or LIST_START's) and Enter, or the entry's own key where it has one (EXIT's E);
- the camp's Save as the slot letter, a number as its digits and Enter, a text as its letters and Enter.
"""
import json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', '..', 'web')
START = {'por': ('x enter l {save}', 'STING')}
ARROW = {'f': 'up', 'l': 'left', 'r': 'right', 'b': 'down', 'e': 'e'}
HOT = re.compile(r'[A-Z0-9]')
# where a vertical list's highlight starts, by its prompt, where it is not the first entry: PoR's Buy
# list opens on the second stock entry (FUN_2f70_0361 passes the list routine index 1, 0x1FA7C)
LIST_START = {'por': [(re.compile(r'buys:$'), 1)]}
# the key that takes a vertical list's highlighted row, by its prompt, where it is not Enter (none so far)
LIST_TAKE = {}


def hot(items, k):
    """The key that chooses item k of a horizontal menu by the menu routine's rule."""
    joined = ' '.join(items).upper()
    start = len(' '.join(items[:k])) + (1 if k else 0)
    for i, c in enumerate(items[k].upper()):
        if HOT.match(c) and joined.index(c) == start + i:
            return c.lower()
    raise SystemExit(f'no key reaches "{items[k]}" in {items}')


def keys_of(game, events, slot):
    out = []
    for e in events:
        ev = e['event']
        if ev == 'command':
            c = e['command']
            if c not in ARROW:
                raise SystemExit(f'command {c} has no key here')
            out.append(ARROW[c])
        elif ev == 'menu':
            items, k, keys = e['items'], e['answer'], e.get('keys') or []
            if k < len(keys) and keys[k]:
                out.append(keys[k][0].lower())
            elif e.get('vertical'):
                at = next((n for r, n in LIST_START.get(game, []) if r.search(e.get('prompt', ''))), 0)
                take = next((x for r, x in LIST_TAKE.get(game, []) if r.search(e.get('prompt', ''))), 'enter')
                out += (['end'] * (k - at) if k >= at else ['home'] * (at - k)) + [take]
            else:
                out.append(hot(items, k))
        elif ev == 'save':
            out.append(slot.lower())
        elif ev == 'input' and e.get('kind') == 'number':
            out += list(str(e['answer'])) + ['enter']
        elif ev == 'input' and e.get('kind') == 'text':
            out += [c.lower() if c != ' ' else 'space' for c in e['answer']] + ['enter']
        elif ev == 'input':
            raise SystemExit(f'an input the bridge does not type: {e}')
    return out


def main(a):
    if len(a) < 3 or a[0] not in START or '--slot' not in a:
        raise SystemExit(__doc__)
    game, folder, script = a[0], os.path.abspath(a[1]), os.path.abspath(a[2])
    slot = a[a.index('--slot') + 1].lower()
    out = os.path.abspath(a[a.index('--out') + 1]) if '--out' in a else tempfile.mkdtemp(prefix='scriptcheck-')
    pace = a[a.index('--pace') + 1] if '--pace' in a else '3'
    os.makedirs(out, exist_ok=True)
    s = json.load(open(script))
    saved = os.path.join(out, 'port-save')
    tr = os.path.join(out, 'transcript.jsonl')
    subprocess.run(['node', '--import', './headless/node-ts.mjs', 'headless/run.ts', '--files', folder, '--script', script,
                    '--out', tr, '--save', saved, '--slot', slot.upper()], cwd=WEB, check=True)
    events = [json.loads(l) for l in open(tr) if l.strip()]
    if not any(e['event'] == 'save' for e in events):
        raise SystemExit('the script does not end in the camp\'s Save')
    keys = keys_of(game, events, slot)
    if '--no-grab' not in a:
        keys = [x for k in keys for x in (k, 'f12')]
    start, args = START[game]
    typed = ' '.join([start.format(save=s.get('save', 'A').lower()), 'f12'] + keys + ['f12'])
    open(os.path.join(out, 'keys.txt'), 'w').write(typed + '\n')
    print(f'{len(keys)} keys: {typed}')
    subprocess.run([sys.executable, os.path.join(HERE, 'run.py'), '--game', folder, '--out', out, '--keys', typed,
                    '--wait', '6', '--pace', pace, '--args', args,
                    '--seconds', str(20 + len(typed.split()) * float(pace) * 1.3)], check=True)
    r = subprocess.run([sys.executable, os.path.join(HERE, 'savecompare.py'), game, slot, out, saved])
    sys.exit(r.returncode)


if __name__ == '__main__':
    main(sys.argv[1:])
