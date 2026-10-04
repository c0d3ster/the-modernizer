import { z } from 'zod'

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
] as const

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

/**
 * Parses a candidates.csv file into validated rows. Throws if the header doesn't match
 * CANDIDATE_SCORE_COLUMNS exactly or any row fails validation.
 */
export const parseCandidatesCsv = (csv: string): CandidateScore[] => {
  const [header, ...rows] = parseCsvRecords(csv)
  if (!header || header.join(',') !== CANDIDATE_SCORE_COLUMNS.join(',')) {
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
