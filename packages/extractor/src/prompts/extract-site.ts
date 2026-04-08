import type { LlmTool } from '../llm-client.js'
import type { ColorCandidate } from '../color-extractor.js'

export const extractSitePrompt = (
  chromeHtml: string,
  rootUrl: string,
  colorCandidates: ColorCandidate[] = []
): string => {
  let colorSection: string
  if (colorCandidates.length === 0) {
    colorSection = '\nNo color candidates were found. Omit brandColors entirely.'
  } else {
    const high = colorCandidates.filter((c) => c.confidence === 'high')
    const medium = colorCandidates.filter((c) => c.confidence === 'medium')
    const low = colorCandidates.filter((c) => c.confidence === 'low')

    const fmt = (c: ColorCandidate): string => `${c.label} (${c.hex})`

    const lines: string[] = ['\nCOLOR CANDIDATES:']
    if (high.length > 0) lines.push(`  High confidence (used explicitly in content blocks): ${high.map(fmt).join(', ')}`)
    if (medium.length > 0) lines.push(`  Medium confidence (named theme palette colors): ${medium.map(fmt).join(', ')}`)
    if (low.length > 0) lines.push(`  Low confidence (inline styles): ${low.map(fmt).join(', ')}`)
    lines.push('')
    lines.push('Prefer high-confidence candidates. For medium-confidence, use the color name to judge')
    lines.push('whether it fits the brand (e.g. "vivid-red" suits a healthcare site better than "vivid-green-cyan").')
    lines.push('Pick the most visually prominent non-grey color as primary. Omit fields you cannot determine.')
    colorSection = lines.join('\n')
  }

  return `
You are extracting site-level metadata from the navigation and footer HTML of a website.

Root URL: ${rootUrl}

You will receive the shared chrome HTML (nav, header, footer) that appears across the site.

Extract the following:
1. siteName — the name of the business or organization
2. tagline — a short tagline or slogan if present (optional)
3. nav — the complete navigation tree as an array of { label, url, children? } objects. Resolve relative URLs against the root URL.
4. brandColors — see color candidates below. For background, prefer a soft warm off-white (e.g. #f4f1ec) over pure #ffffff when the site uses a light page background.
5. footer — any contact info, address, phone, email, or social links found in the footer

RULES:
- For nav URLs, always use absolute URLs.
- If you cannot find a value, omit the field rather than guessing.
${colorSection}

CHROME HTML:
${chromeHtml.slice(0, 8000)}
`.trim()
}

export const extractSiteTool: LlmTool = {
  name: 'extract_site',
  description: 'Extract site-level metadata (name, nav, brand colors, footer) from shared chrome HTML.',
  input_schema: {
    type: 'object',
    required: ['siteName', 'nav'],
    properties: {
      siteName: { type: 'string' },
      tagline: { type: 'string' },
      brandColors: {
        type: 'object',
        properties: {
          primary: { type: 'string', description: 'Most prominent brand color, e.g. header/button color' },
          background: { type: 'string', description: 'Page background color if not plain white' },
          text: { type: 'string', description: 'Primary text color if not plain black' },
          secondary: { type: 'string' },
          accent: { type: 'string' },
        },
        additionalProperties: false,
      },
      nav: {
        type: 'array',
        items: {
          type: 'object',
          required: ['label', 'url'],
          properties: {
            label: { type: 'string' },
            url: { type: 'string' },
            children: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
          additionalProperties: false,
        },
      },
      footer: {
        type: 'object',
        properties: {
          phone: { type: 'string' },
          email: { type: 'string' },
          address: { type: 'string' },
          socialLinks: {
            type: 'array',
            items: {
              type: 'object',
              required: ['platform', 'url'],
              properties: {
                platform: { type: 'string' },
                url: { type: 'string' },
              },
              additionalProperties: false,
            },
          },
        },
        additionalProperties: false,
      },
    },
  },
}
