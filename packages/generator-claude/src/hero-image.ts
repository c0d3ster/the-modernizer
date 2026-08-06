import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import type { PageSchema, SiteSchema } from '@modernizer/schema'

// "Nano Banana 2" — Gemini's current fast/cheap image tier. Deliberately not the Pro
// tier (gemini-3-pro-image-preview, ~2-3x the price for 4K/reasoning features): a decorative
// hero background doesn't need that, and this whole feature exists to keep generation cheap.
const GEMINI_MODEL = 'gemini-3.1-flash-image-preview'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

// Minimal shape we read out of the Gemini response — validated rather than cast, since this is
// an untrusted external API boundary.
const GeminiImageResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z.array(
              z.object({
                inlineData: z.object({ data: z.string(), mimeType: z.string().optional() }).optional(),
              })
            ),
          })
          .optional(),
      })
    )
    .optional(),
})

const buildHeroImagePrompt = (schema: SiteSchema): string =>
  [
    `Wide-angle, photorealistic hero banner photograph for a website called "${schema.siteName}".`,
    schema.tagline && `The site's tagline is "${schema.tagline}".`,
    '16:9 landscape aspect ratio, no text, no logos, no watermarks.',
    'Professional, warm, inviting atmosphere suitable as a full-bleed website hero background.',
    schema.brandColors.primary && `Let the lighting and color grading subtly complement the color ${schema.brandColors.primary}.`,
  ]
    .filter(Boolean)
    .join(' ')

const requestHeroImageBytes = async (prompt: string): Promise<Buffer | null> => {
  const apiKey = process.env['GEMINI_API_KEY']
  if (!apiKey) return null

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        imageConfig: {
          aspectRatio: '16:9',
          imageSize: '1K',
          imageOutputOptions: { mimeType: 'image/jpeg', compressionQuality: 90 },
        },
      },
    }),
  })
  if (!response.ok) return null

  const json: unknown = await response.json()
  const parsed = GeminiImageResponseSchema.safeParse(json)
  if (!parsed.success) return null

  const base64 = parsed.data.candidates
    ?.flatMap((c) => c.content?.parts ?? [])
    .find((p) => p.inlineData)?.inlineData?.data

  return base64 ? Buffer.from(base64, 'base64') : null
}

/**
 * Fills in `backgroundImageUrl` on hero blocks that don't have one — falling back first to the
 * page's extracted `ogImage`, then to a generated image (Gemini's "nano banana" image model)
 * saved under the output project's public/ dir. Leaves the block untouched if no fallback
 * worked (no GEMINI_API_KEY, or the request failed) — a missing hero image is a degraded but
 * valid output, not a pipeline failure.
 */
export const fillMissingHeroImages = async (schema: SiteSchema, outDir: string, verbose = false): Promise<SiteSchema> => {
  let generatedCount = 0
  let skippedForMissingKey = false

  const processPage = async (page: PageSchema): Promise<PageSchema> => {
    const blocks = await Promise.all(
      page.blocks.map(async (block) => {
        if (block.type !== 'hero' || block.backgroundImageUrl) return block

        if (page.ogImage) return { ...block, backgroundImageUrl: page.ogImage }

        if (!process.env['GEMINI_API_KEY']) {
          skippedForMissingKey = true
          return block
        }

        const imageBytes = await requestHeroImageBytes(buildHeroImagePrompt(schema))
        if (!imageBytes) return block

        const fileName = `generated-hero-${generatedCount++}.jpg`
        await mkdir(join(outDir, 'public', 'generated'), { recursive: true })
        await writeFile(join(outDir, 'public', 'generated', fileName), imageBytes)
        if (verbose) process.stdout.write(`  Generated hero image for "${page.title}" via Gemini\n`)

        return { ...block, backgroundImageUrl: `/generated/${fileName}` }
      })
    )
    return { ...page, blocks }
  }

  const pages = await Promise.all(schema.pages.map(processPage))

  if (skippedForMissingKey) {
    process.stdout.write(
      '  No hero image found on the original site — set GEMINI_API_KEY to auto-generate one. Continuing without a background image.\n'
    )
  }

  return { ...schema, pages }
}
