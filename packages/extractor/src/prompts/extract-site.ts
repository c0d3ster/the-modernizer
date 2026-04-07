import type { LlmTool } from '../llm-client.js'

export const extractSitePrompt = (chromeHtml: string, rootUrl: string): string => `
You are extracting site-level metadata from the navigation and footer HTML of a website.

Root URL: ${rootUrl}

You will receive the shared chrome HTML (nav, header, footer) that appears across the site.

Extract the following:
1. siteName — the name of the business or organization
2. tagline — a short tagline or slogan if present (optional)
3. nav — the complete navigation tree as an array of { label, url, children? } objects. Resolve relative URLs against the root URL.
4. brandColors — when you can identify colors from inline styles or class-related hints, up to 3 hex candidates (e.g. "#0070f3"), typically including a primary if one is clear. If no reliable colors appear in the chrome HTML, omit brandColors entirely.
5. footer — any contact info, address, phone, email, or social links found in the footer

RULES:
- For nav URLs, always use absolute URLs.
- If you cannot find a value, omit the field rather than guessing.

CHROME HTML:
${chromeHtml.slice(0, 8000)}
`.trim()

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
          primary: { type: 'string' },
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
