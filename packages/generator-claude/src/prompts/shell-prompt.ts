import type { SiteSchema } from '@modernizer/schema'
import type { PromptParts } from '../llm-client.js'
import { buildSiteContextBlock } from './shared.js'

/** Builds the prompt for the shared shell: root layout, navbar, footer. No page content. */
export const buildShellPrompt = (schema: SiteSchema): PromptParts => ({
  cached: buildSiteContextBlock(schema),
  task: `You are building the shared shell (root layout, navbar, footer) for this site.

## Required Files
Generate exactly these three files:
- src/app/layout.tsx — root layout rendering <Navbar /> and <Footer /> around {children}, imports './globals.css', sets \`metadata\` (title: site name, description: tagline or site name)
- src/components/layout/Navbar.tsx — sticky/fixed navbar. It must stay fully visible at all times, including on page load before any scroll or hover — do NOT hide, fade, or rely on a hover/focus state to reveal the nav links or their container; a subtle shadow appearing on scroll is fine, but the links themselves are always visible. Use the Navigation above (already local route paths — use \`next/link\`), with a mobile menu
- src/components/layout/Footer.tsx — footer using the site info and contact details above

Do NOT generate any page.tsx files — those are generated separately, in their own requests.

Call write_files with these three files.`,
})
