// Changes to the player's data, reported by the stores (user.ts, the settings panel) and heard by
// the sync layer (account.ts). Keys are "<kind>/<id>" as the server names records (records.ts).
type Listener = (key: string, how: 'change' | 'seed') => void
const listeners = new Set<Listener>()

export function onLocalChange(f: Listener): () => void {
  listeners.add(f)
  return () => { listeners.delete(f) }
}

export function localChanged(key: string, how: 'change' | 'seed' = 'change') {
  for (const f of listeners) {
    try { f(key, how) } catch { /* the game goes on */ }
  }
}
