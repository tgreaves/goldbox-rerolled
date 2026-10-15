# Improvements over the original

Every deliberate departure from the 1988 DOS game goes here, so the port's behaviour can always be traced back to the original described in [`spec/`](spec/README.md).

- **Status**: planned, in progress, done
- **Toggle**: whether a setting restores the original behaviour (needed for anything that changes gameplay or difficulty)

| ID | Area | Improvement | Original behaviour | Toggle | Status |
|---|---|---|---|---|---|
| IMP-001 | Exploration | Real 3D view rendered from the GEO maps, with smooth movement and turning | 88×88 view assembled from pre-drawn 8×8 tiles ([`spec/maps.md`](spec/maps.md)) | Classic view later, once its spec gap is closed | planned |
| IMP-002 | Saving | Save anywhere, plus quicksave | Saving only from the camp menu and the party screen ([`spec/camp.md`](spec/camp.md)) | Yes (changes difficulty) | planned |
| IMP-003 | Interface | Mouse and touch for every menu and screen | Keyboard only ([`spec/graphics.md`](spec/graphics.md), menu input loop) | No | planned |
| IMP-004 | Interface | Responsive layout from phone to desktop | Fixed 320×200 screen | No | planned |
| IMP-005 | Platform | Runs offline as an installable web app or a single file | DOS executable | No | planned |
| IMP-006 | Saving | Saves exported and imported as original `SAVGAM*.DAT` files | Files in the game folder | No | planned |
