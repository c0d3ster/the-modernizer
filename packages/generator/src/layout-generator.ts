import type { SiteSchema, BrandColors, NavItem } from '@modernizer/schema'

// Flattens the nav tree into a single level, strips origins from same-site
// URLs, and skips anchor-only items (#) that have no real destination.
export const flattenNav = (nav: NavItem[], rootUrl: string): Array<{ label: string; url: string }> => {
  const origin = new URL(rootUrl).origin

  const toRelative = (url: string): string | null => {
    if (!url || url === '#') return null
    try {
      const parsed = new URL(url)
      if (parsed.origin === origin) {
        return parsed.pathname.replace(/\/$/, '') || '/'
      }
      return url // external link — keep as-is
    } catch {
      return url // already relative
    }
  }

  const seen = new Set<string>()
  const result: Array<{ label: string; url: string }> = []

  const collect = (item: NavItem): void => {
    const url = toRelative(item.url)
    if (url && !seen.has(url)) {
      seen.add(url)
      result.push({ label: item.label, url })
    }
    item.children?.forEach(collect)
  }

  nav.forEach(collect)
  return result
}

const esc = (s: string): string => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const serializeNav = (items: Array<{ label: string; url: string }>): string => {
  const lines = items.map((item) => `  { label: '${esc(item.label)}', url: '${esc(item.url)}' }`).join(',\n')
  return `[\n${lines},\n]`
}

export const generateLayout = (schema: SiteSchema): string => {
  const { siteName, nav, tagline, rootUrl, pages } = schema
  const pagePathnames = new Set(
    pages.map((p) => {
      try { return new URL(p.url).pathname.replace(/\/$/, '') || '/' } catch { return p.url }
    })
  )
  const flatNav = flattenNav(nav, rootUrl)
    .filter((item) => {
      try { return pagePathnames.has(new URL(item.url, rootUrl).pathname.replace(/\/$/, '') || '/') }
      catch { return true } // keep external links
    })
    .slice(0, 7)
  const navLiteral = serializeNav(flatNav)
  const description = tagline ?? siteName

  return `import type { ReactElement, ReactNode } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import './globals.css'

export const metadata = {
  title: '${siteName}',
  description: '${description.replace(/'/g, "\\'")}',
}

const nav = ${navLiteral}

const RootLayout = ({ children }: { children: ReactNode }): ReactElement => {
  return (
    <html lang='en'>
      <body>
        <Navbar siteName='${siteName}' nav={nav} />
        {children}
        <Footer siteName='${siteName}' nav={nav} />
      </body>
    </html>
  )
}

export default RootLayout
`
}

/** Warm neutral when the schema does not specify a page background (avoids harsh #fff). */
const DEFAULT_PAGE_BACKGROUND = '#f4f1ec'

export const generateGlobalsCss = (brandColors: BrandColors): string => {
  const primary = brandColors.primary ?? '#2563eb'
  const primaryForeground = brandColors.text ?? '#ffffff'
  const background = brandColors.background ?? DEFAULT_PAGE_BACKGROUND

  return `@import "tailwindcss";
@source "../";

/* Accordion keyframes (Radix UI) */
@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}
@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}

@theme {
  --color-primary: ${primary};
  --color-primary-foreground: ${primaryForeground};

  --color-background: ${background};
  --color-foreground: #1c1917;

  --color-muted: #e8e5e0;
  --color-muted-foreground: #57534e;

  --color-card: #fffdfb;
  --color-card-foreground: #1c1917;

  --color-popover: #fffdfb;
  --color-popover-foreground: #1c1917;

  --color-border: #e0d9d0;
  --color-input: #e0d9d0;
  --color-ring: ${primary};

  --color-accent: #ece8e2;
  --color-accent-foreground: #1c1917;

  --color-destructive: #ef4444;
  --color-destructive-foreground: #ffffff;

  --radius: 0.5rem;
  --radius-sm: calc(0.5rem - 2px);
  --radius-md: calc(0.5rem - 2px);
  --radius-lg: 0.5rem;
  --radius-xl: calc(0.5rem + 4px);

  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
}

@layer base {
  * {
    border-color: var(--color-border);
  }
  body {
    background-color: var(--color-background);
    color: var(--color-foreground);
  }
}
`
}
