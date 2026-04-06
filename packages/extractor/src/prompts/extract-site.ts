export const extractSitePrompt = (chromeHtml: string, rootUrl: string): string => `
You are extracting site-level metadata from the navigation and footer HTML of a website.

Root URL: ${rootUrl}

You will receive the shared chrome HTML (nav, header, footer) that appears across the site.

Extract the following:
1. siteName — the name of the business or organization
2. tagline — a short tagline or slogan if present (optional)
3. nav — the complete navigation tree as an array of { label, url, children? } objects. Resolve relative URLs against the root URL.
4. brandColors — up to 3 hex color candidates from inline styles or class names (e.g. "#0070f3"). At minimum provide a primary color.
5. footer — any contact info, address, phone, email, or social links found in the footer

RULES:
- Output ONLY valid JSON — no markdown fences, no preamble.
- For nav URLs, always use absolute URLs.
- If you cannot find a value, omit the field rather than guessing.

CHROME HTML:
${chromeHtml.slice(0, 8000)}

OUTPUT FORMAT (JSON only):
{
  "siteName": "...",
  "tagline": "...",
  "brandColors": {
    "primary": "#hex",
    "secondary": "#hex"
  },
  "nav": [
    { "label": "Home", "url": "https://..." },
    { "label": "Services", "url": "https://...", "children": [...] }
  ],
  "footer": {
    "phone": "...",
    "email": "...",
    "address": "...",
    "socialLinks": [{ "platform": "...", "url": "..." }]
  }
}
`.trim()
