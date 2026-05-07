const FINNHUB_API_KEY = import.meta.env.VITE_FINNHUB_API_KEY as string | undefined
const MARKET_PROXY_URL = (import.meta.env.VITE_MARKET_PROXY_URL as string | undefined)?.trim()
const YAHOO_FALLBACK_ENABLED = true
const BASE_URL = 'https://finnhub.io/api/v1'
const YAHOO_BASE_URL = 'https://query1.finance.yahoo.com'
const YAHOO_SEARCH_BASE_URL = 'https://query2.finance.yahoo.com'
let pendingNewsNotice: string | null = null
let pendingSymbolLookupNotice: string | null = null

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
  return Boolean(FINNHUB_API_KEY || YAHOO_FALLBACK_ENABLED)
}

export type SymbolProvider = 'finnhub' | 'yahoo' | 'stooq'
export type AnalyticsProvider = SymbolProvider | 'yfinance' | 'lexicon' | 'hybrid' | 'none'

export interface QuoteResult {
  symbol: string
  price: number
  change: number       // absolute change
  changePercent: number // percent change
  provider?: SymbolProvider
}

export interface SymbolSnapshot {
  symbol: string
  name: string
  currency: string
  price: number
  priceProvider?: SymbolProvider
  profileProvider?: SymbolProvider
}

export interface SymbolLookupResult {
  symbol: string
  description: string
  type?: string
  provider?: SymbolProvider
}

function getYahooSymbolCandidates(symbol: string): string[] {
  const normalized = symbol.trim().toUpperCase()
  if (!normalized) return []

  const candidates: string[] = [normalized]
  if (normalized.includes('.')) {
    const [base, exchange] = normalized.split('.')
    if (base) candidates.push(base)
    if (base && exchange) candidates.push(`${base}-${exchange}`)
  }

  return Array.from(new Set(candidates))
}

function getMarketProxyBaseUrl(): string {
  if (MARKET_PROXY_URL && MARKET_PROXY_URL.length > 0) {
    return MARKET_PROXY_URL.replace(/\/$/, '')
  }
  return '/api/market'
}

function getMarketProxyUrl(path: 'quote' | 'snapshot' | 'search' | 'news' | 'history' | 'fundamentals', params: Record<string, string>): string {
  const base = getMarketProxyBaseUrl()
  const query = new URLSearchParams(params)
  return `${base}/${path}?${query.toString()}`
}

async function fetchProxyNews(
  symbol: string,
  limit: number,
  companyName?: string,
  strictRelevance = false,
): Promise<CompanyNewsItem[]> {
  const url = getMarketProxyUrl('news', {
    symbol,
    limit: String(Math.max(limit, 1)),
  })

  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return []

    const data = (await res.json()) as {
      items?: Array<{
        id?: number
        headline?: string
        source?: string
        url?: string
        summary?: string
        datetime?: number
      }>
    }

    const mapped = (data.items ?? []).map((item, index) => ({
      id: typeof item.id === 'number' ? item.id : index + 1,
      headline: item.headline ?? '',
      source: item.source ?? 'Yahoo Finance',
      url: item.url ?? '',
      summary: item.summary ?? '',
      datetime: item.datetime ?? Math.floor(Date.now() / 1000),
    }))

    return selectRelevantNewsItems(mapped, symbol, companyName, limit, strictRelevance)
  } catch {
    return []
  }
}

async function fetchProxyClosingPricesWithProvider(symbol: string, days: number): Promise<{ closes: number[]; provider: AnalyticsProvider }> {
  const url = getMarketProxyUrl('history', {
    symbol,
    days: String(Math.max(days, 5)),
  })

  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return { closes: [], provider: 'none' }
    const data = (await res.json()) as { closes?: number[]; provider?: AnalyticsProvider }
    return {
      closes: Array.isArray(data.closes)
        ? data.closes.filter((value) => Number.isFinite(value) && value > 0)
        : [],
      provider: data.provider ?? 'yfinance',
    }
  } catch {
    return { closes: [], provider: 'none' }
  }
}

async function fetchProxyClosingPrices(symbol: string, days: number): Promise<number[]> {
  const result = await fetchProxyClosingPricesWithProvider(symbol, days)
  return result.closes
}

async function fetchProxyBasicMetricsWithProvider(symbol: string): Promise<{ metrics: BasicMetrics | null; provider: AnalyticsProvider }> {
  const url = getMarketProxyUrl('fundamentals', { symbol })

  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return { metrics: null, provider: 'none' }
    const data = (await res.json()) as { metrics?: BasicMetrics | null; provider?: AnalyticsProvider }
    return {
      metrics: data.metrics ?? null,
      provider: data.provider ?? 'yfinance',
    }
  } catch {
    return { metrics: null, provider: 'none' }
  }
}

