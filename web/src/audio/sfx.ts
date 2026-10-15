// Sound effects. The original plays PC-speaker effects by number through FUN_18ae_00dc
// (10 footstep, 7 bump, 11 second script effect); their data is not decoded yet, so these
// are synthesised square-wave stand-ins in the same spirit (IMPROVEMENTS.md IMP-013).

const KEY = 'poolrad.sound'
let ctx: AudioContext | null = null
let enabled = true
try {
  enabled = localStorage.getItem(KEY) !== 'off'
} catch { /* storage unavailable: default on */ }

export function soundOn(): boolean {
  return enabled
}

export function setSound(on: boolean) {
  enabled = on
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch { /* ignore */ }
}

/** Browsers only allow audio after a user gesture; call from input handlers. */
export function unlockAudio() {
  if (!ctx) {
    try {
      ctx = new AudioContext()
    } catch {
      return
    }
  }
  if (ctx.state === 'suspended') ctx.resume()
}

function blip(freq: number, start: number, length: number, volume = 0.08) {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.value = freq
  const t = ctx.currentTime + start
  gain.gain.setValueAtTime(volume, t)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + length + 0.01)
}

/** Play original effect number n (approximation). */
export function play(n: number) {
  if (!enabled || !ctx) return
  switch (n) {
    case 10: // footstep
      blip(110, 0, 0.035)
      blip(82, 0.06, 0.04)
      break
    case 7: // bump into a wall
      blip(55, 0, 0.12, 0.1)
      break
    case 11:
      blip(440, 0, 0.05)
      blip(330, 0.06, 0.05)
      break
    default:
      blip(220, 0, 0.05)
  }
}
