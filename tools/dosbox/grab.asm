; GRAB.COM: a resident screen grabber for checking the original games in DOSBox
; (tools/dosbox/README.md). Run it before the game; each F12 then writes the screen on show to
; FRAME00.EGA, FRAME01.EGA, … in the current directory, as soon as DOS can be called.
;
; File layout (read by egaframe.py):
;   0   'GRAB'
;   4   u8  BIOS video mode (0040:0049)
;   5   u16 CRTC start address (the page on show; registers 0Ch/0Dh)
;   7   u8  CRTC offset (register 13h: words per line)
;   8   8 bytes reserved (0)
;   16  4 × 8000 bytes: planes 0–3 from the start address (320 × 200, 40 bytes a line)
;   32016  16 bytes: attribute controller palette registers 0–15
;   32032  768 bytes: VGA DAC, 256 × (r, g, b), 6 bits each
;
; F12 itself is swallowed, so the game never sees it. The dump runs at the next keyboard call
; (INT 16h), timer tick or DOS idle call when InDOS allows (the games take the timer for their sound); the Graphics Controller's index, read map and mode are restored.
;
; Build: nasm -f bin -o GRAB.COM grab.asm

        cpu 386
        org 100h

start:  jmp install

old08   dd 0
old09   dd 0
old28   dd 0
old16   dd 0
indos   dd 0                    ; far pointer to DOS's InDOS flag
pending db 0
busy    db 0
mypsp   dw 0
oldpsp  dw 0
handle  dw 0
fname   db 'FRAME00.EGA', 0
header  db 'GRAB'
hmode   db 0
hstart  dw 0
hoffset db 0
        times 8 db 0
attr    times 16 db 0
dac     times 768 db 0

; keyboard: F12 (make 58h, break D8h) sets the request and goes no further
int09:  push ax
        in al, 60h
        cmp al, 58h
        je .f12
        cmp al, 0D8h
        je .eat
        pop ax
        jmp far [cs:old09]
.f12:   mov byte [cs:pending], 1
.eat:   in al, 61h              ; acknowledge the keyboard as the BIOS does
        mov ah, al
        or al, 80h
        out 61h, al
        mov al, ah
        out 61h, al
        mov al, 20h
        out 20h, al
        pop ax
        iret

int08:  pushf
        call far [cs:old08]     ; the BIOS tick first (and its end of interrupt)
        push ax
        xor al, al              ; from the timer only with InDOS 0
        call try
        pop ax
        iret

int28:  pushf
        call far [cs:old28]
        push ax
        mov al, 1               ; DOS waiting for a key calls INT 28h with InDOS 1: safe then
        call try
        pop ax
        iret

int16:  push ax                  ; the game asking for a key: a clean point, if DOS is free
        xor al, al
        call try
        pop ax
        jmp far [cs:old16]

; dump if asked, not already dumping and InDOS is at most AL
try:    cmp byte [cs:pending], 0
        je .out
        cmp byte [cs:busy], 0
        jne .out
        push ds
        push bx
        lds bx, [cs:indos]
        cmp [bx], al
        pop bx
        pop ds
        ja .out
        mov byte [cs:busy], 1
        sti
        pusha
        push ds
        push es
        call dump
        pop es
        pop ds
        popa
        cli
        mov byte [cs:pending], 0
        mov byte [cs:busy], 0
.out:   ret

dump:   push cs
        pop ds
        mov ah, 51h             ; files belong to this program's PSP while it writes
        int 21h
        mov [oldpsp], bx
        mov bx, [mypsp]
        mov ah, 50h
        int 21h

        push 40h
        pop es
        mov al, [es:49h]
        mov [hmode], al
        mov dx, 3D4h
        mov al, 0Ch
        out dx, al
        inc dx
        in al, dx
        mov ah, al
        dec dx
        mov al, 0Dh
        out dx, al
        inc dx
        in al, dx
        mov [hstart], ax
        dec dx
        mov al, 13h
        out dx, al
        inc dx
        in al, dx
        mov [hoffset], al

        ; palette: attribute registers 0–15 (the flip-flop reset before each index), then the DAC
        mov di, attr
        xor cx, cx
.attr:  mov dx, 3DAh
        in al, dx
        mov dx, 3C0h
        mov al, cl
        out dx, al
        inc dx
        in al, dx
        mov [di], al
        inc di
        inc cx
        cmp cx, 16
        jb .attr
        mov dx, 3DAh
        in al, dx
        mov dx, 3C0h
        mov al, 20h             ; video back on
        out dx, al
        mov dx, 3C7h
        xor al, al
        out dx, al
        mov dx, 3C9h
        mov di, dac
        mov cx, 768
.dac:   in al, dx
        mov [di], al
        inc di
        loop .dac

        mov ah, 3Ch
        xor cx, cx
        mov dx, fname
        int 21h
        jc .done
        mov [handle], ax
        mov bx, ax
        mov ah, 40h
        mov cx, 16
        mov dx, header
        int 21h

        ; the four planes through the Graphics Controller's read map, read mode 0
        mov dx, 3CEh
        in al, dx
        push ax                 ; its index
        mov al, 4
        out dx, al
        inc dx
        in al, dx
        push ax                 ; read map
        dec dx
        mov al, 5
        out dx, al
        inc dx
        in al, dx
        push ax                 ; mode
        and al, 0F7h
        out dx, al
        xor si, si
.plane: mov dx, 3CEh
        mov al, 4
        out dx, al
        inc dx
        mov ax, si
        out dx, al
        mov dx, [cs:hstart]
        mov bx, [cs:handle]
        mov cx, 8000
        push ds
        push 0A000h
        pop ds
        mov ah, 40h
        int 21h
        pop ds
        inc si
        cmp si, 4
        jb .plane
        mov dx, 3CEh
        mov al, 5
        out dx, al
        inc dx
        pop ax
        out dx, al
        dec dx
        mov al, 4
        out dx, al
        inc dx
        pop ax
        out dx, al
        dec dx
        pop ax
        out dx, al

        mov bx, [handle]
        mov ah, 40h
        mov cx, 16 + 768
        mov dx, attr
        int 21h
        mov ah, 3Eh
        int 21h

        inc byte [fname + 6]    ; FRAME00 → FRAME01 … FRAME99
        cmp byte [fname + 6], '9'
        jbe .done
        mov byte [fname + 6], '0'
        inc byte [fname + 5]
.done:  mov bx, [oldpsp]
        mov ah, 50h
        int 21h
        ret

resident_end:

install:
        mov [mypsp], cs
        mov ah, 34h
        int 21h
        mov [indos], bx
        mov [indos + 2], es
        mov ax, 3508h
        int 21h
        mov [old08], bx
        mov [old08 + 2], es
        mov ax, 3509h
        int 21h
        mov [old09], bx
        mov [old09 + 2], es
        mov ax, 3528h
        int 21h
        mov [old28], bx
        mov [old28 + 2], es
        mov ax, 3516h
        int 21h
        mov [old16], bx
        mov [old16 + 2], es
        mov ax, 2508h
        mov dx, int08
        int 21h
        mov ax, 2509h
        mov dx, int09
        int 21h
        mov ax, 2528h
        mov dx, int28
        int 21h
        mov ax, 2516h
        mov dx, int16
        int 21h
        mov ah, 9
        mov dx, msg
        int 21h
        mov es, [2Ch]           ; the environment is not needed
        mov ah, 49h
        int 21h
        mov dx, (resident_end - start + 100h + 15) / 16
        mov ax, 3100h
        int 21h

msg     db 'GRAB: F12 writes FRAMEnn.EGA', 13, 10, '$'