async function fetchProxyBasicMetrics(symbol: string): Promise<BasicMetrics | null> {
  const result = await fetchProxyBasicMetricsWithProvider(symbol)
  return result.metrics
}

async function fetchProxyQuote(symbol: string): Promise<(QuoteResult & { provider: SymbolProvider }) | null> {
  const url = getMarketProxyUrl('quote', { symbol })
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return null
    const data = (await res.json()) as {
      symbol?: string
      price?: number
      change?: number
      changePercent?: number
      provider?: SymbolProvider
    }

    if (!data.symbol || !data.price || data.price <= 0) return null
    return {
      symbol,
      price: data.price,
      change: data.change ?? 0,
      changePercent: data.changePercent ?? 0,
      provider: data.provider ?? 'yahoo',
    }
  } catch {
    return null
  }
}

async function fetchProxySnapshot(symbol: string): Promise<(SymbolSnapshot & { provider: SymbolProvider }) | null> {
  const url = getMarketProxyUrl('snapshot', { symbol })
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return null
    const data = (await res.json()) as {
      symbol?: string
      name?: string
      currency?: string
      price?: number
      provider?: SymbolProvider
    }

    if (!data.symbol || !data.price || data.price <= 0) return null
    return {
      symbol,
      name: data.name ?? symbol.toUpperCase(),
      currency: data.currency ?? 'USD',
      price: data.price,
      provider: data.provider ?? 'yahoo',
    }
  } catch {
    return null
  }
}

async function searchSymbolsFromProxy(query: string, limit: number): Promise<SymbolLookupResult[]> {
  const url = getMarketProxyUrl('search', {
    q: query,
    limit: String(limit),
  })
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return []
    const data = (await res.json()) as {
      results?: Array<{
        symbol?: string
        description?: string
        type?: string
        provider?: SymbolProvider
      }>
    }

    const seen = new Set<string>()
    const mapped: SymbolLookupResult[] = []
    for (const item of data.results ?? []) {
      if (!item.symbol) continue
      const symbol = item.symbol.toUpperCase()
      if (seen.has(symbol)) continue
      seen.add(symbol)
      mapped.push({
        symbol,
        description: item.description ?? symbol,
        type: item.type,
        provider: item.provider ?? 'yahoo',
      })
      if (mapped.length >= limit) break
    }

    return mapped
  } catch {
    return []
  }
}

async function fetchYahooQuote(symbol: string): Promise<QuoteResult | null> {
  const proxyQuote = await fetchProxyQuote(symbol)
  if (proxyQuote) {
    return {
      symbol,
      price: proxyQuote.price,
      change: proxyQuote.change,
      changePercent: proxyQuote.changePercent,
      provider: proxyQuote.provider,
    }
  }

  if (!YAHOO_FALLBACK_ENABLED) return null

  const candidates = getYahooSymbolCandidates(symbol)
  for (const candidate of candidates) {
    const url = `${YAHOO_BASE_URL}/v7/finance/quote?symbols=${encodeURIComponent(candidate)}`
    try {
      const res = await fetch(url, FRESH_FETCH_OPTIONS)
      if (!res.ok) continue
      const data = (await res.json()) as {
        quoteResponse?: {
          result?: Array<{
            regularMarketPrice?: number
            regularMarketChange?: number
            regularMarketChangePercent?: number
            symbol?: string
          }>
        }
      }

      const quote = data.quoteResponse?.result?.[0]
      const price = quote?.regularMarketPrice
      if (!price || price <= 0) continue

      return {
        symbol,
        price,
        change: quote.regularMarketChange ?? 0,
        changePercent: quote.regularMarketChangePercent ?? 0,
        provider: 'yahoo',
      }
    } catch {
      // try next candidate
    }
  }

  return null
}

