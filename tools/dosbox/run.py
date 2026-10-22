#!/usr/bin/env python3
"""Run an original Gold Box game unattended in DOSBox Staging, typing keys into it, and keep the
screens grabbed with F12 and the saves it writes (tools/dosbox/README.md).

Usage:
  run.py --game DIR --keys "KEYS" --out DIR [--seconds N] [--wait S] [--pace S] [--args STING]
         [--patch FILE:OFFSET:HEX]… [--dosbox PATH] [--nasm PATH]

--game     the game folder (POOLRAD, CURSE, BLADES); it is copied, never changed
--keys     DOSBox's AUTOTYPE buttons, space-separated (`AUTOTYPE -list` names them), e.g.
           "x enter l a f12 up f12"; F12 makes GRAB.COM write the screen
--out      where FRAMEnn.EGA (with a .png of each), the changed files and dosbox.log go
--seconds  how long the game runs before DOSBox is stopped (default 60)
--wait     seconds before the first key (default 4); --pace seconds between keys (default 0.5)
--args     the game's command line (default STING: no title, as the developers ran it)
--patch    bytes to write into the copy first: file name, decimal or 0x offset, hex bytes
--dosbox   DOSBox Staging (default $DOSBOX, else `dosbox` on the path)
--nasm     NASM, to build GRAB.COM from grab.asm (default $NASM, else `nasm` on the path)
"""
import os, re, shutil, subprocess, sys, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def args(a):
    o = {'seconds': '60', 'wait': '4', 'pace': '0.5', 'args': 'STING', 'patch': []}
    i = 0
    while i < len(a):
        k = a[i]
        if not k.startswith('--') or i + 1 >= len(a):
            raise SystemExit(__doc__)
        if k == '--patch':
            o['patch'].append(a[i + 1])
        else:
            o[k[2:]] = a[i + 1]
        i += 2
    if not {'game', 'keys', 'out'} <= o.keys():
        raise SystemExit(__doc__)
    return o


def tool(given, env, name):
    p = given or os.environ.get(env) or shutil.which(name)
    if not p:
        raise SystemExit(f'{name} not found: pass --{name if name != "dosbox" else "dosbox"} or set ${env}')
    return p


def game_dir(src):
    """Where the game goes on C:, from the paths in its .CFG: PoR's lines name C:\\POOLRAD\\ (the
    folder goes there); CotAB's C:\\SAVE\\ is a folder inside the game's own (the game is C:\\)."""
    for cfg in (n for n in os.listdir(src) if n.upper().endswith('.CFG')):
        for line in open(os.path.join(src, cfg), 'rb').read().decode('latin-1').splitlines():
            m = re.fullmatch(r'[A-Za-z]:\\([^\\]+)\\', line.strip())
            if m and not os.path.isdir(os.path.join(src, m.group(1))):
                return m.group(1)
    return ''


def files(top):
    """Every file under top, by path relative to it, with its bytes."""
    return {os.path.relpath(os.path.join(r, n), top): open(os.path.join(r, n), 'rb').read()
            for r, _, names in os.walk(top) for n in names}


def main(a):
    o = args(a)
    dosbox = tool(o.get('dosbox'), 'DOSBOX', 'dosbox')
    nasm = tool(o.get('nasm'), 'NASM', 'nasm')
    out = os.path.abspath(o['out'])
    os.makedirs(out, exist_ok=True)
    work = tempfile.mkdtemp(prefix='goldbox-dosbox-')
    try:
        c = os.path.join(work, 'C')
        sub = game_dir(o['game'])
        dest = os.path.join(c, sub) if sub else c
        shutil.copytree(o['game'], dest)
        for p in o['patch']:
            name, off, hexb = p.split(':')
            with open(os.path.join(dest, name), 'r+b') as f:
                f.seek(int(off, 0))
                f.write(bytes.fromhex(hexb))
        before = files(dest)
        subprocess.run([nasm, '-f', 'bin', '-o', os.path.join(c, 'GRAB.COM'), os.path.join(HERE, 'grab.asm')], check=True)
        cd = f'cd \\{sub}\r\n' if sub else ''
        bat = (f'@echo off\r\nC:\\GRAB\r\n{cd}AUTOTYPE -w {o["wait"]} -p {o["pace"]} {o["keys"]}\r\n'
               f'START {o["args"]}\r\n')
        if len(bat) > 250:
            print(f'warning: RUN.BAT is {len(bat)} characters; DOS may cut a long AUTOTYPE line', file=sys.stderr)
        open(os.path.join(c, 'RUN.BAT'), 'w', newline='').write(bat)
        conf = os.path.join(work, 'run.conf')
        open(conf, 'w').write(f"""[sdl]
fullscreen = false
[dosbox]
machine = svga_s3
[mixer]
nosound = true
[speaker]
pcspeaker = false
[autoexec]
mount c "{c}"
c:
RUN.BAT
""")
        env = dict(os.environ, SDL_VIDEODRIVER='dummy', SDL_AUDIODRIVER='dummy')
        with open(os.path.join(out, 'dosbox.log'), 'wb') as log:
            try:
                subprocess.run([dosbox, '-conf', conf, '-noprimaryconf', '-nolocalconf'], env=env,
                               stdout=log, stderr=subprocess.STDOUT, timeout=float(o['seconds']))
            except subprocess.TimeoutExpired:
                pass
        frames = sorted(n for n in os.listdir(dest) if re.fullmatch(r'FRAME\d\d\.EGA', n.upper()))
        for n in frames:  # GRAB.COM writes to the game's current folder
            shutil.copy(os.path.join(dest, n), out)
            subprocess.run([sys.executable, os.path.join(HERE, 'egaframe.py'), os.path.join(out, n),
                            '--png', os.path.join(out, n[:-4] + '.png')], check=False)
        own = re.compile(r'(GRAB\.COM|RUN\.BAT|FRAME\d\d\.EGA)', re.I)
        changed = [n for n, data in files(dest).items() if not own.fullmatch(n) and before.get(n) != data]
        for n in changed:
            os.makedirs(os.path.dirname(os.path.join(out, n)) or out, exist_ok=True)
            shutil.copy(os.path.join(dest, n), os.path.join(out, n))
        print(f'{len(frames)} frame(s), {len(changed)} changed file(s) in {out}')
    finally:
        shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main(sys.argv[1:])
