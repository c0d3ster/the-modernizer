import { profileFor, verticalOf } from '@modernizer/design-guide'
import type { PrimaryActionKind, VerticalProfile } from '@modernizer/design-guide'
import type { SiteSchema } from '@modernizer/schema'
import { unwrapWaybackUrl } from './wayback-utils.js'

export interface SiteAction {
  text: string
  url: string
}

/** Everything the local generator decides from the site's vertical profile. */
export interface SiteStyle {
  profile: VerticalProfile
  primaryAction: SiteAction | null
  // Tap-to-call link, offered beside the main action when the main action is not itself a call
  callAction: SiteAction | null
  headerPhone: string | undefined
}

// Page paths that fulfil each kind of main action, best match first
const ACTION_PATHS: Readonly<Record<PrimaryActionKind, readonly RegExp[]>> = {
  book: [/book|appointment|schedul/, /request/, /contact/],
  schedule: [/schedul|book|service-request/, /request|estimate|quote/, /contact/],
  reserve: [/reserv|booking/, /contact|visit/],
  order: [/order/, /menu/],
  call: [/contact/],
  contact: [/contact/],
}

const telHref = (phone: string): string => `tel:${phone.replace(/[^\d+]/g, '')}`

const pagePaths = (schema: SiteSchema): string[] => {
  const root = unwrapWaybackUrl(schema.rootUrl)
  return schema.pages.flatMap((p) => {
    try {
      const path = new URL(unwrapWaybackUrl(p.url), root).pathname.replace(/\/$/, '') || '/'
      return path === '/' ? [] : [path]
    } catch {
      return []
    }
  })
}

/**
 * Picks the site's main action from its vertical: a page that fulfils it (a booking or contact page),
 * otherwise a tap-to-call link, otherwise none.
 */
export const resolveSiteStyle = (schema: SiteSchema): SiteStyle => {
  const profile = profileFor(verticalOf(schema))
  const phone = schema.footer?.phone?.trim() || undefined
  const callAction = phone ? { text: `Call ${phone}`, url: telHref(phone) } : null
  const paths = pagePaths(schema)
  const { kind, label } = profile.primaryAction

  const page = ACTION_PATHS[kind].map((pattern) => paths.find((p) => pattern.test(p.toLowerCase()))).find((p): p is string => Boolean(p))
  const primaryAction = page ? { text: label, url: page } : callAction ? { text: 'Call now', url: callAction.url } : null
  return {
    profile,
    primaryAction,
    // No second call button when the main action already calls
    callAction: primaryAction?.url === callAction?.url ? null : callAction,
    headerPhone: profile.headerPhone ? phone : undefined,
  }
}

interface FontSetup {
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
