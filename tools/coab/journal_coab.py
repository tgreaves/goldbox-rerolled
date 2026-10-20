"""Build Curse of the Azure Bonds' journal data from the Gold Box Wiki (Fandom, CC BY-SA).

The wiki page transcribes the Adventurer's Journal printed with the game, as an 80-column text with
page markers and picture placeholders. This keeps the journal text: the opening entry, the background
notes (geography, power groups, bestiary, the bard's notes on Phlan), journal entries 1-59 and tavern
tales 1-62; the rules appendices are left out (the game's own rules are in the port's Rules reference).
Hard-wrapped lines are joined into paragraphs, and the few apostrophes the transcription lost are put
back (and the bestiary's monster levels, read as Vl / Vll). Entries that are only a picture in the printed journal say so.

Usage: python3 journal_coab.py <out.json> [saved page wikitext]
"""
import json, re, sys, urllib.request

TITLE = 'Curse_of_the_Azure_Bonds/Journal'
PAGE = 'https://goldbox.fandom.com/wiki/' + TITLE
API = ('https://goldbox.fandom.com/api.php?action=query&prop=revisions&rvprop=content&rvslots=main'
       '&format=json&titles=' + TITLE)

# background sections: heading line(s) in the source -> title shown
BACKGROUND = [
    ('IMPORTANT DALELANDS GEOGRAPHIC REFERENCES', 'Important Dalelands geographic references'),
    ("IMPORTANT DALELAND'S", "Important Dalelands power groups"),
    ('A DALELARDS BESTIARY', 'A Dalelands bestiary'),
    ("A BARD'S NOTES ON PHLAN AND THE POOL OF RADIANCE", "A bard's notes on Phlan and the Pool of Radiance"),
]
# apostrophes the transcription dropped
APOSTROPHES = [(r"\bI m\b", "I'm"), (r"\b([Tt]hey|[Yy]ou|[Ww]e|monsters) re\b", r"\1're"),
               (r"\b([Tt]hey) d\b", r"\1'd"), (r"\b([Ww]e) ve\b", r"\1've"), (r"\bI ll\b", "I'll"),
               (r"\bvessel s\b", "vessel's"),
               # the bestiary's monster levels, OCR'd with a lower-case L for I
               (r"\bVll\b", "VII"), (r"\bVl\b", "VI")]
PICTURE = 'A picture in the printed journal (not transcribed at the source).'


def fetch() -> str:
    req = urllib.request.Request(API, headers={'User-Agent': 'GoldBoxRerolled journal import'})
    d = json.load(urllib.request.urlopen(req))
    page = next(iter(d['query']['pages'].values()))
    return page['revisions'][0]['slots']['main']['*']


def paragraphs(lines: list[str]) -> str:
    """Join hard-wrapped lines: a blank line, or a short line ending a sentence, ends a paragraph."""
    out, cur = [], []
    for ln in lines:
        s = ln.strip()
        if not s:
            if cur: out.append(' '.join(cur)); cur = []
            continue
        cur.append(s)
        if len(ln.rstrip()) < 66 and re.search(r'[.!?:"\')]$', s):
            out.append(' '.join(cur)); cur = []
    if cur: out.append(' '.join(cur))
    text = '\n\n'.join(re.sub(r'\s{2,}', ' ', p) for p in out)
    for a, b in APOSTROPHES:
        text = re.sub(a, b, text)
    return text


def build(src: str) -> dict:
    lines = src.split('\n')
    # drop page markers and pictures; a picture standing for an entry becomes that entry
    clean, pictures = [], {}
    for ln in lines:
        if re.fullmatch(r'\s*--\s*(Page )?\d+\s*--\s*', ln): continue
        m = re.match(r'<<G:[^:]+:"\[GRAPHIC: (.*)\]">>', ln.strip())
        if m:
            e = re.fullmatch(r'JOURNAL ENTRY (\d+)', m.group(1))
            if e: pictures[int(e.group(1))] = len(clean)
            clean.append('')
            continue
        clean.append(ln)
    end = next(i for i, l in enumerate(clean) if l.strip() == 'APPENDICES')
    tales_at = next(i for i, l in enumerate(clean) if l.strip() == 'TAVERN TALES')
    entries_at = next(i for i, l in enumerate(clean) if l.strip() == 'JOURNAL ENTRIES')
    starts = [(i, l.strip()) for i, l in enumerate(clean)]

    def section(a: int, b: int) -> list[str]:
        return clean[a:b]

    # the opening entry runs from JOURNAL ENTRY 1 to the first background heading
    bg_at = [next(i for i, l in starts if l == h) for h, _ in BACKGROUND]
    e1 = next(i for i, l in starts if l == 'JOURNAL ENTRY 1')
    journal = {1: paragraphs(section(e1 + 1, bg_at[0]))}
    background = []
    for k, (head, title) in enumerate(BACKGROUND):
        a = bg_at[k] + 1
        if head == "IMPORTANT DALELAND'S": a += 1  # its second line, POWER GROUPS
        b = bg_at[k + 1] if k + 1 < len(bg_at) else entries_at
        background.append({'title': title, 'text': paragraphs(section(a, b))})

    heads = [(i, int(m.group(1))) for i, l in starts[entries_at:tales_at]
             if (m := re.fullmatch(r'JOURNAL (?:ENTRY )?(\d+)', l))]
    marks = sorted(heads + [(i, n) for n, i in pictures.items()])
    for k, (i, n) in enumerate(marks):
        b = marks[k + 1][0] if k + 1 < len(marks) else tales_at
        journal[n] = PICTURE if n in pictures and (i, n) not in heads else paragraphs(section(i + 1, b))

    # one heading lost its number (26, between 25 and 27): it takes the next one
    tale_heads = []
    for i, l in starts[tales_at + 1:end]:
        if m := re.fullmatch(r'Tavern Tale ?(\d*)', l):
            tale_heads.append((i, int(m.group(1)) if m.group(1) else tale_heads[-1][1] + 1))
    tales = []
    for k, (i, n) in enumerate(tale_heads):
        b = tale_heads[k + 1][0] if k + 1 < len(tale_heads) else end
        tales.append({'n': n, 'text': paragraphs(section(i + 1, b))})

    return {
        'source': {
            'name': 'Gold Box Wiki',
            'note': "Text from the Gold Box Wiki (Fandom), transcribing the Adventurer's Journal printed with the game. "
                    'Licensed CC BY-SA 3.0. The journal text only (the rules appendices are left out); lines joined into '
                    'paragraphs and a few lost apostrophes restored by tools/coab/journal_coab.py.',
            'journal': PAGE, 'tales': PAGE, 'background': PAGE,
            'license': 'https://creativecommons.org/licenses/by-sa/3.0/',
        },
        'preface': '',
        'proclamations': [],
        'journal': [{'n': n, 'text': journal[n], 'images': []} for n in sorted(journal)],
        'tales': tales,
        'background': background,
    }


if __name__ == '__main__':
    src = open(sys.argv[2]).read() if len(sys.argv) > 2 else fetch()
    data = build(src)
    with open(sys.argv[1], 'w') as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
        f.write('\n')
    print(len(data['journal']), 'entries', len(data['tales']), 'tales', len(data['background']), 'background sections')
