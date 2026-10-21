// Lets plain Node (24+, which strips TypeScript types itself) run the engine's sources: the sources
// import each other without extensions and import JSON without attributes, as the bundler allows.
// Use: node --import ./headless/node-ts.mjs headless/run.ts … (spec/B-model/host-contracts.md §8)
import { registerHooks } from 'node:module'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

registerHooks({
  resolve(specifier, context, next) {
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const url = new URL(specifier, context.parentURL)
      const path = fileURLToPath(url)
      if (!/\.[a-z]+$/i.test(path) && existsSync(path + '.ts')) return next(specifier + '.ts', context)
      if (path.endsWith('.json')) return { ...next(specifier, context), importAttributes: { type: 'json' } }
    }
    return next(specifier, context)
  },
})
