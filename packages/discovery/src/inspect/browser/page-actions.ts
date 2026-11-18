// In-page actions, each self-contained for page.evaluate.

/** Clicks accept or close, but only on buttons inside a cookie, privacy or consent notice. */
export const dismissConsent = (): number => {
  const OK = /^(accept|accept all|accept all cookies|accept cookies|accept and close|close and accept|allow all|allow cookies|i agree|agree|got it|ok|okay|i understand|dismiss|close|no thanks|reject all|decline)$/i
  const innerTextOf = (el: Element): string => (el instanceof HTMLElement ? el.innerText : el.textContent ?? '')
  let clicked = 0
  for (const el of document.querySelectorAll('button, a, [role=button], input[type=button]')) {
    const value = el instanceof HTMLInputElement ? el.value : ''
    const label = (innerTextOf(el) || value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ')
    if (!OK.test(label)) continue
    let node: Element | null = el
    let inNotice = false
    for (let depth = 0; depth < 8 && node; depth += 1) {
      const t = innerTextOf(node)
      if (/cookie|privacy|consent|gdpr|ccpa/i.test(t) && t.length < 2000) {
        inNotice = true
        break
      }
      node = node.parentElement
    }
    const r = el.getBoundingClientRect()
    if (!inNotice || !r.width || !r.height || !(el instanceof HTMLElement)) continue
    el.click()
    clicked += 1
    if (clicked >= 2) break
  }
  return clicked
}

/** Scrolls through the page so lazy images and scroll animations load, then returns to the top. */
export const warmUp = async (): Promise<void> => {
  const step = Math.max(400, Math.floor(window.innerHeight * 0.8))
  const max = Math.min(document.documentElement.scrollHeight, 30000)
  for (let y = 0; y < max; y += step) {
    window.scrollTo(0, y)
    await new Promise<void>((resolve) => setTimeout(resolve, 150))
  }
  window.scrollTo(0, 0)
}

export const visibleText = (): string => document.body?.innerText ?? ''

export const scrollOneScreen = (): void => window.scrollTo(0, window.innerHeight)
