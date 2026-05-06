import type { IncomingMessage, ServerResponse } from 'node:http'
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