async function fetchYahooSnapshot(symbol: string): Promise<SymbolSnapshot | null> {
  const proxySnapshot = await fetchProxySnapshot(symbol)
  if (proxySnapshot) {
    return {
      symbol: proxySnapshot.symbol,
      name: proxySnapshot.name,
      currency: proxySnapshot.currency,
      price: proxySnapshot.price,
      priceProvider: proxySnapshot.provider,
      profileProvider: proxySnapshot.provider,
    }
  }

  if (!YAHOO_FALLBACK_ENABLED) return null

  const candidates = getYahooSymbolCandidates(symbol)
  for (const candidate of candidates) {
    const url = `${YAHOO_BASE_URL}/v7/finance/quote?symbols=${encodeURIComponent(candidate)}`
    try {
      const res = await fetch(url, FRESH_FETCH_OPTIONS)
      if (!res.ok) continue
      const data = (await res.json()) as {
        quoteResponse?: {
          result?: Array<{
            symbol?: string
            shortName?: string
            longName?: string
            currency?: string
            regularMarketPrice?: number
          }>
        }
      }

      const quote = data.quoteResponse?.result?.[0]
      const price = quote?.regularMarketPrice
      if (!price || price <= 0) continue

      return {
        symbol: symbol.toUpperCase(),
        name: quote.longName ?? quote.shortName ?? symbol.toUpperCase(),
        currency: quote.currency ?? 'USD',
        price,
        priceProvider: 'yahoo',
        profileProvider: 'yahoo',
      }
    } catch {
      // try next candidate
    }
  }

  return null
}

async function searchSymbolsFromYahoo(query: string, limit: number): Promise<SymbolLookupResult[]> {
  const proxyResults = await searchSymbolsFromProxy(query, limit)
  if (proxyResults.length > 0) return proxyResults

  if (!YAHOO_FALLBACK_ENABLED) return []

  const url = `${YAHOO_SEARCH_BASE_URL}/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${Math.max(limit, 10)}&newsCount=0`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return []
    const data = (await res.json()) as {
      quotes?: Array<{
        symbol?: string
        shortname?: string
        longname?: string
        quoteType?: string
      }>
    }

    const seen = new Set<string>()
    const mapped: SymbolLookupResult[] = []
    for (const item of data.quotes ?? []) {
      const symbol = item.symbol?.toUpperCase()
      if (!symbol || seen.has(symbol)) continue
      seen.add(symbol)
      mapped.push({
        symbol,
        description: item.longname ?? item.shortname ?? symbol,
        type: item.quoteType,
        provider: 'yahoo',
      })
      if (mapped.length >= limit) break
    }

    return mapped
  } catch {
    return []
  }
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

export function consumeSymbolLookupNotice(): string | null {
  const next = pendingSymbolLookupNotice
  pendingSymbolLookupNotice = null
  return next
}

function setSymbolLookupNotice(message: string) {
  if (!pendingSymbolLookupNotice) {
    pendingSymbolLookupNotice = message
  }
}

function parseProviderErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const maybeMessage = (payload as { message?: unknown; error?: unknown }).message ?? (payload as { error?: unknown }).error
  if (typeof maybeMessage !== 'string') return null
  const normalized = maybeMessage.toLowerCase()

  if (normalized.includes("you don't have access")) {
    return 'Your Finnhub plan does not include quote access for this symbol/exchange.'
  }
  if (normalized.includes('run out of api credits') || normalized.includes('rate limit')) {
    return 'Quote provider rate limit reached. Please retry in about a minute.'
  }

  return null
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
  diagnostics?: GuidanceDiagnostics
}

export interface GuidanceDiagnostics {
  quote: AnalyticsProvider
  history: AnalyticsProvider
  sentiment: AnalyticsProvider
  fundamentals: AnalyticsProvider
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
  if (!FINNHUB_API_KEY) {
    return fetchProxyBasicMetrics(symbol)
  }

  const url = `${BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${FINNHUB_API_KEY}`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return fetchProxyBasicMetrics(symbol)
    const data = (await res.json()) as {
      metric?: {
        peNormalizedAnnual?: number
        beta?: number
        '52WeekHigh'?: number
        '52WeekLow'?: number
        revenueGrowthTTMYoy?: number
      }
    }
    if (!data.metric) return fetchProxyBasicMetrics(symbol)
    return {
      peRatio: data.metric.peNormalizedAnnual ?? null,
      beta: data.metric.beta ?? null,
      weekHigh52: data.metric['52WeekHigh'] ?? null,
      weekLow52: data.metric['52WeekLow'] ?? null,
      revenueGrowthYOY: data.metric.revenueGrowthTTMYoy ?? null,
    }
  } catch {
    return fetchProxyBasicMetrics(symbol)
  }
}

