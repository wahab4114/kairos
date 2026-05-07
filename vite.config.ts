import type { IncomingMessage, ServerResponse } from 'node:http'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

type ProxyQuotePayload = {
  symbol: string
  name?: string
  currency?: string
  price: number
  change?: number
  changePercent?: number
  provider: 'yahoo' | 'stooq'
}

type ProxyNewsItem = {
  id: number
  headline: string
  source: string
  url: string
  summary: string
  datetime: number
}

type ProxyBasicMetrics = {
  peRatio: number | null
  beta: number | null
  weekHigh52: number | null
  weekLow52: number | null
  revenueGrowthYOY: number | null
}

function json(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function getCurrencyGuess(symbol: string): string {
  const upper = symbol.toUpperCase()
  if (upper.endsWith('.DE') || upper.endsWith('.F') || upper.endsWith('.DU')) return 'EUR'
  if (upper.endsWith('.L')) return 'GBP'
  if (upper.endsWith('.TO')) return 'CAD'
  if (upper.endsWith('.T')) return 'JPY'
  return 'USD'
}

async function fetchYahooQuote(symbol: string): Promise<ProxyQuotePayload | null> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'KairosMarketProxy/1.0',
    },
  })
  if (!res.ok) return null

  const data = (await res.json()) as {
    quoteResponse?: {
      result?: Array<{
        symbol?: string
        shortName?: string
        longName?: string
        currency?: string
        regularMarketPrice?: number
        regularMarketChange?: number
        regularMarketChangePercent?: number
      }>
    }
  }

  const item = data.quoteResponse?.result?.[0]
  if (!item?.regularMarketPrice || item.regularMarketPrice <= 0) return null

  return {
    symbol: symbol.toUpperCase(),
    name: item.longName ?? item.shortName,
    currency: item.currency,
    price: item.regularMarketPrice,
    change: item.regularMarketChange,
    changePercent: item.regularMarketChangePercent,
    provider: 'yahoo',
  }
}

async function fetchYahooSearch(query: string, limit: number): Promise<Array<{ symbol: string; description: string; type?: string; provider: 'yahoo' }>> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=${Math.max(limit, 10)}&newsCount=0`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'KairosMarketProxy/1.0',
    },
  })
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
  const mapped: Array<{ symbol: string; description: string; type?: string; provider: 'yahoo' }> = []
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
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

function stripCData(value: string): string {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim()
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

async function fetchYahooNewsViaSearch(symbol: string, limit: number): Promise<ProxyNewsItem[]> {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(symbol)}&quotesCount=1&newsCount=${Math.max(limit * 3, 20)}`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) return []

  const data = (await res.json()) as {
    news?: Array<{
      uuid?: string
      title?: string
      publisher?: string
      link?: string
      providerPublishTime?: number
      summary?: string
      relatedTickers?: string[]
    }>
  }

  const upper = symbol.toUpperCase()
  const rows = (data.news ?? [])
    .filter((item) => item.title && item.link)
    .sort((a, b) => (b.providerPublishTime ?? 0) - (a.providerPublishTime ?? 0))

  const focused = rows.filter((item) => (item.relatedTickers ?? []).some((t) => t.toUpperCase() === upper))
  const selected = (focused.length >= Math.min(2, limit) ? focused : rows).slice(0, limit)

  return selected.map((item) => {
    const link = item.link as string
    const publishTime = item.providerPublishTime && item.providerPublishTime > 0
      ? item.providerPublishTime
      : Math.floor(Date.now() / 1000)
    return {
      id: hashString(item.uuid ?? `${item.title}-${link}`),
      headline: (item.title as string).trim(),
      source: item.publisher?.trim() || 'Yahoo Finance',
      url: link,
      summary: item.summary?.trim() || '',
      datetime: publishTime,
    }
  })
}

