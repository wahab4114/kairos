const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined
const BASE_URL = 'https://finnhub.io/api/v1'
let pendingNewsNotice: string | null = null

const FRESH_FETCH_OPTIONS: RequestInit = {
  cache: 'no-store',
}

/**
 * Check if US stock market is currently open
 * Markets open 9:30 AM - 4:00 PM ET, Monday-Friday (excluding holidays)
 */
function isMarketOpen(): boolean {
  const now = new Date();
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const dayOfWeek = now.getUTCDay();
  
  // Convert UTC to ET (UTC-5 in winter, UTC-4 in summer)
  const estOffset = new Date(now.getFullYear(), 0, 1).getTimezoneOffset() > new Date(now.getFullYear(), 6, 1).getTimezoneOffset() ? 300 : 240;
  const etHour = utcHour - (estOffset / 60);
  const etMinute = utcMinute;
  
  // Market is closed on weekends (Saturday=6, Sunday=0)
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Market hours: 9:30 AM - 4:00 PM ET
  const openTime = 9 * 60 + 30; // 9:30 in minutes
  const closeTime = 16 * 60;    // 4:00 PM in minutes
  const currentTime = etHour * 60 + etMinute;
  
  return currentTime >= openTime && currentTime < closeTime;
}

export function isPriceServiceConfigured(): boolean {
  return Boolean(FINNHUB_API_KEY)
}

export interface QuoteResult {
  symbol: string
  price: number
  change: number       // absolute change
  changePercent: number // percent change
}

export interface SymbolSnapshot {
  symbol: string
  name: string
  currency: string
  price: number
}

export interface SymbolLookupResult {
  symbol: string
  description: string
  type?: string
}

export interface CompanyNewsItem {
  id: number
  headline: string
  source: string
  url: string
  summary: string
  datetime: number
}

export function consumeNewsFetchNotice(): string | null {
  const next = pendingNewsNotice
  pendingNewsNotice = null
  return next
}

export type GuidanceAction = 'buy' | 'hold' | 'sell'

export interface SignalDetail {
  score: number      // normalised [-1, +1]
  label: string      // e.g. "Bullish", "Neutral", "Bearish"
  detail: string     // human-readable explanation
}

export interface SignalBreakdown {
  momentum: SignalDetail & { timeframes: string[] }
  sentiment: SignalDetail & {
    source: 'finnhub' | 'lexicon' | 'hybrid' | 'none'
    horizons?: {
      short: number
      mid: number
      long: number
    }
  }
  fundamentals: SignalDetail
}

export interface StockGuidance {
  symbol: string
  action: GuidanceAction
  confidence: number
  reasons: string[]
  price: number
  changePercent: number
  signals?: SignalBreakdown   // enriched — present when recommendation engine runs
}

export interface NewsSentiment {
  bullishPercent: number
  bearishPercent: number
  score: number   // companyNewsScore from Finnhub (0–1)
}

export interface BasicMetrics {
  peRatio: number | null
  beta: number | null
  weekHigh52: number | null
  weekLow52: number | null
  revenueGrowthYOY: number | null
}

/**
 * Fetch Finnhub pre-computed news sentiment for a symbol.
 * Endpoint: /news-sentiment
 */
