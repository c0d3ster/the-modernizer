import type { VerticalProfile } from '@modernizer/design-guide'
import type { SiteSchema } from '@modernizer/schema'
import type { Palette } from './config-generator.js'

export interface FontSetup {
  imports: string
  declarations: string
  // Expression for <html className={...}>
  className: string
}

/** next/font setup for the profile's heading and body fonts (one import when they match). */
export const fontSetup = ({ theme }: VerticalProfile): FontSetup => {
  const { headingFont, bodyFont } = theme
  const same = headingFont.importName === bodyFont.importName
  const names = same ? [headingFont.importName] : [headingFont.importName, bodyFont.importName]
  const declarations = same
    ? `const bodyFont = ${bodyFont.importName}({ subsets: ['latin'], display: 'swap', variable: '--font-body' })\nconst displayFont = ${headingFont.importName}({ subsets: ['latin'], display: 'swap', variable: '--font-display' })`
    : `const displayFont = ${headingFont.importName}({ subsets: ['latin'], display: 'swap', variable: '--font-display' })\nconst bodyFont = ${bodyFont.importName}({ subsets: ['latin'], display: 'swap', variable: '--font-body' })`
  return {
    imports: `import { ${names.join(', ')} } from 'next/font/google'`,
    declarations,
    className: '`${displayFont.variable} ${bodyFont.variable}`',
  }
}

const unwrapWayback = (url: string): string => url.match(/^https?:\/\/web\.archive\.org\/web\/[^/]+\/(.+)$/)?.[1] ?? url

const absoluteUrl = (url: string | undefined): string | undefined => {
  if (!url) return undefined
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : undefined
  } catch {
    return undefined
  }
}

/** The business's own origin. The rebuild replaces the site at the same domain, so share links resolve there. */
export const siteOrigin = (rootUrl: string): string => {
  try {
    return new URL(unwrapWayback(rootUrl)).origin
  } catch {
    return 'https://example.com'
  }
}

/**
 * The root layout's `metadata` export: title, description and the Open Graph / Twitter tags that
 * make shared links show a title, summary and photo instead of a bare URL.
 */
export const generateMetadataExport = (schema: Pick<SiteSchema, 'siteName' | 'tagline' | 'rootUrl' | 'heroImageUrl' | 'logoUrl'>): string => {
  const { siteName, tagline, rootUrl } = schema
  const description = tagline?.trim() || siteName
  const image = absoluteUrl(schema.heroImageUrl) ?? absoluteUrl(schema.logoUrl)
  const images = image ? `\n    images: [{ url: ${JSON.stringify(image)}, alt: ${JSON.stringify(siteName)} }],` : ''
  return `export const metadata: Metadata = {
  metadataBase: new URL(${JSON.stringify(siteOrigin(rootUrl))}),
  title: ${JSON.stringify(siteName)},
  description: ${JSON.stringify(description)},
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: '/',
    siteName: ${JSON.stringify(siteName)},
    title: ${JSON.stringify(siteName)},
    description: ${JSON.stringify(description)},${images}
  },
  twitter: {
    card: ${image ? "'summary_large_image'" : "'summary'"},
    title: ${JSON.stringify(siteName)},
    description: ${JSON.stringify(description)},
  },
}`
}

const escapeXml = (s: string): string => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c] ?? c)

/** First letter of the business name, skipping a leading "The". */
export const monogram = (siteName: string): string => {
  const words = siteName.trim().split(/\s+/).filter(Boolean)
  const word = words.length > 1 && /^the$/i.test(words[0] ?? '') ? words[1] : words[0]
  return (word?.match(/[a-z0-9]/i)?.[0] ?? 'S').toUpperCase()
}

/**
 * A favicon for src/app/icon.svg (Next.js links it automatically): the business initial on its
 * brand color. Without one, browsers request /favicon.ico, get a 404 and log a console error.
 */
export const generateIconSvg = (siteName: string, { primary, primaryForeground }: Pick<Palette, 'primary' | 'primaryForeground'>): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="${escapeXml(primary)}"/>
  <text x="32" y="44" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Arial, sans-serif" font-size="36" font-weight="700" fill="${escapeXml(primaryForeground)}">${escapeXml(monogram(siteName))}</text>
</svg>
`
