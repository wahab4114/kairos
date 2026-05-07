import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import {
  createStock,
  deleteStock,
  listStocks,
  updateStockPrice as persistStockPrice,
} from '../services/stockRepository'
import { Stock } from '../types'
import { fetchQuotes, isPriceServiceConfigured } from '../services/priceService'

const PRICE_REFRESH_MS = 60_000 // 60 seconds

interface StockContextType {
  stocks: Stock[]
  isLoading: boolean
  error: string | null
  addStock: (stock: Omit<Stock, 'id' | 'addedDate'>) => Promise<void>
  removeStock: (id: string) => Promise<void>
  refresh: () => Promise<void>
  livePricesEnabled: boolean
  lastPriceSyncAt: string | null
  refreshLivePrices: () => Promise<void>
}

const StockContext = createContext<StockContextType | undefined>(undefined)

export function StockProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [stocks, setStocks] = useState<Stock[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastPriceSyncAt, setLastPriceSyncAt] = useState<string | null>(null)
  const livePricesEnabled = isPriceServiceConfigured()
  const stocksRef = useRef(stocks)

  useEffect(() => {
    stocksRef.current = stocks
  }, [stocks])

  const refresh = async () => {
    if (!user) {
      setStocks([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const nextStocks = await listStocks(user.id)
      setStocks(nextStocks)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load investment data.')
    } finally {
      setIsLoading(false)
    }
  }

  const refreshLivePrices = async () => {
    if (!livePricesEnabled || !user) return

    const currentStocks = stocksRef.current
    const symbols = currentStocks.map((s) => s.symbol)
    if (symbols.length === 0) return

    const quotes = await fetchQuotes(symbols)
    if (quotes.size === 0) return

    setStocks((current) =>
      current.map((stock) => {
        const quote = quotes.get(stock.symbol)
        return quote
          ? { ...stock, currentPrice: quote.price, priceSource: quote.provider ?? stock.priceSource }
          : stock
      }),
    )

    for (const stock of currentStocks) {
      const quote = quotes.get(stock.symbol)
      if (!quote) continue
      void persistStockPrice(user.id, stock.id, quote.price, quote.provider)
    }

    setLastPriceSyncAt(new Date().toISOString())
  }

  useEffect(() => {
    if (!livePricesEnabled || !user) return

    const interval = setInterval(() => void refreshLivePrices(), PRICE_REFRESH_MS)
    return () => clearInterval(interval)
  }, [user, livePricesEnabled])

  useEffect(() => {
    if (!livePricesEnabled || !user) return
    if (stocks.length === 0) return

    void refreshLivePrices()
  }, [user, livePricesEnabled, stocks.length])

  useEffect(() => {
    void refresh()
  }, [user])

  const addStock = async (stock: Omit<Stock, 'id' | 'addedDate'>) => {
    if (!user) {
      return
    }

    setError(null)
    const newStock = await createStock(user.id, stock)
    setStocks((currentStocks) => [newStock, ...currentStocks])
  }

  const removeStock = async (id: string) => {
    if (!user) {
      return
    }

    setError(null)
    await deleteStock(user.id, id)
    setStocks((currentStocks) => currentStocks.filter((stock) => stock.id !== id))
  }

  return (
    <StockContext.Provider value={{ stocks, isLoading, error, addStock, removeStock, refresh, livePricesEnabled, lastPriceSyncAt, refreshLivePrices }}>
      {children}
    </StockContext.Provider>
  )
}

export function useStock() {
  const context = useContext(StockContext)
  if (!context) {
    throw new Error('useStock must be used within StockProvider')
  }
  return context
}
