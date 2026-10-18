// Every panel the same way (IMP-057): a close button in the top corner, whatever the panel's own
// footer; Escape closes too (the browser's dialog does that).
export function enhancePanel(dialog: HTMLDialogElement) {
  const add = () => {
    if (!dialog.firstElementChild || dialog.querySelector(':scope > .panel-close')) return
    const b = document.createElement('button')
    b.type = 'button'
    b.className = 'panel-close'
    b.setAttribute('aria-label', 'Close')
    b.title = 'Close (Esc)'
    b.textContent = '✕'
    b.addEventListener('click', () => dialog.close())
    dialog.prepend(b)
  }
  new MutationObserver(add).observe(dialog, { childList: true })
}
