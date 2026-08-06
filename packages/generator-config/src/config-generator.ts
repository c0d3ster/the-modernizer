import type { SiteSchema, ContentBlock, BrandColors } from '@modernizer/schema'

/**
 * Walks all blocks across all pages and collects unique external image hostnames.
 * Next.js requires every remote image hostname to be listed in `images.remotePatterns`
 * or it will block the request.
 */
export const collectImageHostnames = (schema: SiteSchema): string[] => {
  const hostnames = new Set<string>()

  const tryAdd = (url: string | undefined): void => {
    if (!url) return
    try {
      const { hostname, protocol } = new URL(url)
      if (protocol === 'http:' || protocol === 'https:') hostnames.add(hostname)
    } catch {
      // relative or malformed URL — skip
    }
  }

  const collectFromBlock = (block: ContentBlock): void => {
    switch (block.type) {
      case 'hero':
        tryAdd(block.backgroundImageUrl)
        break
      case 'feature_grid':
        block.features.forEach((f) => tryAdd(f.iconUrl))
        break
      case 'testimonial':
        block.testimonials.forEach((t) => tryAdd(t.avatarUrl))
        break
      case 'team_grid':
        block.members.forEach((m) => tryAdd(m.photoUrl))
        break
      case 'image_gallery':
        block.images.forEach((img) => tryAdd(img.url))
        break
      case 'logo_cloud':
        block.logos.forEach((l) => tryAdd(l.imageUrl))
        break
    }
  }

  for (const page of schema.pages) {
    for (const block of page.blocks) collectFromBlock(block)
  }

  return [...hostnames]
}

export const generatePackageJson = (schema: SiteSchema): string =>
  JSON.stringify(
    {
      name: schema.siteName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        lint: 'next lint',
      },
      dependencies: {
        next: '^15.0.0',
        react: '^19.0.0',
        'react-dom': '^19.0.0',
        'lucide-react': '^0.400.0',
        'class-variance-authority': '^0.7.0',
        clsx: '^2.1.0',
        'tailwind-merge': '^3.0.0',
        '@radix-ui/react-accordion': '^1.2.0',
        '@radix-ui/react-avatar': '^1.1.0',
        '@radix-ui/react-separator': '^1.1.0',
        '@radix-ui/react-slot': '^1.2.0',
      },
      devDependencies: {
        typescript: '^5.0.0',
        '@types/node': '^22.0.0',
        '@types/react': '^19.0.0',
        '@types/react-dom': '^19.0.0',
        tailwindcss: '^4.0.0',
        '@tailwindcss/postcss': '^4.0.0',
        eslint: '^9.0.0',
        '@eslint/eslintrc': '^3.0.0',
        'eslint-config-next': '^15.0.0',
      },
    },
    null,
    2
  )

export const generateNextConfig = (imageHostnames: string[] = []): string => {
  const remotePatterns = imageHostnames
    .map((hostname) => `    { protocol: 'https', hostname: '${hostname}' },`)
    .join('\n')

  const imagesBlock = imageHostnames.length > 0
    ? `  images: {\n    remotePatterns: [\n${remotePatterns}\n    ],\n  },\n`
    : ''

  return `import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  // Pins the tracing root to this project even when generated inside a parent monorepo
  // (e.g. .generated/ during local dev) — otherwise Next.js can infer the wrong workspace
  // root from an ancestor lockfile and mis-resolve dependencies during the build.
  outputFileTracingRoot: __dirname,
${imagesBlock}}

export default nextConfig
`
}

export const generateTsConfig = (): string =>
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2017',
        lib: ['dom', 'dom.iterable', 'esnext'],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: 'esnext',
        moduleResolution: 'bundler',
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: 'preserve',
        incremental: true,
        plugins: [{ name: 'next' }],
        paths: { '@/*': ['./src/*'] },
      },
      include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
      exclude: ['node_modules'],
    },
    null,
    2
  )

export const generatePostcss = (): string => `/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
`

export const generatePrettier = (): string => `/** @type {import('prettier').Config} */
const config = {
  endOfLine: 'auto',
  singleQuote: true,
  semi: false,
  trailingComma: 'es5',
  jsxSingleQuote: true,
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
}

export default config
`

export const generateEslint = (): string => `import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __dirname = dirname(fileURLToPath(import.meta.url))
const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
]

export default eslintConfig
`

/** Warm neutral when the schema does not specify a page background (avoids harsh #fff). */
const DEFAULT_PAGE_BACKGROUND = '#f4f1ec'

/** Only emit values that are plausible CSS colors; avoids broken or hostile input in generated CSS. */
const sanitizeThemeColor = (value: string | undefined, fallback: string): string => {
  if (value == null || typeof value !== 'string') return fallback
  const t = value.trim()
  if (/^#[0-9a-fA-F]{3,8}$/.test(t)) return t
  if (/^(?:rgb|hsl|oklch|hwb|lab|lch)\(/i.test(t)) return t
  return fallback
}

/**
 * Deterministic globals.css shared by every generator. Defines the standard shadcn/ui CSS
 * variable set (--color-primary, --color-card, --color-border, etc.) that the shadcn primitives
 * in @modernizer/ui rely on, mapped from the site's detected brand colors. All rules that must
 * win over Tailwind utilities live in `@layer base` — anything left unlayered would override
 * layered utilities like `mx-auto`/`px-4` regardless of specificity, per the CSS cascade layers spec.
 */
export const generateGlobalsCss = (brandColors: BrandColors): string => {
  const primary = sanitizeThemeColor(brandColors.primary, '#2563eb')
  const primaryForeground = sanitizeThemeColor(brandColors.text, '#ffffff')
  const background = sanitizeThemeColor(brandColors.background, DEFAULT_PAGE_BACKGROUND)

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

  --color-secondary: #e5e1da;
  --color-secondary-foreground: #1c1917;

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