export async function fetchBasicMetricsWithProvider(symbol: string): Promise<{ metrics: BasicMetrics | null; provider: AnalyticsProvider }> {
  if (!FINNHUB_API_KEY) {
    return fetchProxyBasicMetricsWithProvider(symbol)
  }

  const url = `${BASE_URL}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${FINNHUB_API_KEY}`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return fetchProxyBasicMetricsWithProvider(symbol)
    const data = (await res.json()) as {
      metric?: {
        peNormalizedAnnual?: number
        beta?: number
        '52WeekHigh'?: number
        '52WeekLow'?: number
        revenueGrowthTTMYoy?: number
      }
    }
    if (!data.metric) return fetchProxyBasicMetricsWithProvider(symbol)
    return {
      metrics: {
        peRatio: data.metric.peNormalizedAnnual ?? null,
        beta: data.metric.beta ?? null,
        weekHigh52: data.metric['52WeekHigh'] ?? null,
        weekLow52: data.metric['52WeekLow'] ?? null,
        revenueGrowthYOY: data.metric.revenueGrowthTTMYoy ?? null,
      },
      provider: 'finnhub',
    }
  } catch {
    return fetchProxyBasicMetricsWithProvider(symbol)
  }
}

/**
 * Fetch daily closing prices for the last N calendar days via Finnhub /stock/candle.
 * Returns closes oldest-first, or empty array on failure.
 */
export async function fetchClosingPrices(symbol: string, days = 90): Promise<number[]> {
  if (!FINNHUB_API_KEY) {
    return fetchProxyClosingPrices(symbol, days)
  }

  const to = Math.floor(Date.now() / 1000)
  const from = to - days * 24 * 60 * 60

  const url = `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return fetchProxyClosingPrices(symbol, days)
    const data = (await res.json()) as { s: string; c?: number[] }
    if (data.s !== 'ok' || !data.c || data.c.length === 0) return fetchProxyClosingPrices(symbol, days)
    return data.c
  } catch {
    return fetchProxyClosingPrices(symbol, days)
  }
}

export async function fetchClosingPricesWithProvider(symbol: string, days = 90): Promise<{ closes: number[]; provider: AnalyticsProvider }> {
  if (!FINNHUB_API_KEY) {
    return fetchProxyClosingPricesWithProvider(symbol, days)
  }

  const to = Math.floor(Date.now() / 1000)
  const from = to - days * 24 * 60 * 60

  const url = `${BASE_URL}/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
  try {
    const res = await fetch(url, FRESH_FETCH_OPTIONS)
    if (!res.ok) return fetchProxyClosingPricesWithProvider(symbol, days)
    const data = (await res.json()) as { s: string; c?: number[] }
    if (data.s !== 'ok' || !data.c || data.c.length === 0) return fetchProxyClosingPricesWithProvider(symbol, days)
    return {
      closes: data.c,
      provider: 'finnhub',
    }
  } catch {
    return fetchProxyClosingPricesWithProvider(symbol, days)
  }
}

/**
 * Fetch a single real-time quote from Finnhub.
 * Returns null if unconfigured or the symbol is not found.
 */
export async function fetchQuote(symbol: string): Promise<QuoteResult | null> {
  if (!FINNHUB_API_KEY && !YAHOO_FALLBACK_ENABLED) return null

  if (!FINNHUB_API_KEY) {
    return fetchYahooQuote(symbol)
  }

  const url = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
  let res: Response
  try {
    res = await fetch(url, FRESH_FETCH_OPTIONS)
  } catch {
    return fetchYahooQuote(symbol)
  }

  if (!res.ok) return fetchYahooQuote(symbol)

  const data = (await res.json()) as { c?: number; d?: number; dp?: number; pc?: number }

  let price = data.c && data.c > 0 ? data.c : 0
  if (!price && data.pc && data.pc > 0) {
    price = data.pc
  }
  if (!price) {
    const closes = await fetchClosingPrices(symbol, 30)
    if (closes.length > 0) {
      const lastClose = closes[closes.length - 1]
      if (lastClose > 0) price = lastClose
    }
  }

  if (!price) {
    return fetchYahooQuote(symbol)
  }

  const previousClose = data.pc && data.pc > 0 ? data.pc : price
  const computedChange = price - previousClose
  const computedChangePercent = previousClose > 0 ? (computedChange / previousClose) * 100 : 0

  return {
    symbol,
    price,
    change: Number.isFinite(data.d) ? (data.d as number) : computedChange,
    changePercent: Number.isFinite(data.dp) ? (data.dp as number) : computedChangePercent,
    provider: 'finnhub',
  }
}

/**
 * Fetch quotes for multiple symbols in parallel.
 * Falls back gracefully — symbols that fail return null and are skipped.
 */
