/**
 * Kairos Recommendation Engine
 *
 * Produces an enriched buy/sell/hold signal by combining three independent signals:
 *
 *   1. Momentum   (40%) — multi-timeframe price returns from daily candles
 *   2. Sentiment  (35%) — Finnhub pre-computed news sentiment, with Loughran-McDonald lexicon fallback
 *   3. Fundamentals (25%) — P/E, 52-week range position, revenue growth, beta
 *
 * Each signal is normalised to [-1, +1] before weighting.
 * Composite score maps to buy (> +0.12), sell (< -0.12), or hold.
 * Confidence is derived from the magnitude and agreement of the signals.
 */

import {
  fetchQuote,
  fetchCompanyNews,
  fetchNewsSentiment,
  fetchBasicMetrics,
  fetchClosingPrices,
  type BasicMetrics,
  type StockGuidance,
  type SignalDetail,
  type SignalBreakdown,
} from './priceService'
import { scoreSentimentFromText } from './sentimentLexicon'

export type RecommendationProfile = 'default' | 'aggressive' | 'balanced' | 'conservative'

const SENTIMENT_CACHE_STORAGE_KEY = 'kairos-sentiment-cache-v1'

type CachedSentimentEntry = {
  short: number
  mid: number
  long: number
  source: 'finnhub' | 'lexicon' | 'hybrid'
  updatedAt: number
}

const sentimentCache = new Map<string, CachedSentimentEntry>()
let hasHydratedSentimentCache = false

interface ProfileConfig {
  signalWeights: {
    momentum: number
    sentiment: number
    fundamentals: number
  }
  sentimentHorizonWeights: {
    short: number
    mid: number
    long: number
  }
  actionThresholds: {
    buy: number
    sell: number
  }
}

export interface ProfileVisualConfig {
  signalWeights: {
    momentum: number
    sentiment: number
    fundamentals: number
  }
  sentimentHorizonWeights: {
    short: number
    mid: number
    long: number
  }
  actionThresholds: {
    buy: number
    sell: number
  }
}

const PROFILE_CONFIG: Record<RecommendationProfile, ProfileConfig> = {
  default: {
    // Combines all profiles: averaged signal balance and medium thresholds.
    signalWeights: { momentum: 0.39, sentiment: 0.33, fundamentals: 0.28 },
    sentimentHorizonWeights: { short: 0.48, mid: 0.30, long: 0.22 },
    actionThresholds: { buy: 0.13, sell: -0.13 },
  },
  aggressive: {
    signalWeights: { momentum: 0.50, sentiment: 0.35, fundamentals: 0.15 },
    sentimentHorizonWeights: { short: 0.65, mid: 0.25, long: 0.10 },
    actionThresholds: { buy: 0.08, sell: -0.08 },
  },
  balanced: {
    signalWeights: { momentum: 0.40, sentiment: 0.35, fundamentals: 0.25 },
    sentimentHorizonWeights: { short: 0.50, mid: 0.30, long: 0.20 },
    actionThresholds: { buy: 0.12, sell: -0.12 },
  },
  conservative: {
    signalWeights: { momentum: 0.28, sentiment: 0.30, fundamentals: 0.42 },
    sentimentHorizonWeights: { short: 0.30, mid: 0.35, long: 0.35 },
    actionThresholds: { buy: 0.18, sell: -0.18 },
  },
}

