import { useEffect, useRef, useState } from 'react'
import { Plus, X, TrendingUp, BadgeEuro, WalletCards, RefreshCw } from 'lucide-react'
import { useStock } from '../../contexts/StockContext'
import { Stock } from '../../types'
import { fetchSymbolSnapshot, isPriceServiceConfigured, searchSymbols } from '../../services/priceService'

export function Watchlist() {
  const { stocks, addStock, removeStock, lastPriceSyncAt, refreshLivePrices, livePricesEnabled } = useStock()
  const [showAddForm, setShowAddForm] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [isRefreshingPrices, setIsRefreshingPrices] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [isSearchingSymbols, setIsSearchingSymbols] = useState(false)
  const [symbolResults, setSymbolResults] = useState<Array<{ symbol: string; description: string; type?: string }>>([])
  const [showSymbolResults, setShowSymbolResults] = useState(false)
  const [activeSymbolIndex, setActiveSymbolIndex] = useState(-1)
  const symbolDropdownRef = useRef<HTMLDivElement | null>(null)
  const [formData, setFormData] = useState({
    symbol: '',
    brokeragePlatform: 'scalable-capital',
  })
  const livePricesConfigured = isPriceServiceConfigured()

  const handleManualRefresh = async () => {
    if (!livePricesEnabled) return
    setIsRefreshingPrices(true)
    try {
      await refreshLivePrices()
    } finally {
      setIsRefreshingPrices(false)
    }
  }

  useEffect(() => {
    if (!showAddForm || !livePricesConfigured) {
      setSymbolResults([])
      setShowSymbolResults(false)
      setActiveSymbolIndex(-1)
      return
    }

    const query = formData.symbol.trim()
    if (query.length < 1) {
      setSymbolResults([])
      setShowSymbolResults(false)
      setActiveSymbolIndex(-1)
      return
    }

    let cancelled = false
    setIsSearchingSymbols(true)

    const timeout = setTimeout(async () => {
      const results = await searchSymbols(query)
      if (!cancelled) {
        setSymbolResults(results)
        setShowSymbolResults(results.length > 0)
        setActiveSymbolIndex(results.length > 0 ? 0 : -1)
        setIsSearchingSymbols(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      setIsSearchingSymbols(false)
    }
  }, [formData.symbol, showAddForm, livePricesConfigured])

  const selectSymbol = (symbol: string) => {
    setFormData((current) => ({ ...current, symbol }))
    setShowSymbolResults(false)
    setSymbolResults([])
    setActiveSymbolIndex(-1)
    setAddError(null)
  }

  useEffect(() => {
    if (!showSymbolResults || activeSymbolIndex < 0) return

    const node = symbolDropdownRef.current?.querySelector<HTMLButtonElement>(
      `[data-symbol-index="${activeSymbolIndex}"]`,
    )
    node?.scrollIntoView({ block: 'nearest' })
  }, [activeSymbolIndex, showSymbolResults])

  const handleSymbolKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowSymbolResults(false)
      return
    }

    if (symbolResults.length === 0) {
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setShowSymbolResults(true)
      setActiveSymbolIndex((current) =>
        current < symbolResults.length - 1 ? current + 1 : 0,
      )
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setShowSymbolResults(true)
      setActiveSymbolIndex((current) =>
        current > 0 ? current - 1 : symbolResults.length - 1,
      )
      return
    }

    if (e.key === 'Enter' && showSymbolResults) {
      e.preventDefault()
      const selected = symbolResults[activeSymbolIndex] ?? symbolResults[0]
      if (selected) {
        selectSymbol(selected.symbol)
      }
    }
  }

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault()
    const symbol = formData.symbol.trim().toUpperCase()
    if (!symbol) return

    setAddError(null)
    setIsAdding(true)

    try {
      const snapshot = await fetchSymbolSnapshot(symbol)
      if (!snapshot) {
        setAddError('Unable to resolve symbol. Check the ticker format and try again.')
        return
      }

      await addStock({
        symbol: snapshot.symbol,
        name: snapshot.name,
        currentPrice: snapshot.price,
        currency: snapshot.currency,
        brokeragePlatform: formData.brokeragePlatform,
      })

      setFormData({
        symbol: '',
        brokeragePlatform: 'scalable-capital',
      })
      setShowAddForm(false)
    } catch {
      setAddError('Unable to add stock right now. Please try again in a moment.')
    } finally {
      setIsAdding(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title">Watchlist</h2>
          <p className="page-subtitle">
            {stocks.length} {stocks.length === 1 ? 'stock' : 'stocks'} tracked
          </p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem' }} className="text-muted-main">
            {lastPriceSyncAt
              ? `Last price sync: ${new Date(lastPriceSyncAt).toLocaleTimeString()}`
              : 'Waiting for first live price sync...'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.55rem' }}>
          <button className="btn-ghost" onClick={() => void handleManualRefresh()} disabled={!livePricesEnabled || isRefreshingPrices}>
            <RefreshCw size={14} style={{ animation: isRefreshingPrices ? 'spin 1s linear infinite' : 'none' }} />
            {isRefreshingPrices ? 'Refreshing...' : 'Refresh Prices'}
          </button>
          <button className="btn-primary" onClick={() => setShowAddForm(!showAddForm)}>
            {showAddForm ? <><X size={14} /> Cancel</> : <><Plus size={14} /> Add Stock</>}
          </button>
        </div>
      </div>

      {showAddForm && (
        <div
          className="glass-card"
          style={{
            border: '1px solid rgba(99,102,241,0.3)',
            position: 'relative',
            zIndex: 30,
            overflow: 'visible',
            isolation: 'isolate',
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 1.25rem' }} className="text-white-main">
            Add New Stock
          </h3>
          <form onSubmit={handleAddStock}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label className="form-label">Symbol</label>
                <div style={{ position: 'relative' }}>
                  <input
                    className="glass-input"
                    type="text"
                    placeholder="e.g. AAPL"
                    value={formData.symbol}
                    onFocus={() => setShowSymbolResults(symbolResults.length > 0)}
                    onBlur={() => setTimeout(() => setShowSymbolResults(false), 120)}
                    onKeyDown={handleSymbolKeyDown}
                    onChange={e => setFormData({ ...formData, symbol: e.target.value })}
                  />
                  {showSymbolResults && (
                    <div
                      ref={symbolDropdownRef}
                      className="glass-card solid-dropdown"
                      style={{
                        position: 'absolute',
                        zIndex: 200,
                        top: 'calc(100% + 0.4rem)',
                        left: 0,
                        right: 0,
                        maxHeight: 240,
                        overflowY: 'auto',
                        padding: '0.45rem',
                      }}
                    >
                      {symbolResults.map((result, index) => (
                        <button
                          key={`${result.symbol}-${result.description}`}
                          data-symbol-index={index}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            selectSymbol(result.symbol)
                          }}
                          onMouseEnter={() => setActiveSymbolIndex(index)}
                          className={`solid-dropdown-item ${index === activeSymbolIndex ? 'active' : ''}`}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.85rem' }} className="text-white-main">
                            {result.symbol}
                          </div>
                          <div style={{ fontSize: '0.76rem' }} className="text-muted-main">
                            {result.description}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {isSearchingSymbols && (
                  <p style={{ margin: '0.4rem 0 0', fontSize: '0.72rem' }} className="text-muted-main">
                    Searching symbols...
                  </p>
                )}
              </div>
              <div>
                <label className="form-label">Brokerage</label>
                <select
                  className="glass-input"
                  value={formData.brokeragePlatform}
                  onChange={e => setFormData({ ...formData, brokeragePlatform: e.target.value })}
                >
                  <option value="scalable-capital">Scalable Capital</option>
                  <option value="trade-republic">Trade Republic</option>
                  <option value="comdirect">Comdirect</option>
                  <option value="dkb">DKB</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem' }} className="text-muted-main">
              Company name, currency, and live price are auto-fetched from your symbol.
            </p>
            {!livePricesConfigured && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#f59e0b' }}>
                Live price API key missing. Add VITE_FINNHUB_API_KEY in .env to enable symbol lookup.
              </p>
            )}
            {addError && (
              <p style={{ margin: '0 0 0.75rem', fontSize: '0.8rem', color: '#f87171' }}>
                {addError}
              </p>
            )}
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={isAdding || !livePricesConfigured}>
              <Plus size={14} /> {isAdding ? 'Fetching…' : 'Add to Watchlist'}
            </button>
          </form>
        </div>
      )}

      {stocks.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <TrendingUp size={48} color="rgba(99,102,241,0.5)" strokeWidth={1.5} />
          </div>
          <p style={{ fontWeight: 700, fontSize: '1.1rem', margin: '0.75rem 0 0.25rem' }} className="text-white-main">
            No stocks yet
          </p>
          <p style={{ fontSize: '0.875rem', margin: '0 0 1.5rem' }} className="text-muted-main">
            Add your first stock to start tracking
          </p>
          <button className="btn-primary" onClick={() => setShowAddForm(true)}>
            <Plus size={14} /> Add Stock
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
          {stocks.map((stock) => (
            <StockCard
              key={stock.id}
              stock={stock}
              onRemove={removeStock}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function StockCard({
  stock,
  onRemove,
}: {
  stock: Stock
  onRemove: (id: string) => void
}) {
  const platformColors: Record<string, string> = {
    'scalable-capital': 'rgba(99,102,241,0.3)',
    'trade-republic': 'rgba(16,185,129,0.3)',
    comdirect: 'rgba(245,158,11,0.3)',
    dkb: 'rgba(236,72,153,0.3)',
  }

  const borderColor = platformColors[stock.brokeragePlatform || ''] || 'rgba(255,255,255,0.1)'

  return (
    <div className="glass-card" style={{ border: `1px solid ${borderColor}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 44,
            height: 44,
            background: `linear-gradient(135deg, ${borderColor}, rgba(255,255,255,0.05))`,
            border: `1px solid ${borderColor}`,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <TrendingUp size={18} color="white" strokeWidth={2.2} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 800, fontSize: '1rem' }} className="text-white-main">{stock.symbol}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} className="text-muted-main">
              {stock.name}
            </p>
          </div>
        </div>
        <button
          onClick={() => onRemove(stock.id)}
          className="btn-danger"
          style={{ padding: '0.3rem 0.6rem', fontSize: '0.7rem' }}
        >
          <X size={12} /> Remove
        </button>
      </div>

      <div style={{ marginBottom: '0.875rem' }}>
        <label className="form-label">Current Price ({stock.currency})</label>
        <div
          className="glass-input"
          style={{
            fontWeight: 700,
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'default',
          }}
        >
          <span>{stock.currentPrice.toFixed(2)}</span>
          <span style={{ fontSize: '0.72rem' }} className="text-muted-main">Live</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.875rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} className="text-muted-main">
          <BadgeEuro size={14} />
          <span style={{ fontSize: '0.75rem' }}>{stock.currency}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }} className="text-muted-main">
          <WalletCards size={14} />
          <span style={{ fontSize: '0.75rem', textTransform: 'capitalize' }}>{(stock.brokeragePlatform || 'other').replace('-', ' ')}</span>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <span style={{ fontSize: '0.72rem' }} className="text-muted-main">
          {new Date(stock.addedDate).toLocaleDateString('de-DE')}
        </span>
      </div>
    </div>
  )
}
