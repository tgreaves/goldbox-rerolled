# Rendering

> **Status: stub, to be written** (work-plan step 4, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

How the port draws the game's art: whole-pixel enlargement, the rope frames, the game font as a TrueType font, combat icons, the EGA palette tokens.

## Will contain

- the 4× whole-pixel enlargement and which images it applies to (IMP-047)
- frames built from `8X8D1` #202 (IMP-051), the "most common tile" rule
- the font built from `8X8D1` #201: outline rule, metrics, character map (IMP-038)
- palette tokens

## Sources to fold in

- `web/src/render/upscale.ts`, `web/src/ui/frames.ts`, `web/src/data/ttf.ts`, `web/src/games/frametiles.ts`
