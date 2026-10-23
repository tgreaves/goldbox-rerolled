#!/usr/bin/env python3
"""The drawn 3D view of the original, in DOSBox, against the port's (spec/VALIDATION.md §4): from save A,
the view as loaded, after each of four left turns and after a step forward, both ways, pixel by pixel.

Usage:
  viewcheck.py por   POOLRAD_DIR [--moves MOVES] [--save X] [--save-to Y] [--out DIR]
  viewcheck.py coab  CURSE_DIR   [--moves MOVES] [--save X] [--out DIR]
  viewcheck.py sotsb BLADES_DIR  [--moves MOVES] [--out DIR]
  … [--start KEYS --answers N]

--moves  a scripted walk instead of the turns: the port's exploration commands f (forward), l, r, b
         (turn around), one frame before the walk and one after each move; e answers a menu the move
         brought up ("PRESS BUTTON OR RETURN" after a square's text: the port answers 0), typed to the
         original as P, that menu's key, before the move's frame, with one P more after every move
         (P does nothing at the main menu, where Enter would choose Area, so a pause the original's
         dice give and the port's do not, as a square's random rumour, cannot shift the walk). The
         headless runner's transcript shows which menus a walk meets.
--start  the keys from DOS to free play instead of the game's (with --answers, how many "press Enter"
         menus the port is answered), for a folder whose save A is past the opening: SotSB's opening
         takes most of the 250 characters DOSBox's typed line allows, and a save written after it (the
         original's own or the port's) leaves the line to the moves
--save   start from save X (B-J) instead of A (PoR and CotAB; a copy of the folder holds it)
--save-to  (PoR) after the walk, camp and save in slot Y in both (the original: Encamp, Save, Y, not
         quitting; the port: the same walk, Encamp and the headless runner's --save), then compare the
         two saves with savecompare.py. A walk saved in Y goes on from it with --save Y in a copy of
         the folder holding the original's save (longwalk.py), the port then loading the original's own.

Needs what run.py needs (DOSBox Staging, NASM; $DOSBOX, $NASM) and Node for the headless runner.
Exits 1 if any frame differs.
"""
import json, os, re, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(HERE, '..', '..', 'web')

# Keys from DOS to free play with save A loaded, and the port's answers for the same screens.
# PoR: STING skips the title; this release takes any code word; Load and A start play.
# CotAB: STING skips the title; Play; this release takes any character but the right one at the
# code wheel ('#' is never right, spec/A-games/coab/assets.md §7); Load, A, Begin, then two
# "press Enter" screens of the opening.
# SotSB: Hoop skips the title (its STING); Play; no code wheel. Its party screen is a list moved with
# the arrows (Load is the third row; after loading, Begin is five rows below the highlight). Save A
# is the game's start: nine "press Enter" screens, the treasure left (Exit, No), three more. Keys typed
# while it is busy are flushed, so it is typed slower. The port's treasure screen resolves at once, so
# its answers are the eleven "press Enter" menus alone. Its arrows move only in Move (M), so the turns are
# typed there (spec/A-games/sotsb/README.md, "The main menu").
ENTERS = lambda n: ' '.join(['enter'] * n)
GAMES = {
    'por': {'start': 'x enter l a', 'answers': [], 'args': 'STING', 'pace': '3', 'saveTo': 'e s {slot} n'},
    'coab': {'start': 'p numbersign enter l a b enter enter', 'answers': [0, 0], 'args': 'STING', 'pace': '3'},
    'sotsb': {'start': f'p down down enter enter {ENTERS(5).replace("enter", "down")} enter {ENTERS(9)} e n {ENTERS(3)}',
              'answers': [0] * 11, 'args': 'Hoop', 'pace': '5', 'move': 'm'},
}
STEPS = [[], ['l'], ['l', 'l'], ['l', 'l', 'l'], ['l', 'l', 'l', 'l', 'f']]
KEYS = 'f12 left f12 left f12 left f12 left up f12'
ARROW = {'f': 'up', 'l': 'left', 'r': 'right', 'b': 'down'}


