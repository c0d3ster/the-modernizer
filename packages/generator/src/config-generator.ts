import type { SiteSchema, ContentBlock } from '@modernizer/schema'

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
