import { getSupabaseClient } from '../lib/supabase'
import type { Stock } from '../types'

const DEMO_STOCKS_KEY = 'kairos-stocks'

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

function mapStockRow(row: StockRow): Stock {
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    currentPrice: Number(row.current_price),
    currency: row.currency,
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

  return (data as StockRow[]).map(mapStockRow)
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

  return mapStockRow(data as StockRow)
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

export async function updateStockPrice(userId: string, stockId: string, price: number) {
  const supabase = getSupabaseClient()

  if (!supabase) {
    const next = readLocalStocks(userId).map((stock) =>
      stock.id === stockId ? { ...stock, currentPrice: price } : stock,
    )
    writeLocalStocks(userId, next)
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
}
