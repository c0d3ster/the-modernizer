#!/usr/bin/env node
import { Command } from 'commander'
import { computeStaticScore } from '@modernizer/discovery'

const USER_AGENT = 'Mozilla/5.0 (compatible; ModernizerDiscoveryCli/1.0)'

const toHttps = (url: string): string => url.replace(/^http:\/\//i, 'https://')
const toHttp = (url: string): string => url.replace(/^https:\/\//i, 'http://')
const withScheme = (url: string): string => (/^https?:\/\//i.test(url) ? url : `https://${url}`)

const fetchHtml = async (url: string): Promise<string> => {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

// Per docs/market-discovery.md's no_ssl detection: "https:// fetch fails or returns a cert error."
// We probe https first regardless of the scheme the caller passed in, then fall back to http
// so the rest of the signals can still be scored even on a site with no SSL at all.
const fetchWithSslCheck = async (
  inputUrl: string
): Promise<{ html: string; noSsl: boolean }> => {
  const httpsUrl = toHttps(withScheme(inputUrl))
  try {
    return { html: await fetchHtml(httpsUrl), noSsl: false }
  } catch {
    return { html: await fetchHtml(toHttp(httpsUrl)), noSsl: true }
  }
}

const program = new Command()

program
  .name('the-modernizer-score')
  .description('Score a candidate site for modernization potential (static HTML signals only, for now)')
  .version('0.0.0')
  .argument('<url>', 'URL of the site to score')

program.action(async (url: string) => {
  try {
    const { html, noSsl } = await fetchWithSslCheck(url)

    // Staleness (#2) and PSI (#3) aren't implemented yet — see TASKS.md. stalenessWeight is
    // stubbed at 0 rather than silently treating an unscored dimension as "not stale".
    const result = computeStaticScore({ html, noSsl, stalenessWeight: 0 })

    process.stdout.write(`\n${url}\n`)
    process.stdout.write(`  static_score: ${result.score.toFixed(1)} / 100\n`)
    process.stdout.write(`  signals: ${result.notes || '(none fired)'}\n`)
    process.stdout.write(
      `\n  Note: static_score only. Staleness weight is stubbed at 0 and the PSI sub-score\n` +
        `  isn't implemented yet, so this is not the final modernity score from\n` +
        `  docs/market-discovery.md (final = static x 0.50 + psi x 0.50).\n`
    )
  } catch (err) {
    process.stderr.write(`\nError: ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }
})

program.parse()
