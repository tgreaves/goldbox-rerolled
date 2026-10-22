// SotSB's vault file (spec/A-games/sotsb/records.md §5): VAULT.DAT, written when the vault screen is left
// (0x220DA) and read when it opens (0x21D23): 0x1C bytes of coin counts, seven u32 in the order of the
// treasure money table (DS:87AC), then the items as 67-byte records, a bundle followed by its scrolls.
import { Item, itemsFile, parseItems } from './items'

export interface Vault { money: number[]; items: Item[] }

const COINS = 7

/** the vault as the file holds it; none (no file yet): empty, as 0x21EAD clears the coins */
export function parseVault(d: Uint8Array | undefined, size: number, bundleType: number | null): Vault {
  if (!d || d.length < COINS * 4) return { money: new Array(COINS).fill(0), items: [] }
  const v = new DataView(d.buffer, d.byteOffset, d.byteLength)
  const money = Array.from({ length: COINS }, (_, i) => v.getUint32(4 * i, true))
  return { money, items: parseItems(d.subarray(COINS * 4), size, bundleType) }
}

/** the vault back to its file: the coins, then every item (0x220FC–0x221C3) */
export function vaultFile(vault: Vault, size: number, bundleType: number | null): Uint8Array {
  const items = itemsFile(vault.items, size, bundleType)
  const d = new Uint8Array(COINS * 4 + items.length)
  const v = new DataView(d.buffer)
  for (let i = 0; i < COINS; i++) v.setUint32(4 * i, Math.max(0, Math.floor(vault.money[i] ?? 0)) >>> 0, true)
  d.set(items, COINS * 4)
  return d
}
