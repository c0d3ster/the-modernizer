import type { SiteSchema, BrandColors, NavItem } from '@modernizer/schema'

const serializeNav = (nav: NavItem[]): string => {
  const items = nav.map((item) => `  { label: '${item.label}', url: '${item.url}' }`).join(',\n')
  return `[\n${items},\n]`
}

export const generateLayout = (schema: SiteSchema): string => {
  const { siteName, nav, tagline } = schema
  const navLiteral = serializeNav(nav)
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

export const generateGlobalsCss = (brandColors: BrandColors): string => {
  const primary = brandColors.primary ?? '#2563eb'
  const primaryForeground = brandColors.text ?? '#ffffff'
  const background = brandColors.background ?? '#ffffff'

  return `@import "tailwindcss";
@plugin "@tailwindcss/typography";

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
  --color-foreground: #0f172a;

  --color-muted: #f1f5f9;
  --color-muted-foreground: #64748b;

  --color-card: #ffffff;
  --color-card-foreground: #0f172a;

  --color-popover: #ffffff;
  --color-popover-foreground: #0f172a;

  --color-border: #e2e8f0;
  --color-input: #e2e8f0;
  --color-ring: ${primary};

  --color-accent: #f1f5f9;
  --color-accent-foreground: #0f172a;

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