export async function fetchNewsSentiment(symbol: string): Promise<NewsSentiment | null> {
  if (!FINNHUB_API_KEY) return null

  const url = `${BASE_URL}/news-sentiment?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return null
    const data = (await res.json()) as {
      sentiment?: { bullishPercent?: number; bearishPercent?: number }
      companyNewsScore?: number
    }
    if (!data.sentiment) return null
    return {
      bullishPercent: data.sentiment.bullishPercent ?? 0.5,
      bearishPercent: data.sentiment.bearishPercent ?? 0.5,
      score: data.companyNewsScore ?? 0.5,
    }
  } catch {
    return null
  }
}

/**
 * Fetch basic fundamental metrics via Finnhub /stock/metric.
 */
export async function fetchBasicMetrics(symbol: string): Promise<BasicMetrics | null> {
  if (!FINNHUB_API_KEY) return null

  const url = `${BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${FINNHUB_API_KEY}`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return null
    const data = (await res.json()) as {
      metric?: {
        peNormalizedAnnual?: number
        beta?: number
        '52WeekHigh'?: number
        '52WeekLow'?: number
        revenueGrowthTTMYoy?: number
      }
    }
    if (!data.metric) return null
    return {
      peRatio: data.metric.peNormalizedAnnual ?? null,
      beta: data.metric.beta ?? null,
      weekHigh52: data.metric['52WeekHigh'] ?? null,
      weekLow52: data.metric['52WeekLow'] ?? null,
      revenueGrowthYOY: data.metric.revenueGrowthTTMYoy ?? null,
    }
  } catch {
    return null
  }
}

/**
 * Fetch daily closing prices for the last N calendar days via Finnhub /stock/candle.
 * Returns closes oldest-first, or empty array on failure.
 */
export async function fetchClosingPrices(symbol: string, days = 90): Promise<number[]> {
  if (!FINNHUB_API_KEY) return []

  const to = Math.floor(Date.now() / 1000)
  const from = to - days * 24 * 60 * 60

  const url = `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return []
    const data = (await res.json()) as { s: string; c?: number[] }
    if (data.s !== 'ok' || !data.c || data.c.length === 0) return []
    return data.c
  } catch {
    return []
  }
}

/**
 * Fetch a single real-time quote from Finnhub.
 * Returns null if unconfigured or the symbol is not found.
 */
export async function fetchQuote(symbol: string): Promise<QuoteResult | null> {
  if (!FINNHUB_API_KEY) return null

  const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
  let res: Response
  try {
    res = await fetch(url, FRESH_FETCH_OPTIONS)
  } catch {
    return null
  }

  if (!res.ok) return null

  const data = (await res.json()) as { c: number; d: number; dp: number }

  // Finnhub returns c=0 when symbol is unknown
  if (!data.c) return null

  return {
    symbol,
    price: data.c,
    change: data.d,
    changePercent: data.dp,
  }
}

/**
 * Fetch quotes for multiple symbols in parallel.
 * Falls back gracefully — symbols that fail return null and are skipped.
 */
export async function fetchQuotes(symbols: string[]): Promise<Map<string, QuoteResult>> {
  if (!FINNHUB_API_KEY || symbols.length === 0) return new Map()

  const results = await Promise.allSettled(symbols.map(fetchQuote))
  const map = new Map<string, QuoteResult>()

  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      map.set(symbols[i], result.value)
    }
  })

  return map
}

/**
 * Resolve a symbol into a usable stock payload for the app.
 * Pulls quote + company profile and provides sensible fallbacks.
 */
export async function fetchSymbolSnapshot(rawSymbol: string): Promise<SymbolSnapshot | null> {
  if (!FINNHUB_API_KEY) return null

  const symbol = rawSymbol.trim().toUpperCase()
  if (!symbol) return null

  const quoteUrl = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
  const profileUrl = `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`

  const [quoteRes, profileRes] = await Promise.allSettled([
    fetch(quoteUrl, FRESH_FETCH_OPTIONS),
    fetch(profileUrl, FRESH_FETCH_OPTIONS),
  ])

  if (quoteRes.status !== 'fulfilled' || !quoteRes.value.ok) {
    return null
  }

  const quoteData = (await quoteRes.value.json()) as { c: number }
  if (!quoteData.c) {
    return null
  }

  let name = symbol
  let currency = 'USD'

  if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
    const profileData = (await profileRes.value.json()) as {
      name?: string
      currency?: string
    }
    if (profileData.name) name = profileData.name
    if (profileData.currency) currency = profileData.currency
  }

  return {
    symbol,
    name,
    currency,
    price: quoteData.c,
  }
}

/**
 * Search tradable symbols by free-text query.
 */
