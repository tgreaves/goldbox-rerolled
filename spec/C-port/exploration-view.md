# Exploration view

> **Status: stub, to be written** (work-plan step 4, [AUDIT.md](../AUDIT.md) §8). Normative once written.
> Part of the [specification](../README.md).

The view while exploring. Per D6 the original's drawn view ([engine/maps-and-view.md](../A-games/engine/maps-and-view.md)) is the normative conformance target, pixel-exact; the port's WebGL view is an optional enhancement checked within a tolerance.

## Will contain

- the original view as a conformance target (88 × 88 pixels per position, facing and time)
- the WebGL view as built: camera (field of view, eye height, camera set back), wall height, fog, light, sprites and their placement, slides and glides, the floor and sky dressing (IMP-001, 007, 011, 020, 021, 066, 069)
- the wilderness view (IMP-026), the area map and its landmarks (IMP-022, 024)

## Sources to fold in

- `web/src/render/world.ts`, `web/src/games/view.ts`, `web/src/ui/areamap.ts`, `web/src/rules/landmarks.ts`
