"""List every sound effect's bytecode (spec/A-games/engine/sound.md).
Usage: python3 sounddis.py <START.EXE | flat image>"""
import struct,sys,os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sound import load_image
img=load_image(sys.argv[1])
SEG=0x18AE0-0x10000
m=img[SEG:SEG+0x10000]
w=lambda a: struct.unpack_from('<H',m,a)[0]
FN={0:'dur',2:'ptr',4:'freq',6:'slide',8:'out',0xa:'vol',0xc:'vold',0xe:'tempo',0x10:'f10',0x12:'transp',0x14:'noteoff',0x16:'envp',0x18:'envi',0x1a:'envc',0x1c:'lfotab',0x1e:'lfoph',0x20:'lfoinc',0x22:'lfodep',0x24:'lfolen',0x26:'cnt26',0x28:'cnt28'}
def dis(p,seen):
    out=[]
    while p not in seen:
        seen.add(p); op=m[p]
        if op==0xff:
            f=m[p+1]; v=w(p+2); out.append(f'{p:04x}: FF set {FN.get(f,hex(f))}(+{f:02x}) = 0x{v:04x} ({v if v<0x8000 else v-0x10000})')
            p+=4
            if f==0:
                if v==0: out.append('      ^ end of channel'); break
        elif op==0xfe:
            f=m[p+1]; t=w(p+2); out.append(f'{p:04x}: FE loop {FN.get(f,hex(f))}(+{f:02x}) -> {t:04x}'); p+=4
        elif op==0xfd:
            o=w(p+1); out.append(f'{p:04x}: FD select+reset channel +0x{o:02x}'); p+=3
        elif op==0xfc:
            t=w(p+1); out.append(f'{p:04x}: FC call {t:04x}'); out+=['   '+x for x in dis(t,set())]; p+=3
        elif op==0xfb:
            out.append(f'{p:04x}: FB return'); break
        elif op==0xfa:
            out.append(f'{p:04x}: FA reset channel'); p+=1
        else:
            out.append(f'{p:04x}: NOTE {m[p]:02x} {m[p+1]:02x} {m[p+2]:02x}'); p+=3
            if m[p-2]&0x80==0:
                pass
    return out
for name,tab in (('PC',0x55f),('TANDY',0x607)):
    print('#####',name)
    for e in range(21):
        ptrs=[w(tab+e*8+c*2) for c in range(4)]
        print(f'== effect n={e+1} (e={e}) ptrs', ' '.join(f'{x:04x}' for x in ptrs))
        for c,pp in enumerate(ptrs):
            if pp in (0,0x0d2b,0x11bf) and e: continue
            print(f' -- ch{c}')
            for l in dis(pp,set()): print('   '+l)