export async function searchSymbols(query: string, limit = 8): Promise<SymbolLookupResult[]> {
  if (!FINNHUB_API_KEY) return []

  const trimmed = query.trim()
  if (!trimmed) return []

  const url = `${BASE_URL}/search?q=${encodeURIComponent(trimmed)}&token=${FINNHUB_API_KEY}`
  let res: Response
  try {
    res = await fetch(url, FRESH_FETCH_OPTIONS)
  } catch {
    return []
  }
  if (!res.ok) return []

  const data = (await res.json()) as {
    result?: Array<{
      symbol: string
      description?: string
      type?: string
    }>
  }

  return (data.result ?? [])
    .filter((item) => item.symbol)
    .slice(0, limit)
    .map((item) => ({
      symbol: item.symbol,
      description: item.description ?? item.symbol,
      type: item.type,
    }))
}

function normaliseText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s$]/g, ' ').replace(/\s+/g, ' ').trim()
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildCompanyTokens(companyName?: string): string[] {
  if (!companyName) return []
  const stopWords = new Set([
    'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited',
    'plc', 'group', 'holdings', 'holding', 'sa', 'ag', 'nv', 'llc', 'the', 'and',
  ])
  return normaliseText(companyName)
    .split(' ')
    .filter((part) => part.length >= 3 && !stopWords.has(part))
    .slice(0, 4)
}

function computeNewsRelevance(
  item: { headline: string; summary?: string },
  symbol: string,
  companyName?: string,
): number {
  const headline = normaliseText(item.headline ?? '')
  const summary = normaliseText(item.summary ?? '')
  const combined = `${headline} ${summary}`
  const ticker = symbol.toLowerCase()

  let score = 0
  const tickerRegex = new RegExp(`\\b${escapeRegExp(ticker)}\\b`, 'i')
  const dollarTickerRegex = new RegExp(`\\$${escapeRegExp(ticker)}\\b`, 'i')

  if (dollarTickerRegex.test(item.headline) || dollarTickerRegex.test(item.summary ?? '')) score += 5
  if (tickerRegex.test(headline)) score += 4
  if (tickerRegex.test(summary)) score += 2

  const tokens = buildCompanyTokens(companyName)
  const tokenHitsHeadline = tokens.filter((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(headline)).length
  const tokenHitsSummary = tokens.filter((token) => new RegExp(`\\b${escapeRegExp(token)}\\b`, 'i').test(summary)).length

  score += Math.min(4, tokenHitsHeadline * 2)
  score += Math.min(2, tokenHitsSummary)

  // Penalise broad market/macro headlines that do not mention the company at all.
  if (!tickerRegex.test(combined) && tokenHitsHeadline + tokenHitsSummary === 0) {
    score -= 4
  }

  return score
}

function selectRelevantNewsItems(
  data: Array<{
    id: number
    headline: string
    source: string
    url: string
    summary?: string
    datetime: number
  }>,
  symbol: string,
  companyName: string | undefined,
  limit: number,
  strictRelevance: boolean,
): CompanyNewsItem[] {
  const dedupe = new Set<string>()

  const ranked = (data ?? [])
    .filter((item) => item.headline && item.url)
    .filter((item) => {
      const key = normaliseText(item.headline)
      if (!key || dedupe.has(key)) return false
      dedupe.add(key)
      return true
    })
    .map((item) => ({
      item,
      relevance: computeNewsRelevance(item, symbol, companyName),
    }))
    .sort((a, b) => {
      if (b.relevance !== a.relevance) return b.relevance - a.relevance
      return (b.item.datetime ?? 0) - (a.item.datetime ?? 0)
    })

  const focused = ranked.filter((entry) => entry.relevance >= 2)
  const selected = strictRelevance
    ? focused.slice(0, limit)
    : (focused.length >= Math.min(2, limit) ? focused : ranked).slice(0, limit)

  return selected.map((item) => ({
    id: item.item.id,
    headline: item.item.headline,
    source: item.item.source,
    url: item.item.url,
    summary: item.item.summary ?? '',
    datetime: item.item.datetime,
  }))
}

export async function fetchCompanyNews(
  symbol: string,
  lookbackDays = 5,
  limit = 5,
  companyName?: string,
  strictRelevance = false,
): Promise<CompanyNewsItem[]> {
  if (!FINNHUB_API_KEY) return []

  const trimmed = symbol.trim().toUpperCase()
  if (!trimmed) return []

  const fetchWindow = async (days: number): Promise<CompanyNewsItem[]> => {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - days)

    const toISO = to.toISOString().slice(0, 10)
    const fromISO = from.toISOString().slice(0, 10)
    const url = `${BASE_URL}/company-news?symbol=${encodeURIComponent(trimmed)}&from=${fromISO}&to=${toISO}&token=${FINNHUB_API_KEY}`

    let res: Response
    try {
      res = await fetch(url, FRESH_FETCH_OPTIONS)
    } catch {
      return []
    }

    if (!res.ok) {
      if (res.status === 429) {
        pendingNewsNotice = 'News API rate limit reached. News is temporarily unavailable.'
      }
      return []
    }

    const data = (await res.json()) as Array<{
      id: number
      headline: string
      source: string
      url: string
      summary?: string
      datetime: number
    }>

    return selectRelevantNewsItems(data, trimmed, companyName, limit, strictRelevance)
  }

  let mapped = await fetchWindow(lookbackDays)

  // First-load resilience: one retry with a wider window if initial call comes back empty.
  if (mapped.length === 0) {
    mapped = await fetchWindow(Math.max(lookbackDays + 7, 10))
  }

  if (mapped.length > 0) {
    pendingNewsNotice = null
  }

  return mapped
}

