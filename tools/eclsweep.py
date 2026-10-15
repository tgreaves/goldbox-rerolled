"""Run every area's scripts on every square and facing, headless.

For each ECL record in each block: start from the shipped save's party, enter
the area (on_enter), then for every square and facing run on_move and on_step
from that post-entry state, answering menus at random (or with a fixed option).
Reports interpreter failures (hangs, runaway loops, divide by zero, missing
records) and the variables each area touches.

Usage: python3 eclsweep.py <game_dir> [--block N] [--area N] [--answer N]
(without --answer, menus are answered at random)
"""
import sys, os, copy, glob, collections, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dax import read_dax
from eclvm import Game, Stub, Hang, BASE, CODE_END


class Quiet(Stub):
    """No output; menus get `answer`, or a random option when answer is None."""

    def __init__(self, answer=None, seed=7):
        super().__init__()
        self.answer, self.events = answer, collections.Counter()
        self.rng = __import__('random').Random(seed)

    def out(self, s):
        pass

    def _next(self, default):
        return self.answer if self.answer is not None else self.rng.randrange(8)

    def choose(self, prompt, options):
        if self.answer is None and options:
            return self.rng.randrange(len(options))
        return super().choose(prompt, options)

    def engine(self, what, **kw):
        self.events[what] += 1


def areas(game_dir, block):
    b, base, ents = read_dax(os.path.join(game_dir, 'ECL%d.DAX' % block))
    return [r for r, *_ in ents]


def sweep_area(game_dir, block, area, answer=None):
    g = Game(game_dir, Quiet(answer))
    g.load_save('A')
    g.block, g.area = block, area
    g.load_ecl(area)
    g.reset_vm()
    errors = collections.Counter()
    try:
        g.enter()
    except Exception as e:
        errors['on_enter: %s: %s' % (type(e).__name__, e)] += 1
        return g, errors, 0
    base = copy.deepcopy(g)
    runs = 0
    for y in range(16):
        for x in range(16):
            for f in range(4):
                t = copy.deepcopy(base)
                t.x, t.y, t.facing2 = x, y, f * 2
                t.access, t.io.events = collections.Counter(), collections.Counter()
                runs += 1
                try:
                    t.command('f')
                except (Hang, RuntimeError, ZeroDivisionError, IndexError, KeyError) as e:
                    errors['%s: %s' % (type(e).__name__, str(e).split(' at ')[0])] += 1
                g.access.update(t.access)
                g.io.events.update(t.io.events)
    return g, errors, runs


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('game_dir')
    ap.add_argument('--block', type=int)
    ap.add_argument('--area', type=int)
    ap.add_argument('--answer', type=int)
    a = ap.parse_args()
    total = collections.Counter()
    touched = collections.defaultdict(set)
    for block in ([a.block] if a.block else range(1, 9)):
        for area in areas(a.game_dir, block):
            if a.area is not None and area != a.area:
                continue
            g, errors, runs = sweep_area(a.game_dir, block, area, a.answer)
            ev = ', '.join('%s %d' % kv for kv in g.io.events.most_common(6))
            print('block %d area %2d: %4d runs, %d errors; %s' % (block, area, runs, sum(errors.values()), ev))
            for e, n in errors.most_common(5):
                print('    %5d  %s' % (n, e))
            total.update(errors)
            for (rw, ad), n in g.access.items():
                if not BASE <= ad < CODE_END:
                    touched[ad].add((block, area, rw))
    print('== errors over all areas')
    for e, n in total.most_common():
        print('  %6d  %s' % (n, e))
    print('== addresses touched outside the code buffer, by number of areas')
    for ad in sorted(touched):
        n = len({(b, ar) for b, ar, _ in touched[ad]})
        rw = ''.join(sorted({r for *_, r in touched[ad]}))
        print('  %04X %-2s %d' % (ad, rw, n))


if __name__ == '__main__':
    main()
