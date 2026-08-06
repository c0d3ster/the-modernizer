import type { BrandColors, NavItem, SiteSchema } from '@modernizer/schema'
import { relativizeNavItems } from '../route-utils.js'
import { reconcileNav } from '../nav-reconciliation.js'

export const formatColorInfo = (brandColors: BrandColors): string =>
  [
    brandColors.primary && `primary: ${brandColors.primary}`,
    brandColors.secondary && `secondary: ${brandColors.secondary}`,
    brandColors.background && `background: ${brandColors.background}`,
    brandColors.text && `text foreground: ${brandColors.text}`,
  ].filter(Boolean).join(', ') || 'not specified — choose tastefully'

export const formatNav = (nav: NavItem[]): string =>
  nav.map((n) =>
    n.children?.length
      ? `${n.label} (${n.url}) > [${n.children.map((c) => `${c.label}: ${c.url}`).join(', ')}]`
      : `${n.label}: ${n.url}`
  ).join('\n  ') || 'none'

export const ICON_GUARDRAIL =
  'lucide-react for icons — only import icon names that actually exist in the package. Do not guess at plausible-sounding names (there is no `Fax`, for example — use `Printer` or `Phone` instead). If unsure whether an icon exists, use a common one you\'re confident about (Phone, Mail, MapPin, Clock, Check, X, Menu, ChevronDown, ArrowRight, Star, Users, Calendar, Facebook, Twitter, Instagram, Linkedin).'

export const PROVIDED_PRIMITIVES = `These files are generated deterministically and already correct — do NOT generate them, and do NOT redefine the components they export:
- package.json, next.config.ts, tsconfig.json, postcss.config.mjs
- src/app/globals.css — defines the full shadcn CSS variable theme (\`--color-primary\`, \`--color-card\`, \`--color-border\`, etc.) mapped from the site's brand colors, plus \`@layer base\` rules. Use Tailwind classes like \`bg-primary\`, \`text-primary-foreground\`, \`bg-card\`, \`border\`, \`bg-muted\`, \`text-muted-foreground\`, \`bg-accent\` throughout for consistent theming — do not invent your own color variables or write a competing global CSS reset.
- src/lib/utils.ts (cn helper)
- src/components/ui/button.tsx, badge.tsx, card.tsx, accordion.tsx, avatar.tsx, separator.tsx (shadcn primitives, with \`asChild\`/Slot support where applicable) — import them from \`@/components/ui/<name>\`, do not redeclare them
Assume \`class-variance-authority\`, \`clsx\`, \`tailwind-merge\`, \`lucide-react\`, and the \`@radix-ui/*\` packages are already installed.`

export const LINK_GUARDRAIL =
  'Every nav URL above is already a local route path on THIS Next.js site (e.g. `/about`), not a link to the original live site — use `next/link`\'s `Link` component with that exact path for all internal navigation (navbar, footer, buttons, CTAs). Never hardcode the original site\'s domain or absolute URL for an internal link. Only use a plain `<a>` with a full URL for links that are genuinely external (e.g. social media, third-party booking systems).'

/**
 * The large block of context (site info, nav, tech stack, provided primitives) shared by the
 * shell prompt and every page prompt, marked as a cache_control breakpoint — only the first call
 * to use a given version of this text pays full input-token price for it, every call after reads
 * it from cache at ~10% of the cost.
 *
 * `designSystemSpec`, when provided, is appended as its own section. It's the shell call's
 * hand-off of the spacing/card/heading/button conventions it already decided on (see
 * design-system.ts) — every page call gets the identical spec text, so this is still one
 * consistent cacheable block across all of them, just a different one than the shell used.
 */
export const buildSiteContextBlock = (schema: SiteSchema, designSystemSpec?: string): string => {
  const { siteName, rootUrl, brandColors, nav, pages, tagline, footer } = schema
  // Nav is extracted from the site's own <nav> menu HTML; pages come from crawling
  // independently, and the two can drift out of sync (a nav entry with no crawled page 404s;
  // a crawled page with no nav entry is unreachable). Reconcile before handing nav to Claude
  // so the generated Navbar never links to a route that doesn't exist.
  const localNav = reconcileNav(relativizeNavItems(nav, rootUrl), pages, rootUrl)

  return `## Site
- Name: ${siteName}
- Original URL: ${rootUrl}
${tagline ? `- Tagline: ${tagline}` : ''}
- Brand colors: ${formatColorInfo(brandColors)}
${footer?.phone ? `- Phone: ${footer.phone}` : ''}
${footer?.email ? `- Email: ${footer.email}` : ''}
${footer?.address ? `- Address: ${footer.address}` : ''}

## Navigation (local route paths, already resolved for this site)
  ${formatNav(localNav)}

## Tech Stack
- Next.js 15 App Router, React 19, TypeScript strict mode
- Tailwind CSS v4 — the theme is already defined in globals.css, use Tailwind classes like \`bg-primary\`, \`text-primary-foreground\`, \`bg-card\`, \`border\`, \`bg-muted\`, \`text-muted-foreground\`, \`bg-accent\`
- shadcn/ui (Button, Card, Badge, Accordion, Avatar, Separator) — already provided at \`@/components/ui/<name>\`, import them, do not redeclare them
- ${ICON_GUARDRAIL}
- ${LINK_GUARDRAIL}
- Mobile-first responsive design

## Already Provided
${PROVIDED_PRIMITIVES}${designSystemSpec ? `

## Design System (already decided for this site — apply these exact conventions everywhere; do not invent new spacing, card, heading, or button conventions)
${designSystemSpec}` : ''}`
}