/**
 * Diagnostic tool: Call from browser console to debug price fetching
 * Usage: window.Kairos.debugPrices() or window.Kairos.debugPrices('AAPL')
 */
export async function debugPrices(symbols: string[] = ['AAPL', 'MSFT', 'GOOGL']) {
  console.clear();
  console.log('🔍 Kairos Price Debug Report');
  console.log('='.repeat(50));
  console.log(`⏰ Time: ${new Date().toLocaleString()}`);
  console.log(`📊 Market Status: ${isMarketOpen() ? '🟢 OPEN' : '🔴 CLOSED'}`);
  console.log(`🔑 API Configured: ${isPriceServiceConfigured() ? '✓' : '✗'}`);
  console.log('='.repeat(50));
  
  for (const symbol of symbols) {
    try {
      const quote = await fetchQuote(symbol);
      if (quote) {
        console.log(`${symbol}: $${quote.price} (${quote.changePercent > 0 ? '+' : ''}${quote.changePercent}%)`);
      } else {
        console.log(`${symbol}: ⚠️  No data returned`);
      }
    } catch (err) {
      console.error(`${symbol}: ❌ Error`, err);
    }
    // Small delay between requests
    await new Promise(r => setTimeout(r, 500));
  }
}

// Make debug tool available globally
if (typeof window !== 'undefined') {
  (window as any).Kairos = {
    debugPrices,
    isMarketOpen,
  };
}

/**
 * Heuristic guidance layer used as MVP until full recommendation engine is implemented.
 */
export async function getStockGuidance(symbol: string): Promise<StockGuidance | null> {
  const quote = await fetchQuote(symbol)
  if (!quote) return null

  const absChange = Math.abs(quote.changePercent)

  if (quote.changePercent <= -2.0) {
    return {
      symbol: symbol.toUpperCase(),
      action: 'buy',
      confidence: Math.min(90, Math.round(55 + absChange * 7)),
      reasons: [
        'Price pulled back meaningfully intraday.',
        'Potential value entry if your thesis is unchanged.',
        'Momentum is currently negative, so sizing should stay disciplined.',
      ],
      price: quote.price,
      changePercent: quote.changePercent,
    }
  }

  if (quote.changePercent >= 3.0) {
    return {
      symbol: symbol.toUpperCase(),
      action: 'sell',
      confidence: Math.min(90, Math.round(52 + absChange * 6)),
      reasons: [
        'Strong upward move may justify partial profit-taking.',
        'Short-term upside may be less attractive after the spike.',
        'Consider reducing risk if position size has grown too large.',
      ],
      price: quote.price,
      changePercent: quote.changePercent,
    }
  }

  return {
    symbol: symbol.toUpperCase(),
    action: 'hold',
    confidence: 62,
    reasons: [
      'Price action is in a neutral range.',
      'No strong short-term signal from momentum alone.',
      'Wait for clearer setup or new company/news catalyst.',
    ],
    price: quote.price,
    changePercent: quote.changePercent,
  }
}
