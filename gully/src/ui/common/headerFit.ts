// The header can't overlap (owner 2026-11-01): the same measuring rule as the Gully Chain sites (gully-ops sites/_shared/term.js). Starting from
// everything showing, it applies one step at a time while the bar is wider than its box, as html[data-hfit="step step ..."]; the CSS says what each
// step hides. It re-measures when the bar resizes or its content changes (a sign-in button drawn late, a wallet pill).
export function fitHeader(bar: HTMLElement, steps: string[]): () => void {
  const root = document.documentElement
  const over = () => bar.scrollWidth > bar.clientWidth
  const run = () => {
    root.removeAttribute('data-hfit')
    const on: string[] = []
    for (const s of steps) {
      if (!over()) return
      on.push(s)
      root.setAttribute('data-hfit', on.join(' '))
    }
  }
  let queued = false
  const again = () => {
    if (queued) return
    queued = true
    requestAnimationFrame(() => {
      queued = false
      run()
    })
  }
  run()
  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(again) : null
  ro?.observe(bar)
  const mo = typeof MutationObserver === 'function' ? new MutationObserver(again) : null
  mo?.observe(bar, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['style', 'hidden', 'class', 'data-ready'] }) // a button shown late, by style
  void document.fonts?.ready?.then(run)
  return () => {
    ro?.disconnect()
    mo?.disconnect()
    root.removeAttribute('data-hfit')
  }
}
