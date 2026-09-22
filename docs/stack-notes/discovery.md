# Stack: discovery

## `#3` Implement PSI sub-score

Branch: overnight/2026-09-22/01-psi-subscore

### Decisions

- **API key naming — resolved for the whole stack:** separate keys per API, not one
  shared `GOOGLE_API_KEY`. PSI uses `PSI_API_KEY`; `#4` should use `GOOGLE_PLACES_API_KEY`
  for Places (as `#4`'s own task text already proposed). Rationale: Google Cloud API keys
  can be restricted to specific APIs, and separate keys let each be scoped to least
  privilege independently; both tasks' proposed names already assumed separate keys
  before this cross-task consistency check existed, so this just confirms that default
  rather than introducing a new one. `#4` (and any later task reading Places/PSI keys)
  should follow this — do not introduce `GOOGLE_API_KEY`.
- **Auto-degrade on missing key, no CLI flag:** `fetchPsiScore` (in `psi-score.ts`) reads
  `process.env['PSI_API_KEY']` itself and returns `null` immediately if absent — mirrors
  `requestHeroImageBytes`'s `GEMINI_API_KEY` check in
  `packages/generator-claude/src/hero-image.ts`. `apiKey`/`fetchImpl` are injectable via an
  options param for testing, but production callers pass neither.
- **`null` is the "PSI unavailable" signal, not an error:** `fetchPsiScore` returns `null`
  for a missing key, a non-ok HTTP response, a network error, *and* a malformed/partial
  response (Zod schema requires all three Lighthouse categories present — missing any one
  fails validation). All four cases are indistinguishable to the caller by design; PSI
  being flaky isn't a pipeline failure.
- **Static-only fallback lives in `final-score.ts`, not `psi-score.ts`:** `computeFinalScore`
  takes `psiScore: PsiScoreResult | null` and, when `null`, returns
  `{ score: staticScore, psiAvailable: false }` instead of applying the 50/50 weights.
  When PSI is present, `psiAvailable: true` and the documented
  `static × 0.50 + psi × 0.50` formula applies.
- Added `zod` (`^3.24.2`, matching the version already used in `packages/extractor`,
  `packages/generator-claude`, `packages/schema`) as a new dependency of
  `packages/discovery` — this package had no runtime JSON validation before.
- Declared `PSI_API_KEY` in root `turbo.json`'s `globalEnv` (alongside the existing
  `GEMINI_API_KEY`/`ANTHROPIC_API_KEY` entries) — required by the
  `turbo/no-undeclared-env-vars` lint rule.

### Interfaces / exports created (all re-exported from `packages/discovery/src/index.ts`)

- `psi-score.ts`: `computePsiScore(categories: PsiCategoryScores): number` (pure formula,
  unit-tested directly against fixture category scores per the acceptance criteria),
  `fetchPsiScore(url, options?): Promise<PsiScoreResult | null>`, `PSI_SCORE_WEIGHTS`,
  types `PsiCategoryScores`, `PsiScoreResult`, `PsiScoreOptions`.
- `final-score.ts`: `computeFinalScore({ staticScore, psiScore }): FinalScoreResult`,
  `FINAL_SCORE_WEIGHTS`, types `FinalScoreInput`, `FinalScoreResult`
  (`{ score: number; psiAvailable: boolean }`).

### Deviations from acceptance criteria

- **"final score computed end to end for a live URL when key is present"** — not verified
  live in this session: no `PSI_API_KEY` is set in this environment (confirmed absent,
  along with `GOOGLE_API_KEY`/`GOOGLE_PLACES_API_KEY`). The success path is covered by a
  unit test with a mocked `fetchImpl` returning a realistic PSI response shape instead.
  Flagged as `NEEDS HUMAN` in TASKS.md/PR: set `PSI_API_KEY` (a Google Cloud API key with
  the PageSpeed Insights API enabled) and run `computeFinalScore` with `fetchPsiScore`
  against a real URL to confirm end to end.
- All other acceptance criteria (formula unit test, Zod validation, malformed/partial
  result handling, `psiAvailable` field, static-only degrade) are implemented and covered
  by tests in `psi-score.test.ts` and `final-score.test.ts`.
