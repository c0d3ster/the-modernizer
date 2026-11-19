// Business types the generators have a design profile for. "general" is the fallback for anything
// else. Discovery's Places queries (e.g. "plumber", "hvac contractor") map onto these.
// No zod here: this file is copied into generated projects as a plain type (the zod schema lives in
// validation.ts).
export const VERTICAL_IDS = ['dental', 'home-services', 'restaurant', 'cafe', 'auto-services', 'chiropractic', 'legal', 'veterinary', 'general'] as const
export type VerticalId = (typeof VERTICAL_IDS)[number]
