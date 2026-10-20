// The port's Debug panel (not part of the game): quick jumps and the way to play a game's ending,
// per game.

export interface DebugTools {
  /** [block, area, x, y, facing]; wilderness positions as the game's own scripts write them */
  jumps: { label: string; to: [number, number, number, number, number] }[]
  /**
   * The end of the game as its script runs it: jump to the final area, then run the script at `fight`
   * (the final battle) or `ending` (what follows a win), and re-enter the area to carry on; null: not
   * worked out for this game
   */
  finale: { foe: string; at: [number, number, number, number, number]; fight: number; ending: number; note: string } | null
}

export const POR_DEBUG: DebugTools = {
  jumps: [
    // wilderness positions as the harbour script writes them (ECL3 #0)
    { label: 'Wilderness: west boat landing (20,29)', to: [7, 26, 7, 29, 0] },
    { label: 'Wilderness: north side of the bay (26,27)', to: [7, 26, 13, 27, 0] },
    { label: 'Wilderness: east boat landing (35,29)', to: [8, 27, 9, 29, 0] },
    { label: 'New Phlan: end of the pier (15,1)', to: [3, 0, 15, 1, 3] },
  ],
  // ECL5 #7, Valjevo Castle's inner tower: 0xA7DC sets up and starts the battle with Tyranthraxus
  // (monster 66); 0xA80E follows a win: the victory flags, PROGRAM 8 (the ending), the walk back to
  // New Phlan (on_enter 0x9A37: 0x4AE0 = 1 → 0xA82D, "KNOWING THAT TYRANTHRAXUS…")
  finale: { foe: 'Tyranthraxus', at: [5, 7, 1, 4, 1], fight: 0xa7dc, ending: 0xa80e,
    note: 'the end of the game as its script runs it (ECL5 #7): after the final battle is won, or that battle (the guards and the NPCs\' vote are skipped)' },
}

export const COAB_DEBUG: DebugTools = {
  jumps: [{ label: 'Tilverton: the Windlord\'s Inn (6,12)', to: [2, 1, 6, 12, 0] }],
  finale: null,
}
