import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { execSync } from 'node:child_process'

/** The build's version for the page footer: the commit (GIT_COMMIT, as Docker passes it, else git;
 *  "+changes" when the working tree differs from it) and the build date. */
function buildInfo() {
  const git = (cmd: string) => { try { return execSync(`git ${cmd}`, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim() } catch { return '' } }
  const commit = process.env.GIT_COMMIT || git('rev-parse --short HEAD') || 'unknown'
  const dirty = !process.env.GIT_COMMIT && git('status --porcelain --untracked-files=no') !== ''
  return { commit, dirty, date: new Date().toISOString().slice(0, 10) }
}

// `vite build` → installable offline web app (PWA) in dist/
// `vite build --mode single` → one self-contained HTML file in dist-single/
export default defineConfig(({ mode }) => ({
  base: './',
  define: { __BUILD__: JSON.stringify(buildInfo()) },
  build: { outDir: mode === 'single' ? 'dist-single' : 'dist', chunkSizeWarningLimit: 700 },
  resolve: mode === 'single' ? { alias: { 'virtual:pwa-register': '/src/pwa/stub.ts' } } : {},
  plugins:
    mode === 'single'
      ? [viteSingleFile()]
      : [
          VitePWA({
            registerType: 'prompt',
            includeAssets: ['favicon.svg'],
            manifest: {
              name: 'GoldBox Rerolled',
              short_name: 'GoldBox Rerolled',
              description: 'The SSI Gold Box games in the browser. Bring your own game files.',
              theme_color: '#101820',
              background_color: '#101820',
              display: 'standalone',
              icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
            // the server's API (spec/C-port/accounts-and-sync.md) is never answered from the cache: the data export is a navigation
            workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}', 'journal/*.png'], navigateFallbackDenylist: [/\/api\//] },
          }),
        ],
  test: { include: ['test/**/*.test.ts'] },
}))