async function fetchYahooNewsViaRss(symbol: string, limit: number): Promise<ProxyNewsItem[]> {
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(symbol)}&region=US&lang=en-US`
  const res = await fetch(url, {
    headers: {
      Accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) return []

  const xml = await res.text()
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  const items: ProxyNewsItem[] = []

  let match: RegExpExecArray | null = itemRegex.exec(xml)
  while (match) {
    const block = match[1]
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]
    const description = block.match(/<description>([\s\S]*?)<\/description>/)?.[1]
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]

    if (!title || !link) continue

    const cleanTitle = decodeXmlEntities(stripCData(title))
    const cleanLink = decodeXmlEntities(stripCData(link))
    const cleanDescription = description ? decodeXmlEntities(stripCData(description)) : ''
    const timestampMs = pubDate ? Date.parse(stripCData(pubDate)) : NaN
    const datetime = Number.isFinite(timestampMs)
      ? Math.floor((timestampMs as number) / 1000)
      : Math.floor(Date.now() / 1000)

    items.push({
      id: hashString(`${cleanTitle}-${cleanLink}`),
      headline: cleanTitle,
      source: 'Yahoo Finance',
      url: cleanLink,
      summary: cleanDescription,
      datetime,
    })

    if (items.length >= limit) break

    match = itemRegex.exec(xml)
  }

  return items
}

async function fetchYahooNews(symbol: string, limit: number): Promise<ProxyNewsItem[]> {
  const fromSearch = await fetchYahooNewsViaSearch(symbol, limit)
  if (fromSearch.length > 0) return fromSearch
  const fromRss = await fetchYahooNewsViaRss(symbol, limit)
  if (fromRss.length > 0) return fromRss
  return fetchYfinanceNews(symbol, limit)
}

async function fetchYfinanceNews(symbol: string, limit: number): Promise<ProxyNewsItem[]> {
  const parsed = await runPythonJsonScript<{ items?: ProxyNewsItem[] }>('yfinance_news.py', [symbol, String(limit)])
  const items = Array.isArray(parsed?.items) ? parsed.items : []
  return items.slice(0, limit)
}

async function runPythonJsonScript<T>(scriptName: string, args: string[]): Promise<T | null> {
  const scriptPath = resolve(process.cwd(), 'scripts', scriptName)
  const candidates = ['/usr/local/bin/python3.12', 'python3', 'python']

  for (const cmd of candidates) {
    const result = await new Promise<T | null>((resolveResult) => {
      const child = spawn(cmd, [scriptPath, ...args], {
        cwd: process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      const timeout = setTimeout(() => {
        child.kill('SIGTERM')
      }, 12000)

      child.stdout.on('data', (chunk) => {
        stdout += String(chunk)
      })
      child.on('error', () => {
        clearTimeout(timeout)
        resolveResult(null)
      })

      child.on('close', (code) => {
        clearTimeout(timeout)
        if (code !== 0 && !stdout.trim()) {
          resolveResult(null)
          return
        }

        try {
          resolveResult(JSON.parse(stdout) as T)
        } catch {
          resolveResult(null)
        }
      })
    })

    if (result) return result
  }

  return null
}

async function fetchYfinanceHistory(symbol: string, days: number): Promise<number[]> {
  const parsed = await runPythonJsonScript<{ closes?: number[] }>('yfinance_market_data.py', ['history', symbol, String(days)])
  return Array.isArray(parsed?.closes) ? parsed.closes.filter((value) => Number.isFinite(value) && value > 0) : []
}

async function fetchYfinanceFundamentals(symbol: string): Promise<ProxyBasicMetrics | null> {
  const parsed = await runPythonJsonScript<{ metrics?: ProxyBasicMetrics | null }>('yfinance_market_data.py', ['fundamentals', symbol])
  return parsed?.metrics ?? null
}

async function fetchStooqQuote(symbol: string): Promise<ProxyQuotePayload | null> {
  const stooqSymbol = symbol.trim().toLowerCase()
  const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSymbol)}&i=d`
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'KairosMarketProxy/1.0',
    },
  })
  if (!res.ok) return null

  const csv = (await res.text()).trim()
  const firstLine = csv.split('\n').find((line) => line.trim().length > 0)
  if (!firstLine) return null

  const parts = firstLine.split(',')
  if (parts.length < 7) return null

  const parsedSymbol = parts[0]?.toUpperCase()
  const price = Number(parts[6])
  if (!parsedSymbol || !Number.isFinite(price) || price <= 0) return null

  return {
    symbol: parsedSymbol,
    name: parsedSymbol,
    currency: getCurrencyGuess(parsedSymbol),
    price,
    change: 0,
    changePercent: 0,
    provider: 'stooq',
  }
}

function marketProxyPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const url = req.url ? new URL(req.url, 'http://localhost') : null
    if (!url || !url.pathname.startsWith('/api/market/')) return false

    const endpoint = url.pathname.replace('/api/market/', '')
    const symbol = url.searchParams.get('symbol')?.trim() ?? ''
    const query = url.searchParams.get('q')?.trim() ?? ''
    const limit = Math.max(1, Math.min(20, Number(url.searchParams.get('limit') ?? '8') || 8))

    try {
      if (endpoint === 'quote') {
        if (!symbol) {
          json(res, 400, { error: 'Missing symbol parameter.' })
          return true
        }
        const yahoo = await fetchYahooQuote(symbol)
        if (yahoo) {
          json(res, 200, yahoo)
          return true
        }
        const stooq = await fetchStooqQuote(symbol)
        if (stooq) {
          json(res, 200, stooq)
          return true
        }
        json(res, 404, { error: 'No quote found.' })
        return true
      }

      if (endpoint === 'snapshot') {
        if (!symbol) {
          json(res, 400, { error: 'Missing symbol parameter.' })
          return true
        }
        const yahoo = await fetchYahooQuote(symbol)
        if (yahoo) {
          json(res, 200, yahoo)
          return true
        }
        const stooq = await fetchStooqQuote(symbol)
        if (stooq) {
          json(res, 200, stooq)
          return true
        }
        json(res, 404, { error: 'No snapshot found.' })
        return true
      }

      if (endpoint === 'search') {
        if (!query) {
          json(res, 400, { error: 'Missing q parameter.' })
          return true
        }
        const results = await fetchYahooSearch(query, limit)
        json(res, 200, { results })
        return true
      }

      if (endpoint === 'news') {
        if (!symbol) {
          json(res, 400, { error: 'Missing symbol parameter.' })
          return true
        }
        const items = await fetchYahooNews(symbol, limit)
        json(res, 200, { items })
        return true
      }

      if (endpoint === 'history') {
        if (!symbol) {
          json(res, 400, { error: 'Missing symbol parameter.' })
          return true
        }
        const days = Math.max(5, Math.min(730, Number(url.searchParams.get('days') ?? '90') || 90))
        const closes = await fetchYfinanceHistory(symbol, days)
        json(res, 200, { closes, provider: closes.length > 0 ? 'yfinance' : 'none' })
        return true
      }

      if (endpoint === 'fundamentals') {
        if (!symbol) {
          json(res, 400, { error: 'Missing symbol parameter.' })
          return true
        }
        const metrics = await fetchYfinanceFundamentals(symbol)
        json(res, 200, { metrics, provider: metrics ? 'yfinance' : 'none' })
        return true
      }

      return false
    } catch {
      json(res, 502, { error: 'Market proxy upstream request failed.' })
      return true
    }
  }

  return {
    name: 'kairos-market-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res)
        if (!handled) next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const handled = await handler(req, res)
        if (!handled) next()
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), marketProxyPlugin()],
  server: {
    port: 3000,
    open: true,
  },
})
