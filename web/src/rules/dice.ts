// The dice source (spec/B-model/host-contracts.md §6, decision D2 in spec/README.md): every random draw
// that can change the game is a request (count, sides) answered with the sum of count dice of sides
// faces. A Turbo Pascal Random(n) of the original is the request (1, n) − 1. The sequence of requests
// and results of a run is its dice tape (§6.4).

/** The one operation of a dice source: the sum of `count` dice of `sides` faces (0 when either is 0). */
export interface Dice {
  roll(count: number, sides: number): number
}

/** Turbo Pascal `Random(n)` (PoR FUN_1af8_11c0) as the request (1, n) − 1; `Random(0)` is 0. */
export function random(d: Dice, n: number): number {
  const r = d.roll(1, n)
  return r > 0 ? r - 1 : 0
}

/**
 * The reference generator (informative, §6.3): a 32-bit xorshift (seed 0 becomes 1), u = s / 2³²;
 * a request draws `count` values ⌊u · sides⌋ + 1 (also when sides is 0, then answered 0).
 */
export function generator(seed = Date.now()): Dice {
  let s = seed >>> 0 || 1
  const next = () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0
    return s / 4294967296
  }
  return {
    roll(count: number, sides: number) {
      let t = 0
      for (let i = 0; i < count; i++) t += Math.floor(next() * sides) + 1
      return sides ? t : 0
    },
  }
}
