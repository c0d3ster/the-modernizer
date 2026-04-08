// Maps PageSchema URLs to Next.js App Router file paths and component names

export const urlToRoutePath = (url: string): string => {
  const { pathname } = new URL(url)
  const clean = pathname.replace(/\/+$/, '')
  if (!clean) return 'src/app/page.tsx'
  return `src/app${clean}/page.tsx`
}

export const urlToComponentName = (url: string): string => {
  const { pathname } = new URL(url)
  const clean = pathname.replace(/\/+$/, '')
  if (!clean) return 'HomePage'
  // Capitalize each segment and each hyphenated word within it
  const toPascal = (s: string): string =>
    s.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('')
  return clean.split('/').filter(Boolean).map(toPascal).join('') + 'Page'
}
