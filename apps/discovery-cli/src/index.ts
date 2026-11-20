#!/usr/bin/env node
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Command } from 'commander'
import {
  computeFinalScore,
  computeStaticScore,
  computeStaticV2,
  createVisualScorer,
  fetchPsiScore,
  FINAL_SCORE_WEIGHTS,
  PITCH_THRESHOLD,
} from '@modernizer/discovery'
import type { FinalScoreSignal } from '@modernizer/discovery'

const USER_AGENT = 'Mozilla/5.0 (compatible; ModernizerDiscoveryCli/1.0)'

const toHttps = (url: string): string => url.replace(/^http:\/\//i, 'https://')
const toHttp = (url: string): string => url.replace(/^https:\/\//i, 'http://')
const withScheme = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

const fetchHtml = async (url: string): Promise<{ html: string; finalUrl: string }> => {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return { html: await res.text(), finalUrl: res.url || url }
}

// Per docs/market-discovery.md's no_ssl detection: "https:// fetch fails or returns a cert error."
// We probe https first regardless of the scheme the caller passed in, then fall back to http
// so the rest of the signals can still be scored even on a site with no SSL at all.
const fetchWithSslCheck = async (inputUrl: string): Promise<{ html: string; finalUrl: string; noSsl: boolean }> => {
  const httpsUrl = toHttps(withScheme(inputUrl))
  try {
    return { ...(await fetchHtml(httpsUrl)), noSsl: false }
  } catch (err) {
    // fetchHtml throws `HTTP ${status}` after a completed TLS handshake that
    // returned a non-2xx. That's not a missing/invalid cert — don't mark no_ssl
    // or silently score whatever the HTTP fallback happens to return.
    if (err instanceof Error && err.message.startsWith('HTTP ')) throw err
    return { ...(await fetchHtml(toHttp(httpsUrl))), noSsl: true }
  }
}

const LABELS: Record<FinalScoreSignal, string> = {
  visual: 'visual design',
  static: 'static HTML (v2)',
  code: 'build quality (Lighthouse audits)',
  seo: 'SEO',
  accessibility: 'accessibility',
  bestPractices: 'Best Practices',
}

const SIGNAL_ORDER: readonly FinalScoreSignal[] = ['visual', 'static', 'code', 'seo', 'accessibility', 'bestPractices']

const fmt = (value: number | null | undefined): string => (value === null || value === undefined ? 'n/a' : value.toFixed(1))

interface ScoreOptions {
  // commander turns --no-visual into visual: false
  visual: boolean
  shots?: string
}

const program = new Command()

program
  .name('the-modernizer-score')
  .description('Score one site with the discovery composite (docs/market-discovery.md "Final score formula")')
  .version('0.0.0')
  .argument('<url>', 'URL of the site to score')
  .option('--no-visual', 'Skip the visual score (no browser, no Claude cost)')
  .option('--shots <dir>', 'Where to save the screenshots for the visual score (default: a temp folder)')

program.action(async (url: string, opts: ScoreOptions) => {
  try {
    const { html, finalUrl, noSsl } = await fetchWithSslCheck(url)
    // Staleness needs Wayback lookups, which the batch pipeline does; here it's stubbed at 0
    const legacy = computeStaticScore({ html, noSsl, stalenessWeight: 0 })
    const staticV2 = computeStaticV2({ html })

    const useVisual = opts.visual && Boolean(process.env['ANTHROPIC_API_KEY'])
    const scorer = useVisual
      ? createVisualScorer({
          screenshotDir: opts.shots ?? (await mkdtemp(path.join(tmpdir(), 'modernizer-shots-'))),
          onError: (_, message) => process.stderr.write(`  visual score failed: ${message}\n`),
        })
      : null
    const [psi, visual] = await Promise.all([fetchPsiScore(finalUrl), scorer ? scorer.score(finalUrl, 'site') : null]).finally(() => scorer?.close())
    const final = computeFinalScore({ visual: visual?.points ?? null, staticScore: staticV2.score, psiScore: psi })

    const values: Record<FinalScoreSignal, number | null> = {
      visual: visual?.points ?? null,
      static: staticV2.score,
      code: psi?.code ?? null,
      seo: psi?.seo ?? null,
      accessibility: psi?.accessibility ?? null,
      bestPractices: psi?.bestPractices ?? null,
    }
    const out = process.stdout
    out.write(`\n${url}\n`)
    out.write(`  score: ${final.score.toFixed(1)} / 100, ${final.pitch ? 'pitch' : 'above the pitch threshold'} (pitch below ${PITCH_THRESHOLD})\n\n`)
    for (const signal of SIGNAL_ORDER) {
      out.write(`  ${LABELS[signal].padEnd(34)} ${fmt(values[signal]).padStart(5)}  x ${FINAL_SCORE_WEIGHTS[signal]}\n`)
    }
    if (final.missing.length) out.write(`\n  Unavailable (the others were reweighted): ${final.missing.map((s) => LABELS[s]).join(', ')}\n`)
    if (!process.env['PSI_API_KEY']) out.write('  Set PSI_API_KEY for the Lighthouse signals.\n')
    if (opts.visual && !useVisual) out.write('  Set ANTHROPIC_API_KEY for the visual score.\n')
    out.write(
      `\n  static v2: copyright ${staticV2.copyrightYearsBehind ?? 'n/a'} year(s) behind, srcset ${staticV2.noSrcset ? 'missing' : 'present'}, ${staticV2.inlineStyles} inline styles\n` +
        `  not in the score: Lighthouse performance ${fmt(psi?.performance)}, legacy static ${legacy.score.toFixed(1)} (${legacy.notes || 'no signals fired'})\n` +
        (visual ? `  visual scoring cost $${visual.costUsd.toFixed(3)}\n` : '')
    )
  } catch (err) {
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
})

program.parse()
