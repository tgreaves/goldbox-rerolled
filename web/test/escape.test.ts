// Escape backs out of a menu (IMP-081, spec/C-port/ui-contract.md §7): the game's own Exit, No in its
// Yes/No, the only choice of a one-choice prompt; nothing in a menu with no way back. The words are
// the game's, read from its files, so each game is checked against its own (skipped without them).
import { afterAll, describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { installText } from '../src/data/gametext'
import { POR, COAB, setGame, type GameProfile } from '../src/games/profile'
import { SOTSB } from '../src/games/sotsb'
import { backChoice, items, menu, word, type MenuId } from '../src/games/strings'

const GAMES: [GameProfile, string | undefined][] = [[POR, process.env.POOLRAD], [COAB, process.env.COAB], [SOTSB, process.env.SOTSB]]

describe('Escape in menus', () => {
  afterAll(() => { setGame(POR); installText(undefined, undefined) })

  for (const [g, dir] of GAMES) {
    const ok = !!dir && existsSync(join(dir, 'START.EXE'))
    it.skipIf(!ok)(`${g.id}: Exit, No, the only choice, or nothing`, () => {
      setGame(g)
      installText(new Uint8Array(readFileSync(join(dir!, 'START.EXE'))), new Uint8Array(readFileSync(join(dir!, 'GAME.OVR'))))
      const exit = word('aim', 'E').text.toUpperCase()
      expect(exit).toBe('EXIT')
      // every menu of the game with its Exit word backs out through it
      let withExit = 0
      for (const id of Object.keys(g.menus) as MenuId[]) {
        const { labels } = items(menu(id))
        const at = labels.lastIndexOf(exit)
        if (labels.length > 1 && at >= 0) { withExit++; expect(backChoice(labels), id).toBe(at) }
      }
      expect(withExit).toBeGreaterThan(10)
      // the Yes/No question answers No; Yes alone or No alone is not that question
      const yn = items(menu('yesNo')).labels
      expect(backChoice(yn)).toBe(yn.indexOf('NO'))
      expect(backChoice(['NO', 'MAYBE'])).toBeNull()
      // a list ending in the Exit word (Aim's targets, a spell list), a one-choice prompt, a story choice
      expect(backChoice(['GOBLIN (range 1)', 'ORC (range 2)', exit])).toBe(2)
      expect(backChoice(['PRESS ENTER'])).toBe(0)
      expect(backChoice(['TALK', 'FIGHT', 'LEAVE'])).toBeNull()
    })
  }
})
