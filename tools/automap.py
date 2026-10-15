"""Annotated automap: every area's map with doors and events, plus what each event does.

For each ECL record: the map comes from the first LOAD_AREA in on_enter; events come from
the on_step dispatch (AND [0xC04F], #127 -> ON_GOTO). For each event the handler is walked
(following GOTO, not GOSUB) to collect its text and notable actions.

Usage: python3 automap.py <POOLRAD dir> <out.html>
Output contains game text and maps: keep it for personal use.
"""
import sys, os, html, glob
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ecl as E
import geo as G

NOTABLE = {'COMBAT': 'combat', 'LOAD_MONSTER': 'monsters', 'TREASURE': 'treasure',
           'NEW_ECL': 'exit', 'DAMAGE': 'trap/damage', 'ROB': 'robbery', 'ADD_NPC': 'NPC joins',
           'PROGRAM': 'special screen', 'ENCOUNTER_MENU': 'encounter', 'PARLAY': 'parlay'}
TEXT_OPS = ('PRINT', 'PRINT_CLEAR', 'VMENU', 'HMENU', 'ENCOUNTER_MENU')


def first(s, start, names, limit=40):
    pc = start
    for _ in range(limit):
        try:
            op, name, ops, npc = s.decode(pc)
        except Exception:
            return None
        if name in names:
            return pc, name, ops
        if name in ('EXIT', 'RETURN', 'NEW_ECL'):
            return None
        pc = ops[0].word if name == 'GOTO' else npc
    return None


def summarise(s, start, limit=120):
    """Bounded breadth-first walk from an event handler, following GOTO/GOSUB/ON_GOTO
    and treating EXIT/RETURN after an IF as conditional. Stops at NEW_ECL."""
    texts, tags, seen, queue, n = [], [], set(), [start], 0
    while queue and n < limit:
        pc = queue.pop(0); prev = None
        while pc not in seen and n < limit:
            seen.add(pc); n += 1
            try:
                op, name, ops, npc = s.decode(pc)
            except Exception:
                break
            if name in TEXT_OPS:
                for o in ops:
                    if o.kind == 0x80 and o.text and len(o.text) > 2 and o.text not in texts:
                        texts.append(o.text)
            if name in NOTABLE:
                tag = 'exit to area %s' % ops[0].value() if name == 'NEW_ECL' else NOTABLE[name]
                if tag not in tags:
                    tags.append(tag)
            if name in ('GOTO', 'GOSUB'):
                queue.append(ops[0].word)
            if name in ('ON_GOTO', 'ON_GOSUB'):
                queue += [o.word for o in ops[2:]]
            cond = prev is not None and 0x16 <= prev <= 0x1B
            if name in ('EXIT', 'RETURN', 'NEW_ECL', 'GOTO') and not cond:
                break
            prev = op; pc = npc
    return texts, tags


def area_info(s):
    v = s.vectors()
    la = first(s, v[4], ('LOAD_AREA',))
    geo_id = la[2][0].value() if la else None
    events = {}
    d = first(s, v[1], ('ON_GOTO',), limit=8)
    if d:
        targets = [o.word for o in d[2][2:]]
        for i, t in enumerate(targets):
            events[i] = summarise(s, t)
    title = ''
    for vec in (v[4], v[1]):
        t, _ = summarise(s, vec, 30)
        if t:
            title = t[0]; break
    return geo_id, events, title


