#!/usr/bin/env tsx
// Inspects and visually scores any list of sites: reference sites to sanity-check the scorer, or
// generated sites served locally to see what the generators get wrong. Writes the inspections,
// screenshots and scores under --out, and prints one line per site plus its deductions.
//
// Usage: tsx --env-file=.env scripts/score-sites.ts --out <dir> name=url [name=url ...]
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Command } from 'commander'
import { inspectSite, launchInspectionBrowser, scoreSiteVisually, visualScoreInputFromInspection } from '@modernizer/discovery'
import type { SiteInspection, VisualScore } from '@modernizer/schema'

interface Scored {
  name: string
  url: string
  score: VisualScore | null
  costUsd: number
  error?: string
  inspection: SiteInspection | null
}

const parseTarget = (arg: string): { name: string; url: string } => {
  const at = arg.indexOf('=')
  if (at < 1) throw new Error(`expected name=url, got "${arg}"`)
  return { name: arg.slice(0, at), url: arg.slice(at + 1) }
}

const scoreOne = async (target: { name: string; url: string }, out: string, browser: Awaited<ReturnType<typeof launchInspectionBrowser>>): Promise<Scored> => {
  try {
    const inspection = await inspectSite(target.url, { browser, screenshotDir: path.join(out, 'shots'), slug: target.name })
    const { score, usage } = await scoreSiteVisually(visualScoreInputFromInspection(inspection))
    return { ...target, score, costUsd: usage.estimatedCostUsd, inspection }
  } catch (err) {
    return { ...target, score: null, costUsd: 0, inspection: null, error: err instanceof Error ? err.message.split('\n')[0] : String(err) }
  }
}

const main = async (): Promise<void> => {
  const program = new Command().requiredOption('--out <dir>', 'output directory').option('--concurrency <n>', 'sites at once', (v) => Number(v), 3).argument('<targets...>', 'name=url pairs').parse()
  const { out, concurrency } = program.opts<{ out: string; concurrency: number }>()
  const targets = program.args.map(parseTarget)
  await mkdir(path.join(out, 'shots'), { recursive: true })

  const browser = await launchInspectionBrowser()
  const results: Scored[] = []
  const queue = targets.values()
  try {
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        for (const target of queue) {
          const result = await scoreOne(target, out, browser)
          results.push(result)
          const s = result.score
          process.stdout.write(
            s
              ? `${target.name.padEnd(28)} ${String(s.points ?? '-').padStart(3)} pts, ${s.overall ?? '-'}/5  ${s.deductions.map((d) => `${d.ruleId} -${d.points}`).join(', ')}\n`
              : `${target.name.padEnd(28)} failed: ${result.error ?? 'unknown'}\n`
          )
        }
      })
    )
  } finally {
    await browser.close()
  }
  const cost = results.reduce((sum, r) => sum + r.costUsd, 0)
  await writeFile(path.join(out, 'scores.json'), JSON.stringify({ scoredAt: new Date().toISOString(), costUsd: cost, results }, null, 1))
  process.stdout.write(`cost $${cost.toFixed(2)}, results in ${path.join(out, 'scores.json')}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
    process.exit(1)
  })
}
