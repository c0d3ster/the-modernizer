#!/usr/bin/env tsx
// Runs the visual scorer over hand-rated sites and reports how closely it matches the designer.
// Input is the eval set from leads/tools/build-visual-eval.mjs: [{ siteId, name, slug, inspection, human }].
// Results go to <out> as JSON (one entry per site plus the agreement report).
import { appendFile, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

import { Command } from 'commander'
import { RUBRIC_VERSION, scoreSiteVisually, visualScoreInputFromInspection } from '@modernizer/discovery'
import { siteInspectionSchema, visualScoreSchema } from '@modernizer/schema'
import type { VisualScore } from '@modernizer/schema'
import { z } from 'zod'

import { agreement } from './visual-eval-metrics.js'

const evalSetSchema = z.object({
  items: z.array(
    z.object({
      siteId: z.string(),
      name: z.string(),
      slug: z.string(),
      inspection: siteInspectionSchema,
      human: z.object({ overall: z.number().int().min(1).max(5), pitch: z.enum(['yes', 'maybe', 'no']).nullable(), issues: z.array(z.string()), note: z.string() }),
    })
  ),
})
type EvalItem = z.infer<typeof evalSetSchema>['items'][number]

const resultSchema = z.object({ siteId: z.string(), score: visualScoreSchema, costUsd: z.number() })
type SiteResult = z.infer<typeof resultSchema>

interface Options {
  out: string
  limit?: number
  only?: string
  effort: 'low' | 'medium' | 'high'
  thinking: 'off' | 'adaptive'
  concurrency: number
}

const readDone = async (progressPath: string): Promise<Map<string, SiteResult>> => {
  if (!existsSync(progressPath)) return new Map()
  const lines = (await readFile(progressPath, 'utf-8')).split('\n').filter(Boolean)
  return new Map(lines.map((l) => resultSchema.parse(JSON.parse(l))).map((r) => [r.siteId, r]))
}

const pad = (s: string | number, n: number): string => String(s).padEnd(n)

const run = async (evalPath: string, options: Options): Promise<void> => {
  const { items } = evalSetSchema.parse(JSON.parse(await readFile(evalPath, 'utf-8')))
  const selected = items.filter((i) => !options.only || i.slug.startsWith(options.only)).slice(0, options.limit ?? items.length)
  // One line per finished site, so a stopped run resumes without paying twice
  const progressPath = `${options.out}l`
  const done = await readDone(progressPath)
  const todo = selected.filter((i) => !done.has(i.siteId))
  process.stderr.write(`rubric ${RUBRIC_VERSION}, ${selected.length} sites (${done.size} already scored), effort ${options.effort}, thinking ${options.thinking}\n`)

  const queue = todo.values()
  const worker = async (): Promise<void> => {
    for (const item of queue) {
      try {
        const { score, usage } = await scoreSiteVisually(visualScoreInputFromInspection(item.inspection), { effort: options.effort, thinking: options.thinking })
        const result: SiteResult = { siteId: item.siteId, score, costUsd: usage.estimatedCostUsd }
        done.set(item.siteId, result)
        await appendFile(progressPath, `${JSON.stringify(result)}\n`)
        process.stderr.write(`[${done.size}/${selected.length}] ${item.name}: human ${item.human.overall}, model ${score.overall ?? 'n/a'}\n`)
      } catch (err) {
        process.stderr.write(`failed ${item.name}: ${err instanceof Error ? err.message : String(err)}\n`)
      }
    }
  }
  await Promise.all(Array.from({ length: options.concurrency }, worker))

  const scored = selected.flatMap((item): { item: EvalItem; score: VisualScore; costUsd: number }[] => {
    const r = done.get(item.siteId)
    return r ? [{ item, score: r.score, costUsd: r.costUsd }] : []
  })
  const pairs = scored.flatMap(({ item, score }) =>
    score.overall === null ? [] : [{ human: item.human, model: { overall: score.overall, pitch: score.pitch, issues: score.issues } }]
  )
  const report = agreement(pairs)
  const cost = scored.reduce((sum, s) => sum + s.costUsd, 0)
  await writeFile(
    options.out,
    JSON.stringify({ rubric: RUBRIC_VERSION, effort: options.effort, thinking: options.thinking, report, costUsd: cost, sites: scored.map(({ item, score }) => ({ name: item.name, human: item.human, model: score })) }, null, 1)
  )

  const pct = (x: number): string => `${Math.round(x * 100)}%`
  console.log(`\n${report.count} sites rated by both (${scored.length - pairs.length} the model could not assess)`)
  console.log(`mean abs error ${report.meanAbsoluteError.toFixed(2)}, bias ${report.meanBias >= 0 ? '+' : ''}${report.meanBias.toFixed(2)}, exact ${pct(report.exactRate)}, within one ${pct(report.withinOneRate)}, spearman ${report.spearman.toFixed(2)}`)
  console.log(`pitch agreement ${pct(report.pitchAgreementRate)}, issue tags precision ${pct(report.issuePrecision)} recall ${pct(report.issueRecall)}`)
  console.log('\nconfusion (rows human 1-5, columns model 1-5)')
  report.confusion.forEach((row, i) => console.log(`  ${i + 1}: ${row.map((n) => pad(n, 3)).join('')}`))
  console.log('\nlargest disagreements')
  scored
    .filter(({ score, item }) => score.overall !== null && Math.abs(score.overall - item.human.overall) >= 2)
    .forEach(({ item, score }) => console.log(`  ${pad(item.name, 44)} human ${item.human.overall} model ${score.overall}: ${score.note}`))
  console.log(`\nestimated cost $${cost.toFixed(2)}, results in ${options.out}`)
}

const main = async (): Promise<void> => {
  const program = new Command()
    .argument('<eval-set>', 'eval set JSON from leads/tools/build-visual-eval.mjs')
    .option('--out <path>', 'results JSON (a .jsonl beside it tracks progress)', 'visual-eval-results.json')
    .option('--limit <n>', 'only the first n sites', (v) => Number(v))
    .option('--only <slug>', 'only sites whose slug starts with this')
    .option('--effort <level>', 'model effort: low, medium or high', 'medium')
    .option('--thinking <mode>', 'off or adaptive', 'adaptive')
    .option('--concurrency <n>', 'parallel requests', (v) => Number(v), 4)
    .parse()
  const [evalPath] = program.args
  const raw = program.opts<Record<string, unknown>>()
  const options = z
    .object({ out: z.string(), limit: z.number().int().positive().optional(), only: z.string().optional(), effort: z.enum(['low', 'medium', 'high']), thinking: z.enum(['off', 'adaptive']), concurrency: z.number().int().positive() })
    .parse(raw)
  if (!evalPath) throw new Error('eval set path is required')
  await run(evalPath, options)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
    process.exit(1)
  })
}