export function getProfileVisualConfig(profile: RecommendationProfile): ProfileVisualConfig {
  const config = PROFILE_CONFIG[profile]
  return {
    signalWeights: { ...config.signalWeights },
    sentimentHorizonWeights: { ...config.sentimentHorizonWeights },
    actionThresholds: { ...config.actionThresholds },
  }
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

/** Percent return between two prices */
function pctReturn(from: number, to: number): number {
  if (!from) return 0
  return (to - from) / from
}

/** Map a raw percent return to a normalised [-1, +1] score using a soft sigmoid shape. */
function returnToScore(ret: number, sensitivity = 10): number {
  // tanh gives smooth normalisation; sensitivity controls how quickly it saturates
  return Math.tanh(ret * sensitivity)
}

function signalLabel(score: number): string {
  if (score >= 0.6) return 'Strongly Bullish'
  if (score >= 0.2) return 'Bullish'
  if (score > -0.2) return 'Neutral'
  if (score > -0.6) return 'Bearish'
  return 'Strongly Bearish'
}

function signalMeaning(score: number, domain: 'momentum' | 'sentiment' | 'fundamentals'): string {
  const direction = signalLabel(score)
  if (domain === 'momentum') {
    if (direction === 'Neutral') return 'Price trend is mixed with no clear directional edge.'
    return `Price trend is ${direction.toLowerCase()} across recent periods.`
  }
  if (domain === 'sentiment') {
    if (direction === 'Neutral') return 'News flow is balanced with no strong sentiment skew.'
    return `News flow is ${direction.toLowerCase()} based on recent coverage.`
  }
  if (direction === 'Neutral') return 'Business quality and valuation signals are broadly balanced.'
  return `Fundamental setup is ${direction.toLowerCase()} based on valuation, growth, and range context.`
}

function formatEvidence(evidence: string[]): string {
  if (evidence.length === 0) return ''
  return ` Evidence: ${evidence.join(' | ')}`
}

function hydrateSentimentCache() {
  if (hasHydratedSentimentCache || typeof window === 'undefined') return
  hasHydratedSentimentCache = true
  try {
    const raw = window.localStorage.getItem(SENTIMENT_CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, CachedSentimentEntry>
    Object.entries(parsed).forEach(([symbol, entry]) => {
      if (
        entry &&
        typeof entry.short === 'number' &&
        typeof entry.mid === 'number' &&
        typeof entry.long === 'number' &&
        typeof entry.updatedAt === 'number'
      ) {
        sentimentCache.set(symbol, entry)
      }
    })
  } catch {
    // ignore invalid payloads
  }
}

function persistSentimentCache() {
  if (typeof window === 'undefined') return
  try {
    const payload: Record<string, CachedSentimentEntry> = {}
    sentimentCache.forEach((entry, symbol) => {
      payload[symbol] = entry
    })
    window.localStorage.setItem(SENTIMENT_CACHE_STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // ignore storage failures
  }
}

function cacheSentiment(symbol: string, entry: CachedSentimentEntry) {
  sentimentCache.set(symbol, entry)
  persistSentimentCache()
}

function scoreFromHorizons(
  horizons: { short: number; mid: number; long: number },
  profile: RecommendationProfile,
): number {
  const weights = PROFILE_CONFIG[profile].sentimentHorizonWeights
  return clamp(
    horizons.short * weights.short + horizons.mid * weights.mid + horizons.long * weights.long,
    -1,
    1,
  )
}

// ─── Signal 1: Momentum ───────────────────────────────────────────────────────

interface MomentumSignal extends SignalDetail {
  timeframes: string[]
}

function computeMomentumSignal(closes: number[], intradayPct: number): MomentumSignal {
  if (closes.length < 2) {
    const s = returnToScore(intradayPct / 100, 10)
    return {
      score: s,
      label: signalLabel(s),
      detail: `${signalMeaning(s, 'momentum')}${formatEvidence([
        `today move ${intradayPct >= 0 ? '+' : ''}${intradayPct.toFixed(2)}%`,
        'historical prices unavailable',
      ])}`,
      timeframes: ['1D'],
    }
  }

  const latest = closes[closes.length - 1]

  const get = (daysBack: number) =>
    closes.length > daysBack ? closes[closes.length - 1 - daysBack] : null

  const day1  = get(1)
  const day5  = get(5)
  const day21 = get(21)
  const day63 = get(63)

  const timeframes: string[] = []
  let weightedScore = 0
  let totalWeight   = 0

  const add = (ref: number | null, label: string, weight: number) => {
    if (ref === null) return
    const ret   = pctReturn(ref, latest)
    const score = returnToScore(ret)
    weightedScore += score * weight
    totalWeight   += weight
    timeframes.push(`${label}: ${ret >= 0 ? '+' : ''}${(ret * 100).toFixed(1)}%`)
  }

  add(day1,  'Today',         0.15)
  add(day5,  'Past week',     0.25)
  add(day21, 'Past month',    0.30)
  add(day63, 'Past 3 months', 0.30)

  const score = totalWeight > 0 ? clamp(weightedScore / totalWeight, -1, 1) : 0

  return {
    score,
    label: signalLabel(score),
    detail: `${signalMeaning(score, 'momentum')}${formatEvidence(timeframes)}`,
    timeframes,
  }
}

// ─── Signal 2: Sentiment ──────────────────────────────────────────────────────

type SentimentSignal = SignalDetail & {
  source: 'finnhub' | 'lexicon' | 'hybrid' | 'none'
  horizons?: {
    short: number
    mid: number
    long: number
  }
}

function scoreNewsWindow(news: Array<{ headline: string; summary: string }>): number {
  if (news.length === 0) return 0
  const perHeadlineScores = news.map((n) => scoreSentimentFromText(`${n.headline} ${n.summary}`))
  const sum = perHeadlineScores.reduce((acc, s) => acc + s, 0)
  return clamp(sum / news.length, -1, 1)
}

async function computeSentimentSignal(
  symbol: string,
  profile: RecommendationProfile,
  companyName?: string,
): Promise<SentimentSignal> {
  hydrateSentimentCache()

  const profileConfig = PROFILE_CONFIG[profile]
  const horizonWeights = profileConfig.sentimentHorizonWeights

  const [shortNews, midNews, longNews] = await Promise.all([
    fetchCompanyNews(symbol, 1, 12, companyName, true),
    fetchCompanyNews(symbol, 7, 28, companyName, true),
    fetchCompanyNews(symbol, 30, 50, companyName, true),
  ])

  const short = scoreNewsWindow(shortNews)
  const midLex = scoreNewsWindow(midNews)
  const long = scoreNewsWindow(longNews)

  const lexiconScore = clamp(
    short * horizonWeights.short + midLex * horizonWeights.mid + long * horizonWeights.long,
    -1,
    1,
  )

  const finnhubSentiment = await fetchNewsSentiment(symbol)
  if (finnhubSentiment && (finnhubSentiment.bullishPercent + finnhubSentiment.bearishPercent) > 0) {
    const finnhubMid = clamp((finnhubSentiment.bullishPercent - 0.5) * 2, -1, 1)
    const mid = clamp(midLex * 0.4 + finnhubMid * 0.6, -1, 1)
    const score = clamp(
      short * horizonWeights.short + mid * horizonWeights.mid + long * horizonWeights.long,
      -1,
      1,
    )

    cacheSentiment(symbol, {
      short,
      mid,
      long,
      source: 'hybrid',
      updatedAt: Date.now(),
    })

    return {
      score,
      label: signalLabel(score),
      detail: `${signalMeaning(score, 'sentiment')}${formatEvidence([
        `Today ${short >= 0 ? '+' : ''}${short.toFixed(2)}`,
        `Past week ${mid >= 0 ? '+' : ''}${mid.toFixed(2)}`,
        `Past month ${long >= 0 ? '+' : ''}${long.toFixed(2)}`,
        `${Math.round(finnhubSentiment.bullishPercent * 100)}% positive / ${Math.round(finnhubSentiment.bearishPercent * 100)}% negative news (provider data)`,
      ])}`,
      source: 'hybrid',
      horizons: { short, mid, long },
    }
  }

  if (shortNews.length + midNews.length + longNews.length > 0) {
    cacheSentiment(symbol, {
      short,
      mid: midLex,
      long,
      source: 'lexicon',
      updatedAt: Date.now(),
    })
  }

  if (shortNews.length + midNews.length + longNews.length === 0) {
    const cached = sentimentCache.get(symbol)
    if (cached) {
      const cachedScore = scoreFromHorizons(
        { short: cached.short, mid: cached.mid, long: cached.long },
        profile,
      )
      return {
        score: cachedScore,
        label: signalLabel(cachedScore),
        detail: `${signalMeaning(cachedScore, 'sentiment')}${formatEvidence([
          `Today ${cached.short >= 0 ? '+' : ''}${cached.short.toFixed(2)}`,
          `Past week ${cached.mid >= 0 ? '+' : ''}${cached.mid.toFixed(2)}`,
          `Past month ${cached.long >= 0 ? '+' : ''}${cached.long.toFixed(2)}`,
          `reused last valid sentiment (${Math.round((Date.now() - cached.updatedAt) / 60000)}m old)`,
        ])}`,
        source: cached.source,
        horizons: { short: cached.short, mid: cached.mid, long: cached.long },
      }
    }

    return {
      score: 0,
      label: 'Neutral',
      detail: 'News flow is neutral due to limited data. Evidence: no recent headlines available for scoring.',
      source: 'none',
      horizons: { short: 0, mid: 0, long: 0 },
    }
  }

  return {
    score: lexiconScore,
    label: signalLabel(lexiconScore),
    detail: `${signalMeaning(lexiconScore, 'sentiment')}${formatEvidence([
      `Today ${short >= 0 ? '+' : ''}${short.toFixed(2)}`,
      `Past week ${midLex >= 0 ? '+' : ''}${midLex.toFixed(2)}`,
      `Past month ${long >= 0 ? '+' : ''}${long.toFixed(2)}`,
      'headline text analysis',
    ])}`,
    source: 'lexicon',
    horizons: { short, mid: midLex, long },
  }
}

// ─── Signal 3: Fundamentals ───────────────────────────────────────────────────

function computeFundamentalsSignal(metrics: BasicMetrics | null, currentPrice: number): SignalDetail {
  if (!metrics) {
    return {
      score: 0,
      label: 'Neutral',
      detail: 'Fundamentals are neutral due to missing data. Evidence: valuation/growth metrics unavailable for this symbol.',
    }
  }

  let score          = 0
  const contributions: string[] = []

  // P/E ratio
  if (metrics.peRatio !== null && metrics.peRatio > 0) {
    if (metrics.peRatio < 15) {
      score += 0.35
      contributions.push(`Valuation is in a lower range (P/E ${metrics.peRatio.toFixed(1)}), which can indicate better value`)
    } else if (metrics.peRatio < 25) {
      score += 0.10
      contributions.push(`Valuation looks reasonable (P/E ${metrics.peRatio.toFixed(1)})`)
    } else if (metrics.peRatio > 40) {
      score -= 0.30
      contributions.push(`Valuation is expensive (P/E ${metrics.peRatio.toFixed(1)}), which can raise downside risk`)
    } else {
      contributions.push(`Valuation multiple (P/E) is ${metrics.peRatio.toFixed(1)}`)
    }
  }

  // 12-month range position — where is price relative to its annual range?
  if (metrics.weekHigh52 !== null && metrics.weekLow52 !== null && metrics.weekHigh52 > metrics.weekLow52) {
    const range    = metrics.weekHigh52 - metrics.weekLow52
    const position = (currentPrice - metrics.weekLow52) / range  // 0 = at low, 1 = at high

    if (position < 0.20) {
      score += 0.35
      contributions.push(`Price is near its 12-month low ($${metrics.weekLow52.toFixed(2)}), which may offer better entry value`)
    } else if (position > 0.90) {
      score -= 0.20
      contributions.push(`Price is near its 12-month high ($${metrics.weekHigh52.toFixed(2)}), so near-term upside may be smaller`)
    } else {
      contributions.push(`Price is around the middle of its 12-month range (${Math.round(position * 100)}%)`)
    }
  }

  // Revenue growth compared with the same period last year
  if (metrics.revenueGrowthYOY !== null) {
    const growthPct = metrics.revenueGrowthYOY * 100
    if (growthPct > 15) {
      score += 0.30
      contributions.push(`Revenue is growing strongly (+${growthPct.toFixed(1)}% vs last year)`)
    } else if (growthPct > 5) {
      score += 0.10
      contributions.push(`Revenue is growing at a healthy pace (+${growthPct.toFixed(1)}% vs last year)`)
    } else if (growthPct < 0) {
      score -= 0.25
      contributions.push(`Revenue is shrinking (${growthPct.toFixed(1)}% vs last year)`)
    } else {
      contributions.push(`Revenue is mostly flat (${growthPct.toFixed(1)}% vs last year)`)
    }
  }

  const finalScore = clamp(score, -1, 1)

  return {
    score: finalScore,
    label: signalLabel(finalScore),
    detail: contributions.length > 0
      ? `${signalMeaning(finalScore, 'fundamentals')}${formatEvidence(contributions)}`
      : 'Fundamentals are neutral due to limited evidence. Evidence: insufficient fundamental datapoints.',
  }
}

// ─── Dynamic reason generation ───────────────────────────────────────────────

function generateReasons(
  action: 'buy' | 'hold' | 'sell',
  signals: SignalBreakdown,
  metrics: BasicMetrics | null,
): string[] {
  const reasons: string[] = []

  if (action === 'buy') {
    if (signals.momentum.score > 0.1) {
      reasons.push(`Price trend is positive across recent periods: ${signals.momentum.detail}`)
    } else if (signals.momentum.score < -0.1) {
      reasons.push(`Price has pulled back — momentum is currently negative but sentiment supports recovery.`)
    }
    if (signals.sentiment.score > 0.1) {
      reasons.push(`News sentiment is leaning bullish. ${signals.sentiment.detail}`)
    }
    if (signals.fundamentals.score > 0.1) {
      reasons.push(signals.fundamentals.detail)
    }
    if (metrics?.beta !== null && metrics?.beta !== undefined && metrics.beta > 1.5) {
      reasons.push(`High beta (${metrics.beta.toFixed(2)}) — this stock moves more than the market; size position accordingly.`)
    }
  } else if (action === 'sell') {
    if (signals.momentum.score < -0.1) {
      reasons.push(`Price trend is negative across recent periods: ${signals.momentum.detail}`)
    }
    if (signals.sentiment.score < -0.1) {
      reasons.push(`News sentiment is leaning bearish. ${signals.sentiment.detail}`)
    }
    if (signals.fundamentals.score < -0.1) {
      reasons.push(signals.fundamentals.detail)
    }
    reasons.push(`Consider partial profit-taking or reducing position size given current signal alignment.`)
  } else {
    reasons.push(`Signals are mixed — no strong directional conviction.`)
    if (signals.momentum.detail) {
      reasons.push(`Momentum: ${signals.momentum.detail}`)
    }
    reasons.push(`Wait for a clearer catalyst or a stronger signal from one of the tracked dimensions.`)
  }

  return reasons.slice(0, 4)  // max 4 reasons
}

export function reprofileGuidance(
  guidance: StockGuidance,
  profile: RecommendationProfile,
): StockGuidance {
  if (!guidance.signals) return guidance

  const profileConfig = PROFILE_CONFIG[profile]
  const signals: SignalBreakdown = {
    ...guidance.signals,
    sentiment: { ...guidance.signals.sentiment },
  }

  if (signals.sentiment.horizons) {
    const { short, mid, long } = signals.sentiment.horizons
    const weights = profileConfig.sentimentHorizonWeights
    const reweightedSentiment = clamp(
      short * weights.short + mid * weights.mid + long * weights.long,
      -1,
      1,
    )
    signals.sentiment.score = reweightedSentiment
    signals.sentiment.label = signalLabel(reweightedSentiment)
    signals.sentiment.detail = `${signalMeaning(reweightedSentiment, 'sentiment')}${formatEvidence([
      `Today ${short >= 0 ? '+' : ''}${short.toFixed(2)}`,
      `Past week ${mid >= 0 ? '+' : ''}${mid.toFixed(2)}`,
      `Past month ${long >= 0 ? '+' : ''}${long.toFixed(2)}`,
      `profile reweight=${profile}`,
    ])}`
  }

  const composite = clamp(
    signals.momentum.score * profileConfig.signalWeights.momentum +
    signals.sentiment.score * profileConfig.signalWeights.sentiment +
    signals.fundamentals.score * profileConfig.signalWeights.fundamentals,
    -1,
    1,
  )

  const action: 'buy' | 'hold' | 'sell' =
    composite > profileConfig.actionThresholds.buy  ? 'buy'  :
    composite < profileConfig.actionThresholds.sell ? 'sell' : 'hold'

  const scores = [signals.momentum.score, signals.sentiment.score, signals.fundamentals.score]
  const allSame = scores.every((s) => s > 0) || scores.every((s) => s < 0)
  const baseConf = Math.round(50 + Math.abs(composite) * 38)
  const confidence = clamp(allSame ? baseConf + 8 : baseConf, 42, 94)

  return {
    ...guidance,
    action,
    confidence,
    reasons: generateReasons(action, signals, null),
    signals,
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getEnrichedGuidance(
  symbol: string,
  profile: RecommendationProfile = 'default',
  companyName?: string,
): Promise<StockGuidance | null> {
  const sym = symbol.trim().toUpperCase()
  const profileConfig = PROFILE_CONFIG[profile]

  // Fetch everything in parallel — individual failures return null/empty gracefully
  const [quote, closes, metrics, sentimentSignal] = await Promise.all([
    fetchQuote(sym),
    fetchClosingPrices(sym, 90),
    fetchBasicMetrics(sym),
    computeSentimentSignal(sym, profile, companyName),
  ])

  if (!quote) return null

  const momentumSignal     = computeMomentumSignal(closes, quote.changePercent)
  const fundamentalsSignal = computeFundamentalsSignal(metrics, quote.price)

  const signals: SignalBreakdown = {
    momentum:     momentumSignal,
    sentiment:    sentimentSignal,
    fundamentals: fundamentalsSignal,
  }

  // Composite score
  const composite = clamp(
    momentumSignal.score     * profileConfig.signalWeights.momentum +
    sentimentSignal.score    * profileConfig.signalWeights.sentiment +
    fundamentalsSignal.score * profileConfig.signalWeights.fundamentals,
    -1,
    1,
  )

  const action: 'buy' | 'hold' | 'sell' =
    composite > profileConfig.actionThresholds.buy  ? 'buy'  :
    composite < profileConfig.actionThresholds.sell ? 'sell' : 'hold'

  // Confidence: higher when signals agree (all same direction)
  const scores   = [momentumSignal.score, sentimentSignal.score, fundamentalsSignal.score]
  const allSame  = scores.every((s) => s > 0) || scores.every((s) => s < 0)
  const baseConf = Math.round(50 + Math.abs(composite) * 38)
  const confidence = clamp(allSame ? baseConf + 8 : baseConf, 42, 94)

  const reasons = generateReasons(action, signals, metrics)

  return {
    symbol: sym,
    action,
    confidence,
    reasons,
    price: quote.price,
    changePercent: quote.changePercent,
    signals,
  }
}
