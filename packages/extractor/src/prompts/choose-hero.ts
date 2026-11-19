import type Anthropic from '@anthropic-ai/sdk'
import type { SiteImage } from '@modernizer/schema'

import type { LlmTool } from '../llm-client.js'

/** The candidate photos (by URL, so the API fetches them) and the question, as content blocks. */
export const chooseHeroPrompt = (candidates: readonly SiteImage[], siteName: string): Anthropic.ContentBlockParam[] => [
  ...candidates.flatMap((image, index): Anthropic.ContentBlockParam[] => [
    { type: 'text', text: `Photo ${index}${image.alt ? ` (alt text: "${image.alt}")` : ''}:` },
    { type: 'image', source: { type: 'url', url: image.url } },
  ]),
  {
    type: 'text',
    text: `These photos come from the current website of ${siteName}. Pick the one that works best as the full-width background of the home page hero, behind a white headline.

A good hero photo shows the business itself: the place, the team at work, the food, the finished work. It has no large text of its own (signs, flyers, menus and logos fight with the headline), is not a close-up portrait cropped at the face, and still reads when cropped wide. If none of them would work, answer null.

Call choose_hero_photo with the photo number.`,
  },
]

export const chooseHeroTool: LlmTool = {
  name: 'choose_hero_photo',
  description: 'Record which photo to use as the home page hero.',
  input_schema: {
    type: 'object',
    properties: {
      choice: { type: ['integer', 'null'], description: 'The photo number, or null if none would work' },
    },
    required: ['choice'],
  },
}