export async function fetchQuotes(symbols: string[]): Promise<Map<string, QuoteResult>> {
  if (symbols.length === 0) return new Map()
  if (!FINNHUB_API_KEY && !YAHOO_FALLBACK_ENABLED) return new Map()

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
  pendingSymbolLookupNotice = null

  if (!FINNHUB_API_KEY && !YAHOO_FALLBACK_ENABLED) return null

  const symbol = rawSymbol.trim().toUpperCase()
  if (!symbol) return null

  if (!FINNHUB_API_KEY) {
    return fetchYahooSnapshot(symbol)
  }

  const quoteUrl = `${BASE_URL}/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`
  const profileUrl = `${BASE_URL}/stock/profile2?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`

  const [quoteRes, profileRes] = await Promise.allSettled([
    fetch(quoteUrl, FRESH_FETCH_OPTIONS),
    fetch(profileUrl, FRESH_FETCH_OPTIONS),
  ])

  let resolvedPrice = 0
  if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
    const quoteData = (await quoteRes.value.json()) as { c?: number; pc?: number; error?: string }
    const providerMessage = parseProviderErrorMessage(quoteData)
    if (providerMessage) setSymbolLookupNotice(providerMessage)
    resolvedPrice = quoteData.c && quoteData.c > 0
      ? quoteData.c
      : (quoteData.pc && quoteData.pc > 0 ? quoteData.pc : 0)
  } else if (quoteRes.status === 'fulfilled') {
    setSymbolLookupNotice('Quote provider rejected this symbol request. Please retry shortly.')
  }

  if (!resolvedPrice) {
    const closes = await fetchClosingPrices(symbol, 30)
    if (closes.length > 0) {
      const lastClose = closes[closes.length - 1]
      if (lastClose > 0) {
        resolvedPrice = lastClose
      }
    }
  }

  if (!resolvedPrice) {
    return fetchYahooSnapshot(symbol)
  }

  let name = symbol
  let currency = 'USD'
  let profileProvider: SymbolProvider = 'finnhub'

  if (profileRes.status === 'fulfilled' && profileRes.value.ok) {
    const profileData = (await profileRes.value.json()) as {
      name?: string
      currency?: string
    }
    if (profileData.name) name = profileData.name
    if (profileData.currency) currency = profileData.currency
  }

  if (name === symbol || !currency) {
    const yahooSnapshot = await fetchYahooSnapshot(symbol)
    if (yahooSnapshot) {
      if (name === symbol && yahooSnapshot.name) {
        name = yahooSnapshot.name
      }
      if ((!currency || currency === 'USD') && yahooSnapshot.currency) {
        currency = yahooSnapshot.currency
      }
      profileProvider = yahooSnapshot.profileProvider ?? yahooSnapshot.priceProvider ?? 'yahoo'
    }
  }

  return {
    symbol,
    name,
    currency,
    price: resolvedPrice,
    priceProvider: 'finnhub',
    profileProvider,
  }
}

/**
 * Search tradable symbols by free-text query.
 */
export async function searchSymbols(query: string, limit = 8): Promise<SymbolLookupResult[]> {
  if (!FINNHUB_API_KEY && !YAHOO_FALLBACK_ENABLED) return []

  const trimmed = query.trim()
  if (!trimmed) return []

  if (!FINNHUB_API_KEY) {
    return searchSymbolsFromYahoo(trimmed, limit)
  }

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

  const finnhubResults = (data.result ?? [])
    .filter((item) => item.symbol)
    .slice(0, limit)
    .map((item) => ({
      symbol: item.symbol,
      description: item.description ?? item.symbol,
      type: item.type,
      provider: 'finnhub' as const,
    }))

  if (finnhubResults.length > 0) return finnhubResults

  // Global fallback when Finnhub search doesn't return the exchange symbol.
  return searchSymbolsFromYahoo(trimmed, limit)
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
  const trimmed = symbol.trim().toUpperCase()
  if (!trimmed) return []

  const fetchFromFinnhubWindow = async (days: number): Promise<CompanyNewsItem[]> => {
    if (!FINNHUB_API_KEY) return []

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

  let mapped = await fetchFromFinnhubWindow(lookbackDays)

  // First-load resilience: one retry with a wider window if initial call comes back empty.
  if (mapped.length === 0) {
    mapped = await fetchFromFinnhubWindow(Math.max(lookbackDays + 7, 10))
  }

  // Fallback for non-US and provider gaps: Yahoo news via proxy endpoint.
  if (mapped.length === 0) {
    mapped = await fetchProxyNews(trimmed, limit, companyName, strictRelevance)
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
