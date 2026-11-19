import { describe, expect, it } from 'vitest'

import { agreement, spearman } from './visual-eval-metrics.js'

const pair = (human: number, model: number, humanIssues: string[] = [], modelIssues: string[] = []): Parameters<typeof agreement>[0][number] => ({
  human: { overall: human, pitch: human <= 3 ? 'yes' : 'no', issues: humanIssues },
  model: { overall: model, pitch: model <= 3 ? 'yes' : 'no', issues: modelIssues },
})

describe('spearman', () => {
  it('is 1 for the same order and -1 for the reverse', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1)
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1)
  })

  it('handles ties', () => {
    expect(spearman([1, 1, 2, 2], [1, 1, 2, 2])).toBeCloseTo(1)
  })
})

describe('agreement', () => {
  it('reports error, bias, exact and within-one rates', () => {
    const report = agreement([pair(2, 2), pair(3, 4), pair(5, 3)])
    expect(report.meanAbsoluteError).toBeCloseTo(1)
    expect(report.meanBias).toBeCloseTo(-1 / 3)
    expect(report.exactRate).toBeCloseTo(1 / 3)
    expect(report.withinOneRate).toBeCloseTo(2 / 3)
    expect(report.confusion[4]?.[2]).toBe(1)
  })

  it('measures issue tag precision and recall', () => {
    const report = agreement([pair(2, 2, ['cluttered', 'overlay'], ['cluttered', 'no-cta'])])
    expect(report.issuePrecision).toBeCloseTo(0.5)
    expect(report.issueRecall).toBeCloseTo(0.5)
  })
})
