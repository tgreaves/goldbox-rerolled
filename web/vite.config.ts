import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build` → installable offline web app (PWA) in dist/
// `vite build --mode single` → one self-contained HTML file in dist-single/
export default defineConfig(({ mode }) => ({
  base: './',
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
              name: 'GoldBox Rerolled: Pool of Radiance',
              short_name: 'GoldBox Rerolled',
              description: 'Browser port of the 1988 SSI game. Bring your own game files.',
              theme_color: '#101820',
              background_color: '#101820',
              display: 'standalone',
              icons: [{ src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
            },
            workbox: { globPatterns: ['**/*.{js,css,html,svg}', 'journal/*.png'] },
          }),
        ],
  test: { include: ['test/**/*.test.ts'] },
}))
