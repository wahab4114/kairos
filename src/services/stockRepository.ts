import { getSupabaseClient } from '../lib/supabase'
import type { Stock } from '../types'

const DEMO_STOCKS_KEY = 'kairos-stocks'
const DEMO_STOCK_SOURCES_KEY = 'kairos-stock-sources'

interface StockRow {
  id: string
  user_id: string
  symbol: string
  name: string
  current_price: number
  currency: string
  brokerage_platform: string | null
  added_at: string
}

function getStorageKey(baseKey: string, userId: string) {
  return `${baseKey}:${userId}`
}

function readLocalStocks(userId: string) {
  const raw = localStorage.getItem(getStorageKey(DEMO_STOCKS_KEY, userId)) ?? localStorage.getItem(DEMO_STOCKS_KEY)
  if (!raw) {
    return [] as Stock[]
  }

  try {
    return JSON.parse(raw) as Stock[]
  } catch {
    return [] as Stock[]
  }
}

function writeLocalStocks(userId: string, stocks: Stock[]) {
  localStorage.setItem(getStorageKey(DEMO_STOCKS_KEY, userId), JSON.stringify(stocks))
}

function readLocalStockSources(userId: string): Record<string, string> {
  const raw = localStorage.getItem(getStorageKey(DEMO_STOCK_SOURCES_KEY, userId))
  if (!raw) {
    return {}
  }

  try {
    return JSON.parse(raw) as Record<string, string>
  } catch {
    return {}
  }
}

function writeLocalStockSources(userId: string, sources: Record<string, string>) {
  localStorage.setItem(getStorageKey(DEMO_STOCK_SOURCES_KEY, userId), JSON.stringify(sources))
}

function persistLocalStockSource(userId: string, stockId: string, priceSource?: string) {
  const current = readLocalStockSources(userId)

  if (!priceSource) {
    if (!(stockId in current)) {
      return
    }
    delete current[stockId]
    writeLocalStockSources(userId, current)
    return
  }

  current[stockId] = priceSource
  writeLocalStockSources(userId, current)
}

function mapStockRow(row: StockRow, priceSource?: string): Stock {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    currentPrice: Number(row.current_price),
    currency: row.currency,
    priceSource,
    brokeragePlatform: row.brokerage_platform ?? undefined,
    addedDate: row.added_at,
  }
}

export async function listStocks(userId: string) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    return readLocalStocks(userId)
  }

  const { data, error } = await supabase
    .from('watchlist_stocks')
    .select('*')
    .eq('user_id', userId)
    .order('added_at', { ascending: false })

  if (error) {
    throw error
  }

  const stockSources = readLocalStockSources(userId)
  return (data as StockRow[]).map((row) => mapStockRow(row, stockSources[row.id]))
}

export async function createStock(userId: string, stock: Omit<Stock, 'id' | 'addedDate'>) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    const current = readLocalStocks(userId)
    const newStock: Stock = {
      ...stock,
      id: `stock-${crypto.randomUUID()}`,
      addedDate: new Date().toISOString(),
    }
    const next = [newStock, ...current]
    writeLocalStocks(userId, next)
    return newStock
  }

  const { data, error } = await supabase
    .from('watchlist_stocks')
    .insert({
      user_id: userId,
      symbol: stock.symbol,
      name: stock.name,
      current_price: stock.currentPrice,
      currency: stock.currency,
      brokerage_platform: stock.brokeragePlatform ?? null,
    })
    .select()
    .single()

  if (error) {
    throw error
  }

  const createdStock = mapStockRow(data as StockRow, stock.priceSource)
  persistLocalStockSource(userId, createdStock.id, stock.priceSource)
  return createdStock
}

export async function deleteStock(userId: string, stockId: string) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    const stocks = readLocalStocks(userId).filter((stock) => stock.id !== stockId)
    writeLocalStocks(userId, stocks)
    return
  }

  const { error } = await supabase
    .from('watchlist_stocks')
    .delete()
    .eq('user_id', userId)
    .eq('id', stockId)

  if (error) {
    throw error
  }
}

export async function updateStockPrice(userId: string, stockId: string, price: number, priceSource?: string) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    const next = readLocalStocks(userId).map((stock) =>
      stock.id === stockId ? { ...stock, currentPrice: price, priceSource: priceSource ?? stock.priceSource } : stock,
    )
    writeLocalStocks(userId, next)
    persistLocalStockSource(userId, stockId, priceSource)
    return
  }

  const { error } = await supabase
    .from('watchlist_stocks')
    .update({ current_price: price })
    .eq('user_id', userId)
    .eq('id', stockId)

  if (error) {
    throw error
  }

  persistLocalStockSource(userId, stockId, priceSource)
}
