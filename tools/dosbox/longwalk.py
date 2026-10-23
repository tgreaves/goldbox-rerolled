#!/usr/bin/env python3
"""A PoR walk too long for one AUTOTYPE line, run as pieces of viewcheck.py --save-to (tools/dosbox/README.md, "Long PoR walks,
saves compared"): each piece starts from the slot the last one saved, in a copy of the game folder
holding the original's own save, so the port loads the original's files too.

Usage:
  longwalk.py POOLRAD_DIR MOVES [--piece N] [--save X] [--out DIR]

--piece  moves per piece (default 18, about what one line takes with a P and a frame after each move)
--save   the slot the first piece starts from (default A); the pieces save in the slots after it
Needs what viewcheck.py needs. Exits 1 if any frame or save differs (a save that differs is reported
and the walk goes on from the original's).
"""
import os, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SLOTS = 'abcdefghij'


def main(a):
    if len(a) < 2:
        raise SystemExit(__doc__)
    folder, walk = os.path.abspath(a[0]), a[1]
    opt = lambda k, d: a[a.index(k) + 1] if k in a else d
    piece, load = int(opt('--piece', '18')), opt("--save", "a").lower()
    out = os.path.abspath(opt('--out', tempfile.mkdtemp(prefix='longwalk-')))
    os.makedirs(out, exist_ok=True)
    prev, bad = None, 0
    for k, i in enumerate(range(0, len(walk), piece)):
        save = SLOTS[(SLOTS.index(load) + 1) % len(SLOTS)]
        copy = os.path.join(out, f'game{k}')
        shutil.rmtree(copy, ignore_errors=True)
        shutil.copytree(folder, copy)
        for n in os.listdir(prev) if prev else []:
            if n.upper().startswith(('SAVGAM', 'CHRDAT')):
                shutil.copy(os.path.join(prev, n), copy)
        run = os.path.join(out, f'piece{k}')
        r = subprocess.run([sys.executable, os.path.join(HERE, 'viewcheck.py'), 'por', copy, '--moves', walk[i:i + piece],
                            '--save', load, '--save-to', save, '--out', run], capture_output=True, text=True)
        shutil.rmtree(copy, ignore_errors=True)
        said = [l for l in r.stdout.splitlines() if 'frames equal' in l or 'differ' in l and ' 0 of ' not in l or 'saves equal' in l]
        print(f'piece {k}: moves {i + 1}-{min(i + piece, len(walk))}, slot {load.upper()} to {save.upper()}', flush=True)
        for l in said:
            print('   ', l, flush=True)
        bad += r.returncode != 0
        if not os.path.exists(os.path.join(run, f'SAVGAM{save.upper()}.DAT')):
            print('    the original wrote no save: stopped')
            break
        load, prev = save, run
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
