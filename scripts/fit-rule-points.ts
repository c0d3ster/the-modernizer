#!/usr/bin/env tsx
// Fits the rubric's point values to hand ratings, using findings already recorded by eval runs, so it
// costs no API calls. Each rule may only move within its severity band (critical 20-30, major 10-15,
// moderate 4-8, minor 1-4), so the designer's ordering of major and minor flaws is kept.
// Reports cross-validated Spearman (fit on half the sites, test on the other half) against the
// hand-set values, then prints the values fitted on all sites.
//
// Usage: tsx scripts/fit-rule-points.ts <rating dir> <eval result.json>...
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { PROBLEM_RULES } from '@modernizer/design-guide'
import type { RuleScoring } from '@modernizer/design-guide'
import { z } from 'zod'

const findingSchema = z.object({ ruleId: z.string(), extent: z.enum(['full', 'partial']), count: z.number().nullable() })
const resultSchema = z.object({
  sites: z.array(
    z.object({
      name: z.string(),
      human: z.object({ overall: z.number().nullable() }),
      model: z.object({ unassessable: z.boolean(), findings: z.array(findingSchema) }).nullable(),
    })
  ),
})
type Finding = z.infer<typeof findingSchema>

interface Site {
  name: string
  human: number
  // One findings list per eval run that rated the site
  runs: Finding[][]
}

type Points = Record<string, number>

const BANDS: readonly { min: number; max: number }[] = [
  { min: 20, max: 30 },
  { min: 10, max: 15 },
  { min: 4, max: 8 },
  { min: 1, max: 4 },
]
const bandOf = (points: number): { min: number; max: number } => BANDS.find((b) => points >= b.min) ?? { min: 1, max: 4 }

const basePoints = (scoring: RuleScoring): number => scoring.points

/** 100 minus each rule's worst deduction, with `points` per rule (partial is half, rounded up). */
const scoreWith = (findings: readonly Finding[], points: Points): number => {
  const worst = new Map<string, number>()
  for (const f of findings) {
    const rule = PROBLEM_RULES.find((r) => r.id === f.ruleId)
    const p = points[f.ruleId]
    if (!rule || p === undefined) continue
    const lost =
      rule.scoring.type === 'per-unit'
        ? Math.min((f.count ?? 1) * p, rule.scoring.max * (p / rule.scoring.points))
        : f.extent === 'partial'
          ? Math.ceil(p / 2)
          : p
    worst.set(f.ruleId, Math.max(worst.get(f.ruleId) ?? 0, lost))
  }
  return 100 - [...worst.values()].reduce((a, b) => a + b, 0)
}

const ranks = (values: readonly number[]): number[] => {
  const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0])
  const out = Array<number>(values.length).fill(0)
  for (let i = 0; i < order.length; ) {
    let j = i
    while (j + 1 < order.length && order[j + 1]?.[0] === order[i]?.[0]) j++
    for (let k = i; k <= j; k++) out[order[k]?.[1] ?? 0] = (i + j) / 2
    i = j + 1
  }
  return out
}

