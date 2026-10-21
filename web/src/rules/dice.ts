// The dice source (spec/B-model/host-contracts.md §6, decision D2 in spec/README.md): every random draw
// that can change the game is a request (count, sides) answered with the sum of count dice of sides
// faces. A Turbo Pascal Random(n) of the original is the request (1, n) − 1. The sequence of requests
// and results of a run is its dice tape (§6.4): TapeRecorder writes one, TapePlayer replays one.

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

/** One tape entry: [count, sides, result]. */
export type Draw = [number, number, number]

/** A recorded dice tape (§6.4). */
export interface Tape {
  format: 'goldbox-dice-tape'
  version: 1
  /** the game profile's id */
  game: string
  draws: Draw[]
}

export const TAPE_FORMAT = 'goldbox-dice-tape'

/** Recording: answers from `inner` and appends each request and its answer. */
export class TapeRecorder implements Dice {
  readonly draws: Draw[] = []
  private readonly inner: Dice
  readonly game: string
  constructor(inner: Dice, game: string) { this.inner = inner; this.game = game }
  roll(count: number, sides: number) {
    const r = this.inner.roll(count, sides)
    this.draws.push([count, sides, r])
    return r
  }
  tape(): Tape { return { format: TAPE_FORMAT, version: 1, game: this.game, draws: this.draws.map((d) => [...d] as Draw) } }
}

/** A replayed request that does not match the tape, or a tape that ran out (§6.4): the run stops. */
export class Divergence extends Error {
  readonly index: number
  readonly expected: Draw | null
  readonly got: [number, number]
  constructor(index: number, expected: Draw | null, got: [number, number]) {
    super(expected
      ? `dice tape divergence at entry ${index}: the tape has (${expected[0]}, ${expected[1]}), the run asked (${got[0]}, ${got[1]})`
      : `dice tape divergence at entry ${index}: the tape ran out, the run asked (${got[0]}, ${got[1]})`)
    this.index = index; this.expected = expected; this.got = got
  }
}

/** Replaying: each request is answered with the next entry's result, after checking it asks the same. */
export class TapePlayer implements Dice {
  private i = 0
  readonly draws: Draw[]
  constructor(tape: Tape) {
    if (tape.format !== TAPE_FORMAT || tape.version !== 1) throw new Error('not a version 1 goldbox-dice-tape')
    tape.draws.forEach((d, i) => {
      const [n, s, r] = d
      const ok = [n, s, r].every((v) => Number.isInteger(v) && v >= 0) && (n === 0 || s === 0 ? r === 0 : r >= n && r <= n * s)
      if (!ok) throw new Error(`dice tape entry ${i} is not a possible draw: ${JSON.stringify(d)}`)
    })
    this.draws = tape.draws
  }
  roll(count: number, sides: number) {
    const d = this.draws[this.i]
    if (!d || d[0] !== count || d[1] !== sides) throw new Divergence(this.i, d ?? null, [count, sides])
    this.i++
    return d[2]
  }
  /** entries answered so far */
  get used() { return this.i }
  /** entries not yet asked for */
  get left() { return this.draws.length - this.i }
}
