import { z } from 'zod'

/**
 * Composite weights behind the `score` column, picked on the Winchester rating bench (47 hand-rated
 * sites) and checked against the sites our generators rebuild (docs/market-discovery.md "Final score
 * formula"). Visual carries half; the other signals are ones a rebuild maxes out, so they also show
 * its lift. Shared here so the scorer and the modernization report can't drift apart.
 */
export const COMPOSITE_WEIGHTS = {
  visual: 0.5,
  static: 0.1,
  code: 0.1,
  seo: 0.1,
  accessibility: 0.1,
  bestPractices: 0.1,
} as const

export type CompositeSignal = keyof typeof COMPOSITE_WEIGHTS

/** Pitch a site whose composite is below this. Calibrated on the bench; recheck as more cities are rated. */
export const PITCH_THRESHOLD = 81

// One row of the market-discovery pipeline's candidates.csv. Keys match the columns in
// docs/market-discovery.md "Output Format" > candidates.csv exactly, in order, so the CSV
// writer (scripts/discover-candidates.ts), the modernization report, and outreach all
// share one contract.
export const CANDIDATE_SCORE_COLUMNS = [
  'business_name',
  'phone',
  'address',
  'city',
  'state',
  'url',
  'score',
  'no_ssl',
  'no_viewport',
  'last_changed',
  'old_jquery',
  'old_wp_theme',
  'no_og_tags',
  'table_layout',
  'ie_compatible',
  'static_score',
  'psi_score',
  'psi_performance',
  'psi_seo',
  'psi_accessibility',
  'notes',
  // Business type of the discovery query that found the place (e.g. "plumber"). Appended last so
  // files written before it existed still parse.
  'vertical',
  // Composite inputs (docs/market-discovery.md "Final score formula"), appended for the same reason.
  // `score` above is the composite; `static_score` and `psi_score` stay as informational sub-scores.
  'visual_points',
  'static_v2_score',
  'copyright_years_behind',
  'no_srcset',
  'inline_styles',
  'psi_best_practices',
  'psi_code',
  'pitch',
  // Map pin from Google Places, for showing leads on a map
  'latitude',
  'longitude',
] as const

// Files written before a column existed end where it starts; any header that is the current one
// cut short at or after `notes` parses, with the missing trailing columns read as empty.
const OLDEST_COLUMN_COUNT = CANDIDATE_SCORE_COLUMNS.indexOf('notes') + 1

// CSV cells arrive as strings; typed callers pass real values. Both are accepted.
const csvBoolean = z.preprocess(
  (value) => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean()
)

const csvScore = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim() !== '' ? Number(value) : value,
  z.number().min(0).max(100)
)

// Empty cell = signal unavailable (no PSI key, no Wayback data).
const optionalCsvScore = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  csvScore.nullable()
)

const optionalCsvBoolean = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value === 'true' ? true : value === 'false' ? false : value),
  z.boolean().nullable()
)

const optionalCsvCount = z.preprocess(
  (value) => (value === '' || value === undefined ? null : typeof value === 'string' ? Number(value) : value),
  z.number().int().min(0).nullable()
)

const optionalCsvCoordinate = (limit: number): z.ZodType<number | null, z.ZodTypeDef, unknown> =>
  z.preprocess(
    (value) => (value === '' || value === undefined ? null : typeof value === 'string' ? Number(value) : value),
    z.number().min(-limit).max(limit).nullable()
  )

const optionalCsvDate = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
)

export const candidateScoreSchema = z.object({
  business_name: z.string(),
  phone: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  url: z.string().min(1),
  score: csvScore,
  no_ssl: csvBoolean,
  no_viewport: csvBoolean,
  last_changed: optionalCsvDate,
  old_jquery: csvBoolean,
  old_wp_theme: csvBoolean,
  no_og_tags: csvBoolean,
  table_layout: csvBoolean,
  ie_compatible: csvBoolean,
  static_score: csvScore,
  psi_score: optionalCsvScore,
  psi_performance: optionalCsvScore,
  psi_seo: optionalCsvScore,
  psi_accessibility: optionalCsvScore,
  notes: z.string(),
  vertical: z.preprocess((value) => value ?? '', z.string()),
  visual_points: optionalCsvScore,
  static_v2_score: optionalCsvScore,
  copyright_years_behind: optionalCsvCount,
  no_srcset: optionalCsvBoolean,
  inline_styles: optionalCsvCount,
  psi_best_practices: optionalCsvScore,
  psi_code: optionalCsvScore,
  pitch: optionalCsvBoolean,
  latitude: optionalCsvCoordinate(90),
  longitude: optionalCsvCoordinate(180),
})

export type CandidateScore = z.infer<typeof candidateScoreSchema>

// RFC 4180 subset: comma-separated, double-quoted cells with "" escapes, cells may
// contain commas and newlines. Matches what the pipeline's CSV writer emits.
const parseCsvRecords = (csv: string): string[][] => {
  const records: string[][] = []
  let record: string[] = []
  let cell = ''
  let inQuotes = false

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]

    if (inQuotes) {
      if (char === '"' && csv[i + 1] === '"') {
        cell += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      record.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && csv[i + 1] === '\n') i++
      record.push(cell)
      records.push(record)
      record = []
      cell = ''
    } else {
      cell += char
    }
  }

  if (cell !== '' || record.length > 0) {
    record.push(cell)
    records.push(record)
  }

  return records
}

const isKnownHeader = (header: string[]): boolean =>
  header.length >= OLDEST_COLUMN_COUNT &&
  header.length <= CANDIDATE_SCORE_COLUMNS.length &&
  header.every((column, i) => column === CANDIDATE_SCORE_COLUMNS[i])

/**
 * Parses a candidates.csv file into validated rows. Throws if the header isn't CANDIDATE_SCORE_COLUMNS
 * (or an older file's shorter version of it) or any row fails validation.
 */
export const parseCandidatesCsv = (csv: string): CandidateScore[] => {
  const [header, ...rows] = parseCsvRecords(csv)
  if (!header || !isKnownHeader(header)) {
    throw new Error(
      `candidates.csv header does not match the expected columns: ${CANDIDATE_SCORE_COLUMNS.join(',')}`
    )
  }

  return rows.map((cells, index) => {
    const record = Object.fromEntries(
      CANDIDATE_SCORE_COLUMNS.map((column, columnIndex) => [
        column,
        cells[columnIndex],
      ])
    )
    const parsed = candidateScoreSchema.safeParse(record)
    if (!parsed.success) {
      throw new Error(
        `candidates.csv row ${index + 2} is invalid: ${parsed.error.message}`
      )
    }
    return parsed.data
  })
}
