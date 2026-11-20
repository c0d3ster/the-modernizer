import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SiteSchema } from '@modernizer/schema'
import { urlToRoutePath, urlToComponentName } from './route-mapper.js'
import { copyComponents } from './component-copier.js'
import { generatePage } from './page-generator.js'
import { generateLayout, generateGlobalsCss, buildNav, navSource } from './layout-generator.js'
import { generateReport } from './report-generator.js'
import { placeBlocks } from './block-placer.js'
import { synthesizeGallery, synthesizeHero, synthesizePageHeaders } from './hero-synthesizer.js'
import { resolveSiteStyle } from './site-style.js'
import { shortenHeroLeads } from './hero-lead.js'
import {
  generatePackageJson,
  generateNextConfig,
  generateTsConfig,
  generatePostcss,
  generatePrettier,
  generateEslint,
  collectImageHostnames,
  generateIconSvg,
  resolvePalette,
} from '@modernizer/generator-config'

/** Files in `packages/generator/sample-assets/` are copied to `<output>/public/` (Next.js static URL root). */
const copySampleAssetsToPublic = async (outputDir: string): Promise<void> => {
  const sampleDir = join(dirname(fileURLToPath(import.meta.url)), '../sample-assets')
  let entries: string[]
  try {
    entries = await readdir(sampleDir)
  } catch {
    return
  }
  const files = entries.filter((n) => !n.startsWith('.') && n !== 'README.md')
  if (files.length === 0) return
  const publicDir = join(outputDir, 'public')
  await mkdir(publicDir, { recursive: true })
  await Promise.all(files.map((name) => copyFile(join(sampleDir, name), join(publicDir, name))))
}

export const generateSite = async (schema: SiteSchema, outputDir: string): Promise<void> => {
  // 0. Apply intelligent block placement rules (contact info → footer, etc.)
  const { schema: placedSchema } = placeBlocks(schema)
  // The business's vertical decides fonts, neutrals, hero style and the main action
  const style = resolveSiteStyle(placedSchema)
  schema = synthesizeHero(placedSchema, style.primaryAction)
  schema = synthesizePageHeaders(schema)
  // Long welcome paragraphs leave the hero; the overflow follows it as a text section
  schema = shortenHeroLeads(schema)
  schema = synthesizeGallery(schema)

  // 1. Copy component library (shadcn primitives, blocks, layout, lib, styles, schema types)
  await copyComponents(outputDir)
  await copySampleAssetsToPublic(outputDir)

  // 2. Config files at project root
  const base = schema.rootUrl
  const navMaxItems = schema.generator?.navMaxItems ?? 7
  const pagePathnames = new Set(
    schema.pages.map((p) => {
      try {
        return new URL(p.url, base).pathname.replace(/\/$/, '') || '/'
      } catch {
        return p.url
      }
    })
  )
  const nav = buildNav(navSource(schema), base, pagePathnames, navMaxItems)

  await Promise.all([
    writeFile(join(outputDir, 'package.json'), generatePackageJson(schema)),
    writeFile(join(outputDir, 'next.config.ts'), generateNextConfig(collectImageHostnames(schema))),
    writeFile(join(outputDir, 'tsconfig.json'), generateTsConfig()),
    writeFile(join(outputDir, 'postcss.config.mjs'), generatePostcss()),
    writeFile(join(outputDir, 'prettier.config.mjs'), generatePrettier()),
    writeFile(join(outputDir, 'eslint.config.mjs'), generateEslint()),
    writeFile(join(outputDir, 'MODERNIZATION_REPORT.md'), generateReport(schema, nav)),
  ])

  // 3. App directory: layout, global styles and the favicon (Next.js links src/app/icon.svg itself)
  await mkdir(join(outputDir, 'src/app'), { recursive: true })
  await Promise.all([
    writeFile(join(outputDir, 'src/app/globals.css'), generateGlobalsCss(schema.brandColors, style.profile.theme)),
    writeFile(join(outputDir, 'src/app/layout.tsx'), generateLayout(schema, style)),
    writeFile(join(outputDir, 'src/app/icon.svg'), generateIconSvg(schema.siteName, resolvePalette(schema.brandColors, style.profile.theme))),
  ])

  // 4. One page file per PageSchema
  await Promise.all(
    schema.pages.map(async (page) => {
      const routePath = urlToRoutePath(page.url, base)
      const componentName = urlToComponentName(page.url, base)
      const pageDir = join(outputDir, dirname(routePath))
      await mkdir(pageDir, { recursive: true })
      await writeFile(join(outputDir, routePath), generatePage(page, componentName, { variant: style.profile.hero.variant, secondaryCta: style.callAction ?? undefined }))
    })
  )
}

export type { SiteSchema }
