// The shortest walk to a screen, for the DOSBox comparisons (tools/dosbox/README.md, "Menus, shops and the
// camp"): from a save and an optional opening, breadth first over f, l and r with the headless runner (every
// menu answered 0), until a move hands over the screen named (shop, temple, camp, combat …); squares that
// hand over any other screen are not walked through. Prints the walk and the menus it met (PoR).
//
//   node --import ./headless/node-ts.mjs headless/route.ts <game folder> <screen> [opening moves] [save X]
import { loadFolder, runScript, type Event } from './harness.ts'
import { POR } from '../src/games/profile.ts'
const files = loadFolder(POR, process.argv[2])
const want = process.argv[3]
const start = process.argv[4] ?? ''
const save = process.argv[5] ?? 'A'
async function run(moves: string) {
  const ev: Event[] = []
  const answers = Array(40).fill(0)
  await runScript({ files, script: { game: 'por', save, answers, commands: [...moves] }, seed: 1, frame: true, out: (e) => ev.push(e) }).catch(() => {})
  const f = ev.find((e) => e.event === 'frame') as { block: number; area: number; x: number; y: number; facing2: number } | undefined
  const menus = ev.filter((e) => e.event === 'menu').map((e) => (e.items as string[]).join('/'))
  const hit = ev.some((e) => e.event === 'screen' && e.what === want)
  const bad = ev.some((e) => e.event === 'screen' && !['blocked', want].includes(e.what as string))
  return { key: f ? `${f.block}:${f.area}:${f.x},${f.y},${f.facing2}` : '?', hit, bad, menus }
}
const seen = new Set<string>()
let frontier = [start]
const first = await run(start)
seen.add(first.key)
for (let depth = 0; depth < 60 && frontier.length; depth++) {
  const next: string[] = []
  for (const w of frontier) for (const m of ['f', 'l', 'r']) {
    const t = await run(w + m)
    if (t.hit) { console.log(JSON.stringify({ walk: w + m, menus: t.menus })); process.exit(0) }
    if (t.bad || seen.has(t.key)) continue
    seen.add(t.key)
    next.push(w + m)
  }
  frontier = next
  console.error(`depth ${depth + 1}: ${frontier.length} new, ${seen.size} seen`)
}
console.log('not found')
