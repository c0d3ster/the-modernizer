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
  const parts = clean.split('/').filter(Boolean)
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('') + 'Page'
}