def svg(m, events, cell=26):
    S = 16 * cell + 2
    o = ['<svg viewBox="0 0 %d %d" class="map">' % (S, S)]
    door = {0: 'wall', 1: 'pass', 2: 'locked', 3: 'locked2'}
    for y in range(16):
        for x in range(16):
            X, Y = 1 + x * cell, 1 + y * cell
            e = m.event(x, y) & 0x7F
            if e:
                texts, tags = events.get(e, ([], []))
                tip = 'event %d at (%d,%d)' % (e, x, y)
                if tags: tip += ' [' + ', '.join(tags) + ']'
                if texts: tip += '\n' + '\n'.join(texts[:4])
                cls = 'ev' + (' fight' if any(t in ('combat', 'monsters', 'encounter') for t in tags) else '') \
                      + (' exit' if any(t.startswith('exit') for t in tags) else '')
                o.append('<g class="%s"><title>%s</title><rect x="%d" y="%d" width="%d" height="%d"/>'
                         '<text x="%d" y="%d">%d</text></g>' % (cls, html.escape(tip), X, Y, cell, cell,
                                                                 X + cell // 2, Y + cell // 2 + 4, e))
            seg = {0: (X, Y, X + cell, Y), 1: (X + cell, Y, X + cell, Y + cell),
                   2: (X, Y + cell, X + cell, Y + cell), 3: (X, Y, X, Y + cell)}
            for d, (a, b, c, f) in seg.items():
                if m.wall(x, y, d):
                    o.append('<line class="%s" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (door[m.passage(x, y, d)], a, b, c, f))
    o.append('</svg>')
    return ''.join(o)


def build(root):
    out = []
    for path in sorted(glob.glob(os.path.join(root, 'ECL*.DAX'))):
        block = os.path.basename(path)[3]
        geos = G.load(os.path.join(root, 'GEO%s.DAX' % block))
        for rid, s in sorted(E.load(path).items()):
            geo_id, events, title = area_info(s)
            m = geos.get(geo_id if geo_id is not None else rid)
            out.append((block, rid, geo_id, title, m, events))
    return out


CSS = """
:root{--bg:#fbfaf7;--fg:#222;--muted:#666;--wall:#222;--pass:#3a9a3a;--locked:#c0392b;--ev:#f6e7a8;--fight:#f4b9a8;--exit:#b9d7f4;--card:#fff;--line:#ddd}
@media (prefers-color-scheme:dark){:root{--bg:#16181c;--fg:#e8e6e1;--muted:#9a9a9a;--wall:#e8e6e1;--ev:#5b5222;--fight:#6b3226;--exit:#24445f;--card:#1f2228;--line:#333}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.4 system-ui,sans-serif}
header{padding:16px;max-width:1200px;margin:auto}h1{font-size:20px;margin:0 0 4px}
.legend span{display:inline-block;margin-right:12px;color:var(--muted)}
main{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px;padding:0 16px 32px;max-width:1200px;margin:auto}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px}
.card h2{font-size:14px;margin:0 0 8px}.card p{margin:0 0 8px;color:var(--muted);font-size:12px}
svg.map{width:100%;height:auto}line{stroke-width:3;stroke-linecap:square}
.wall{stroke:var(--wall)}.pass{stroke:var(--pass);stroke-dasharray:4 3}.locked,.locked2{stroke:var(--locked)}
.ev rect{fill:var(--ev)}.fight rect{fill:var(--fight)}.exit rect{fill:var(--exit)}
.ev text{font-size:10px;text-anchor:middle;fill:var(--fg)}.ev:hover rect{stroke:var(--fg);stroke-width:2}
"""


def render(areas):
    cards = []
    for block, rid, geo_id, title, m, events in areas:
        head = 'Block %s · area %d' % (block, rid) + (' · map %s' % geo_id if geo_id is not None else ' · no map')
        body = svg(m, events) if m else '<p>No 3D map for this area (menu/wilderness area).</p>'
        cards.append('<section class="card"><h2>%s</h2><p>%s</p>%s</section>'
                     % (html.escape(head), html.escape(title[:120]), body))
    return ('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>Pool of Radiance Automap</title><style>%s</style></head><body><header><h1>Pool of Radiance automap</h1>'
            '<div class="legend"><span>yellow = event</span><span>red = combat/monsters</span><span>blue = exit</span>'
            '<span>green dashed = passable wall</span><span>red line = locked door</span></div>'
            '<p>Hover an event square for its text and actions.</p></header><main>%s</main></body></html>') % (CSS, ''.join(cards))


if __name__ == '__main__':
    areas = build(sys.argv[1])
    open(sys.argv[2], 'w').write(render(areas))
    print('%d areas, %d with maps, %d events' % (len(areas), sum(1 for a in areas if a[4]),
                                                  sum(len(a[5]) for a in areas)))
