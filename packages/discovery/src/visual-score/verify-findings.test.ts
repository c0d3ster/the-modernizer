import { describe, it, expect } from 'vitest'
import type { VisualFinding } from '@modernizer/schema'

import { applyFindingChecks, findingsToCheck, verifyFindingsText } from './verify-findings.js'
import { buildVerifyRequest, parseVisualScore } from './visual-score.js'

const finding = (ruleId: string, over: Partial<VisualFinding> = {}): VisualFinding => ({ ruleId, extent: 'full', count: null, where: 'laptop', evidence: 'seen', ...over })

describe('applyFindingChecks', () => {
  it('drops, softens and recounts findings', () => {
    const findings = [finding('dated-overall'), finding('header-bars', { count: 2 }), finding('contrast-low'), finding('cta-missing')]
    const checked = applyFindingChecks(findings, [
      { index: 0, verdict: 'drop', count: null, reason: 'only one dated signal' },
      { index: 1, verdict: 'keep', count: 1, reason: 'second bar repeats the phone' },
      { index: 2, verdict: 'partial', count: null, reason: 'only one button' },
    ])
    expect(checked).toEqual([finding('header-bars', { count: 1 }), finding('contrast-low', { extent: 'partial' }), finding('cta-missing')])
  })

  it('drops a counted finding whose corrected count is zero', () => {
    expect(applyFindingChecks([finding('header-bars', { count: 1 })], [{ index: 0, verdict: 'keep', count: 0, reason: 'unique links' }])).toEqual([])
  })
})

describe('findingsToCheck', () => {
  it('only rechecks rules with written exceptions, keeping their positions', () => {
    const items = findingsToCheck([finding('contrast-low'), finding('header-bars', { count: 1 }), finding('cta-missing'), finding('dated-overall')])
    expect(items.map((i) => [i.index, i.finding.ruleId])).toEqual([[1, 'header-bars'], [3, 'dated-overall']])
  })
})

describe('verifyFindingsText', () => {
  it('puts each finding beside its rule text', () => {
    const text = verifyFindingsText([{ index: 0, finding: finding('dated-overall') }])
    expect(text).toContain('Finding 0: [dated-overall]')
    expect(text).toContain('at least three dated signals')
  })
})

describe('parseVisualScore with checks', () => {
  it('counts points after the checks and records them', () => {
    const toolInput = { unassessable: false, overall: 4, pitch: 'maybe', issues: [], findings: [finding('dated-overall')], strengths: [], cantJudge: [], note: 'ok' }
    const score = parseVisualScore(toolInput, { checks: [{ index: 0, verdict: 'drop', count: null, reason: 'design choice' }] })
    expect(score.points).toBe(100)
    expect(score.findings).toEqual([])
    expect(score.checks).toEqual([{ index: 0, verdict: 'drop', count: null, reason: 'design choice', ruleId: 'dated-overall' }])
  })
})

describe('buildVerifyRequest', () => {
  it('continues the conversation with a tool result and the check question', () => {
    const first = { model: 'claude-sonnet-5', max_tokens: 100, messages: [{ role: 'user' as const, content: 'rate it' }] }
    const request = buildVerifyRequest(first, { content: [] }, 'toolu_1', [{ index: 0, finding: finding('dated-overall') }], 'claude-sonnet-5')
    expect(request.tool_choice).toEqual({ type: 'tool', name: 'record_finding_checks' })
    expect(request.messages).toHaveLength(3)
    const last = request.messages[2]
    expect(Array.isArray(last?.content) && last.content[0]).toMatchObject({ type: 'tool_result', tool_use_id: 'toolu_1' })
  })
})
