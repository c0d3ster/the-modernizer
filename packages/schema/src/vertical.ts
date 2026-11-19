import { z } from 'zod'

// Business types the generators have a design profile for. "general" is the fallback for anything
// else. Discovery's Places queries (e.g. "plumber", "hvac contractor") map onto these.
export const VERTICAL_IDS = ['dental', 'home-services', 'restaurant', 'cafe', 'general'] as const
export const verticalIdSchema = z.enum(VERTICAL_IDS)
export type VerticalId = z.infer<typeof verticalIdSchema>
