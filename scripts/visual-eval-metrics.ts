// Agreement between the visual scorer and hand ratings from the Site Rating Bench.

export interface RatedPair {
  human: { overall: number; pitch: string | null; issues: string[] }
  model: { overall: number; pitch: string | null; issues: string[] }
}

export interface AgreementReport {
  count: number
  meanAbsoluteError: number
  // Model minus human, averaged: positive means the model rates higher than the designer
  meanBias: number
  exactRate: number
  withinOneRate: number
  spearman: number
  pitchAgreementRate: number
  issuePrecision: number
  issueRecall: number
  // confusion[human - 1][model - 1]
  confusion: number[][]
}

const mean = (values: number[]): number => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0)

// Average ranks, with ties sharing the mean of the ranks they span
const ranks = (values: number[]): number[] => {
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v)
  const out = new Array<number>(values.length).fill(0)
  for (let start = 0; start < order.length; ) {
    let end = start
    while (end + 1 < order.length && order[end + 1]?.v === order[start]?.v) end += 1
    const rank = (start + end) / 2 + 1
    for (let k = start; k <= end; k += 1) {
      const item = order[k]
      if (item) out[item.i] = rank
    }
    start = end + 1
  }
  return out
}

export const spearman = (a: number[], b: number[]): number => {
  const ra = ranks(a)
  const rb = ranks(b)
  const ma = mean(ra)
  const mb = mean(rb)
  let cov = 0
  let va = 0
  let vb = 0
  ra.forEach((x, i) => {
    const y = rb[i] ?? 0
    cov += (x - ma) * (y - mb)
    va += (x - ma) ** 2
    vb += (y - mb) ** 2
  })
  return va && vb ? cov / Math.sqrt(va * vb) : 0
}

export const agreement = (pairs: RatedPair[]): AgreementReport => {
  const diffs = pairs.map((p) => p.model.overall - p.human.overall)
  const confusion = Array.from({ length: 5 }, () => new Array<number>(5).fill(0))
  for (const { human, model } of pairs) {
    const row = confusion[human.overall - 1]
    if (row) row[model.overall - 1] = (row[model.overall - 1] ?? 0) + 1
  }
  let truePositive = 0
  let predicted = 0
  let actual = 0
  for (const { human, model } of pairs) {
    const wanted = new Set(human.issues)
    predicted += model.issues.length
    actual += wanted.size
    truePositive += model.issues.filter((i) => wanted.has(i)).length
  }
  const withPitch = pairs.filter((p) => p.human.pitch !== null)
  return {
    count: pairs.length,
    meanAbsoluteError: mean(diffs.map(Math.abs)),
    meanBias: mean(diffs),
    exactRate: mean(diffs.map((d) => (d === 0 ? 1 : 0))),
    withinOneRate: mean(diffs.map((d) => (Math.abs(d) <= 1 ? 1 : 0))),
    spearman: spearman(
      pairs.map((p) => p.human.overall),
      pairs.map((p) => p.model.overall)
    ),
    pitchAgreementRate: mean(withPitch.map((p) => (p.model.pitch === p.human.pitch ? 1 : 0))),
    issuePrecision: predicted ? truePositive / predicted : 0,
    issueRecall: actual ? truePositive / actual : 0,
    confusion,
  }
}