def main(a):
    if len(a) < 2 or a[0] not in GAMES:
        raise SystemExit(__doc__)
    game, folder = a[0], os.path.abspath(a[1])
    out = os.path.abspath(a[a.index('--out') + 1]) if '--out' in a else tempfile.mkdtemp(prefix='viewcheck-')
    g = GAMES[game]
    start, answers = g['start'], list(g['answers'])
    if '--save' in a:
        x = a[a.index('--save') + 1].lower()
        if game == 'sotsb' or len(x) != 1 or x not in 'abcdefghij':
            raise SystemExit('--save takes a slot A-J, for por and coab')
        if x != 'a':  # a save past the opening: no "press Enter" screens (CotAB), Begin after the load
            start, answers = {'por': f'x enter l {x}', 'coab': f'p numbersign enter l {x} b'}[game], []
    if '--start' in a:
        start = a[a.index('--start') + 1]
        answers = [0] * int(a[a.index('--answers') + 1]) if '--answers' in a else []
    steps, keys = [(st, 0) for st in STEPS], KEYS
    if '--moves' in a:
        moves = a[a.index('--moves') + 1]
        if not moves or set(moves) - ARROW.keys() - {'e'} or moves[0] == 'e':
            raise SystemExit('--moves takes f, l, r, b, and e after a move')
        groups = re.findall(r'[flrb]e*', moves)
        steps = [([m[0] for m in groups[:i]], sum(len(m) - 1 for m in groups[:i])) for i in range(len(groups) + 1)]
        keys = ' '.join(['f12'] + [' '.join([ARROW[m[0]]] + ['p'] * len(m) + ['f12']) for m in groups])
    to = a[a.index('--save-to') + 1].lower() if '--save-to' in a else None
    if to and (len(to) != 1 or to not in 'abcdefghij' or 'saveTo' not in g):
        raise SystemExit('--save-to takes a slot A-J, for por')
    typed = ' '.join(filter(None, [start, g.get('move'), keys, g['saveTo'].replace('{slot}', to) if to else None]))
    subprocess.run([sys.executable, os.path.join(HERE, 'run.py'), '--game', folder, '--out', out,
                    '--keys', typed, '--wait', '6', '--pace', g['pace'], '--args', g['args'],
                    '--seconds', str(10 + len(typed.split()) * float(g['pace']) * 1.5)], check=True)
    bad = 0
    for i, (commands, enters) in enumerate(steps):
        dump = os.path.join(out, f'FRAME{i:02d}.EGA')
        if not os.path.exists(dump):
            print(f'frame {i}: not grabbed (the original did not reach play; see {out}/*.png)')
            bad += 1
            continue
        script = os.path.join(out, f'port{i}.json')
        json.dump({'game': game, 'save': a[a.index('--save') + 1].upper() if '--save' in a else 'A',
                   'answers': answers + [0] * enters, 'commands': commands}, open(script, 'w'))
        port = os.path.join(out, f'port{i}.png')
        subprocess.run(['node', '--import', './headless/node-ts.mjs', 'headless/run.ts', '--files', folder,
                        '--script', script, '--frame', port], cwd=WEB, check=True, stdout=subprocess.DEVNULL)
        r = subprocess.run([sys.executable, os.path.join(HERE, 'egaframe.py'), dump, '--compare', port,
                            '--view', os.path.join(out, f'view{i}.png')])
        bad += r.returncode != 0
    print(f'{len(steps) - bad} of {len(steps)} frames equal; files in {out}')
    if to:
        commands, enters = steps[-1]
        script = os.path.join(out, 'portsave.json')
        json.dump({'game': game, 'save': a[a.index('--save') + 1].upper() if '--save' in a else 'A',
                   'answers': answers + [0] * enters, 'commands': commands + ['e']}, open(script, 'w'))
        saved = os.path.join(out, 'port-save')
        subprocess.run(['node', '--import', './headless/node-ts.mjs', 'headless/run.ts', '--files', folder,
                        '--script', script, '--save', saved, '--slot', to.upper()], cwd=WEB, check=True, stdout=subprocess.DEVNULL)
        r = subprocess.run([sys.executable, os.path.join(HERE, 'savecompare.py'), game, to, out, saved])
        bad += r.returncode != 0
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
