#!/usr/bin/env python3
"""The drawn 3D view of the original, in DOSBox, against the port's (spec/VALIDATION.md §4): from save A,
the view as loaded, after each of four left turns and after a step forward, both ways, pixel by pixel.

Usage:
  viewcheck.py por   POOLRAD_DIR [--moves MOVES] [--out DIR]
  viewcheck.py coab  CURSE_DIR   [--moves MOVES] [--out DIR]
  viewcheck.py sotsb BLADES_DIR  [--moves MOVES] [--out DIR]

--moves  a scripted walk instead of the turns: the port's exploration commands f (forward), l, r, b
         (turn around), one frame before the walk and one after each move. Choose a walk with no
         menus on the way (the headless runner's transcript shows them): the original is typed only
         the moves.

Needs what run.py needs (DOSBox Staging, NASM; $DOSBOX, $NASM) and Node for the headless runner.
Exits 1 if any frame differs.
"""
import json, os, subprocess, sys, tempfile

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
    'por': {'start': 'x enter l a', 'answers': [], 'args': 'STING', 'pace': '3'},
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
    steps, keys = STEPS, KEYS
    if '--moves' in a:
        moves = a[a.index('--moves') + 1]
        if not moves or set(moves) - ARROW.keys():
            raise SystemExit('--moves takes f, l, r and b')
        steps = [list(moves[:i]) for i in range(len(moves) + 1)]
        keys = ' '.join(['f12'] + [f'{ARROW[m]} f12' for m in moves])
    typed = ' '.join(filter(None, [g['start'], g.get('move'), keys]))
    subprocess.run([sys.executable, os.path.join(HERE, 'run.py'), '--game', folder, '--out', out,
                    '--keys', typed, '--wait', '6', '--pace', g['pace'], '--args', g['args'],
                    '--seconds', str(10 + len(typed.split()) * float(g['pace']) * 1.5)], check=True)
    bad = 0
    for i, commands in enumerate(steps):
        dump = os.path.join(out, f'FRAME{i:02d}.EGA')
        if not os.path.exists(dump):
            print(f'frame {i}: not grabbed (the original did not reach play; see {out}/*.png)')
            bad += 1
            continue
        script = os.path.join(out, f'port{i}.json')
        json.dump({'game': game, 'answers': g['answers'], 'commands': commands}, open(script, 'w'))
        port = os.path.join(out, f'port{i}.png')
        subprocess.run(['node', '--import', './headless/node-ts.mjs', 'headless/run.ts', '--files', folder,
                        '--script', script, '--frame', port], cwd=WEB, check=True, stdout=subprocess.DEVNULL)
        r = subprocess.run([sys.executable, os.path.join(HERE, 'egaframe.py'), dump, '--compare', port,
                            '--view', os.path.join(out, f'view{i}.png')])
        bad += r.returncode != 0
    print(f'{len(steps) - bad} of {len(steps)} frames equal; files in {out}')
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
