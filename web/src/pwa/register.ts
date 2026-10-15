// Service worker registration with an "update available" prompt (PWA build only;
// the single-file build aliases 'virtual:pwa-register' to a no-op stub).
import { registerSW } from 'virtual:pwa-register'

export function setupOffline() {
  const update = registerSW({
    onNeedRefresh() {
      const bar = document.createElement('div')
      bar.className = 'update-bar'
      bar.innerHTML = 'A new version is available. <button>Reload</button> <button class="muted">Later</button>'
      const [reload, later] = bar.querySelectorAll('button')
      reload.addEventListener('click', () => update(true))
      later.addEventListener('click', () => bar.remove())
      document.body.append(bar)
    },
  })
}
