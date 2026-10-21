#!/usr/bin/env python3
"""Check the links of the repository's Markdown files (spec/README.md, "Links").

Every relative link `[text](path#anchor)` must name a file that exists, and an anchor must match a
heading of the target as GitHub renders it (lower case, punctuation dropped, spaces to hyphens,
-1, -2 … for repeats). Obsidian-style `[[…]]` links are reported too: the spec uses plain Markdown
links only.

Usage: python3 tools/speclinks.py [files…]   (default: every tracked *.md file)
Exit status 1 when anything is broken.
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FENCE = re.compile(r'^\s*(```|~~~)')
HEADING = re.compile(r'^(#{1,6})\s+(.*?)\s*#*\s*$')
LINK = re.compile(r'(?<!!)\[((?:[^\[\]]|\[[^\]]*\])*)\]\(([^()\s]*(?:\([^()]*\)[^()\s]*)*)(?:\s+"[^"]*")?\)')
CODE_SPAN = re.compile(r'`+[^`]*`+')
WIKI = re.compile(r'\[\[(spec/[^\]]*|#[^\]]*)\]\]')


def slug(text):
    """GitHub's heading anchor: rendered text, lower-cased, punctuation removed, spaces → '-'."""
    text = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', text)  # a link renders as its text
    text = text.lower()
    text = re.sub(r'[^\w\- ]', '', text)
    return text.replace(' ', '-')


def lines_outside_fences(path):
    """Yield (line number, line) for lines not inside fenced code blocks."""
    fenced = False
    with open(path, encoding='utf-8') as f:
        for n, line in enumerate(f, 1):
            if FENCE.match(line):
                fenced = not fenced
                continue
            if not fenced:
                yield n, line.rstrip('\n')


_anchors = {}


def anchors(path):
    """The set of anchors a Markdown file offers (headings, with GitHub's -n suffixes)."""
    if path not in _anchors:
        seen, out = {}, set()
        for _, line in lines_outside_fences(path):
            m = HEADING.match(line)
            if not m:
                continue
            s = slug(m.group(2))
            if s in seen:
                seen[s] += 1
                out.add(f'{s}-{seen[s]}')
            else:
                seen[s] = 0
                out.add(s)
        _anchors[path] = out
    return _anchors[path]


def links(path):
    """Yield (line number, text, target) for every Markdown link outside code."""
    for n, line in lines_outside_fences(path):
        bare = CODE_SPAN.sub(lambda m: ' ' * len(m.group(0)), line)
        for m in LINK.finditer(bare):
            yield n, m.group(1), line[m.start(2):m.end(2)]


def check(path):
    errors = []
    rel = os.path.relpath(path, ROOT)
    for n, line in lines_outside_fences(path):
        bare = CODE_SPAN.sub('', line)
        for m in WIKI.finditer(bare):
            errors.append(f'{rel}:{n}: wikilink {m.group(0)}')
    for n, _, target in links(path):
        if re.match(r'^[a-z][a-z0-9+.-]*:', target) or target.startswith('//'):
            continue  # http:, https:, mailto: …
        file_part, hashmark, anchor = target.partition('#')
        if hashmark and not anchor:
            errors.append(f'{rel}:{n}: empty anchor: {target}')
            continue
        dest = os.path.normpath(os.path.join(os.path.dirname(path), file_part)) if file_part else path
        if not os.path.exists(dest):
            errors.append(f'{rel}:{n}: no such file: {target}')
            continue
        if anchor and dest.endswith('.md') and anchor not in anchors(dest):
            errors.append(f'{rel}:{n}: no heading #{anchor} in {os.path.relpath(dest, ROOT)}')
    return errors


def main(argv):
    if argv:
        files = [os.path.abspath(a) for a in argv]
    else:
        out = subprocess.run(['git', 'ls-files', '*.md'], cwd=ROOT, capture_output=True, text=True, check=True)
        files = [os.path.join(ROOT, f) for f in out.stdout.split()]
        files += [os.path.join(ROOT, f) for f in subprocess.run(
            ['git', 'ls-files', '--others', '--exclude-standard', '*.md'], cwd=ROOT,
            capture_output=True, text=True, check=True).stdout.split()]
    errors, count = [], 0
    for f in sorted(set(files)):
        if not os.path.exists(f):
            continue
        count += sum(1 for _ in links(f))
        errors += check(f)
    for e in errors:
        print(e)
    print(f'{len(files)} files, {count} links, {len(errors)} problems', file=sys.stderr)
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