const spearman = (a: readonly number[], b: readonly number[]): number => {
  const x = ranks(a)
  const y = ranks(b)
  const n = x.length
  const mx = x.reduce((s, v) => s + v, 0) / n
  const my = y.reduce((s, v) => s + v, 0) / n
  let num = 0
  let dx = 0
  let dy = 0
  for (let i = 0; i < n; i++) {
    const ex = (x[i] ?? 0) - mx
    const ey = (y[i] ?? 0) - my
    num += ex * ey
    dx += ex * ex
    dy += ey * ey
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0
}

/** Mean Spearman over runs: each run's points against the hand ratings. */
const fitness = (sites: readonly Site[], points: Points): number => {
  const runCount = Math.max(...sites.map((s) => s.runs.length))
  let total = 0
  for (let r = 0; r < runCount; r++) {
    const rated = sites.filter((s) => s.runs[r])
    total += spearman(
      rated.map((s) => s.human),
      rated.map((s) => scoreWith(s.runs[r] ?? [], points))
    )
  }
  return total / runCount
}

/** Coordinate ascent within each rule's band, a few passes, only for rules the runs actually used. */
const fit = (sites: readonly Site[], start: Points): Points => {
  const used = new Set(sites.flatMap((s) => s.runs.flat().map((f) => f.ruleId)))
  const points = { ...start }
  for (let pass = 0; pass < 4; pass++) {
    let improved = false
    for (const rule of PROBLEM_RULES) {
      if (!used.has(rule.id)) continue
      const band = bandOf(basePoints(rule.scoring))
      let best = points[rule.id] ?? 0
      let bestFit = fitness(sites, points)
      for (let v = band.min; v <= band.max; v++) {
        const f = fitness(sites, { ...points, [rule.id]: v })
        // Ties keep the hand-set value: only move for a real gain
        if (f > bestFit + 1e-4) {
          best = v
          bestFit = f
        }
      }
      if (best !== points[rule.id]) improved = true
      points[rule.id] = best
    }
    if (!improved) break
  }
  return points
}

// Deterministic shuffle so reruns give the same folds
const shuffled = <T>(items: readonly T[], seed: number): T[] => {
  const out = [...items]
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648
    const j = s % (i + 1)
    const a = out[i]
    const b = out[j]
    if (a !== undefined && b !== undefined) {
      out[i] = b
      out[j] = a
    }
  }
  return out
}

const loadSites = async (dir: string, files: readonly string[]): Promise<Site[]> => {
  const byName = new Map<string, Site>()
  for (const [r, file] of files.entries()) {
    const result = resultSchema.parse(JSON.parse(await readFile(path.join(dir, file), 'utf8')))
    for (const s of result.sites) {
      if (!s.model || s.model.unassessable || s.human.overall === null) continue
      const site = byName.get(s.name) ?? { name: s.name, human: s.human.overall, runs: [] }
      site.runs[r] = s.model.findings
      byName.set(s.name, site)
    }
  }
  return [...byName.values()]
}

const main = async (): Promise<void> => {
  const [dir, ...files] = process.argv.slice(2)
  if (!dir || files.length === 0) throw new Error('usage: fit-rule-points.ts <rating dir> <eval result.json>...')
  const sites = await loadSites(dir, files)
  const hand: Points = Object.fromEntries(PROBLEM_RULES.map((r) => [r.id, basePoints(r.scoring)]))

  const folds = 20
  let handTest = 0
  let fitTest = 0
  let wins = 0
  for (let seed = 1; seed <= folds; seed++) {
    const order = shuffled(sites, seed)
    const train = order.slice(0, Math.floor(order.length / 2))
    const test = order.slice(Math.floor(order.length / 2))
    const fitted = fit(train, hand)
    const h = fitness(test, hand)
    const f = fitness(test, fitted)
    handTest += h
    fitTest += f
    if (f > h) wins++
  }
  process.stdout.write(`${sites.length} sites, ${files.length} runs\n`)
  process.stdout.write(`held-out spearman over ${folds} splits: hand-set ${(handTest / folds).toFixed(3)}, fitted ${(fitTest / folds).toFixed(3)} (fitted better on ${wins}/${folds})\n`)
  process.stdout.write(`all sites: hand-set ${fitness(sites, hand).toFixed(3)}\n`)

  const fitted = fit(sites, hand)
  process.stdout.write(`all sites: fitted ${fitness(sites, fitted).toFixed(3)}\nchanged values:\n`)
  for (const rule of PROBLEM_RULES) {
    if (fitted[rule.id] !== hand[rule.id]) process.stdout.write(`  ${rule.id}: ${hand[rule.id]} -> ${fitted[rule.id]}\n`)
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
    process.exit(1)
  })
}
