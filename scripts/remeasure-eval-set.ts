#!/usr/bin/env tsx
// Adds the laptop measurements introduced after an eval set was built (header bands, sticky header)
// by reloading each site, without retaking screenshots or calling the API.
// Usage: tsx scripts/remeasure-eval-set.ts <eval set.json> <out.json>
import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { launchInspectionBrowser, remeasureLaptop } from '@modernizer/discovery'
import { siteInspectionSchema } from '@modernizer/schema'
import { z } from 'zod'

const evalSetSchema = z.object({ items: z.array(z.object({ name: z.string(), inspection: siteInspectionSchema }).passthrough()) }).passthrough()

const main = async (): Promise<void> => {
  const [input, output] = process.argv.slice(2)
  if (!input || !output) throw new Error('usage: remeasure-eval-set.ts <eval set.json> <out.json>')
  const set = evalSetSchema.parse(JSON.parse(await readFile(input, 'utf8')))
  const browser = await launchInspectionBrowser()
  try {
    const queue = set.items.entries()
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        for (const [i, item] of queue) {
          const inspection = await remeasureLaptop(item.inspection, browser)
          set.items[i] = { ...item, inspection }
          const laptop = inspection.views.find((v) => v.viewport === 'desktop')
          process.stdout.write(`${item.name}: ${laptop?.features?.headerBands?.length ?? '-'} bands, sticky ${laptop?.headerSticks ?? '-'}\n`)
        }
      })
    )
  } finally {
    await browser.close()
  }
  await writeFile(output, JSON.stringify(set, null, 1))
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`)
    process.exit(1)
  })
}
