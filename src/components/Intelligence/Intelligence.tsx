import { useEffect, useRef, useState } from 'react'
import { Activity, Brain, Newspaper, RefreshCw, TrendingDown, TrendingUp, Minus, BarChart2, MessageSquare, Rocket, Scale, ShieldCheck, Sparkles } from 'lucide-react'
import { useStock } from '../../contexts/StockContext'
import { CompanyNewsItem, StockGuidance, consumeNewsFetchNotice, fetchCompanyNews } from '../../services/priceService'
import { getEnrichedGuidance, reprofileGuidance, type RecommendationProfile } from '../../services/recommendationEngine'

const INTELLIGENCE_REFRESH_MS = 60_000
const PROFILE_STORAGE_KEY = 'kairos-recommendation-profile'
const NEWS_STORAGE_KEY = 'kairos-intelligence-news-cache'

function loadPersistedNews(): Record<string, CompanyNewsItem[]> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(NEWS_STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, CompanyNewsItem[]>
    if (!parsed || typeof parsed !== 'object') return {}
    const next: Record<string, CompanyNewsItem[]> = {}
    Object.entries(parsed).forEach(([symbol, items]) => {
      if (Array.isArray(items) && items.length > 0) {
        next[symbol] = items
      }
    })
    return next
  } catch {
    return {}
  }
}

const PROFILE_OPTIONS: Array<{ value: RecommendationProfile; label: string }> = [
  { value: 'default', label: 'Default (All-round)' },
  { value: 'aggressive', label: 'Aggressive' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'conservative', label: 'Conservative' },
]

const PROFILE_EXPLANATIONS: Record<RecommendationProfile, string> = {
  default: 'Best starting point. Blends aggressive, balanced, and conservative logic for all-round decisions.',
  aggressive: 'Fast-reacting profile. Prioritizes momentum and very recent news; gives more buy/sell signals.',
  balanced: 'Middle ground. Keeps short-term reactivity with medium-term stability.',
  conservative: 'Risk-aware profile. Prioritizes fundamentals and longer-term context; fewer but stricter signals.',
}

const PROFILE_ICON: Record<RecommendationProfile, React.ReactNode> = {
  default: <Sparkles size={12} />,
  aggressive: <Rocket size={12} />,
  balanced: <Scale size={12} />,
  conservative: <ShieldCheck size={12} />,
}

// Score [-1,+1] → a colour that smoothly transitions red → amber → green
function scoreToColor(score: number): string {
  if (score >= 0.2) return 'var(--color-gain, #22c55e)'
  if (score <= -0.2) return 'var(--color-loss, #ef4444)'
  return 'rgba(255,255,255,0.45)'
}

// Score → bar fill width (0–100%)
function scoreToWidth(score: number): string {
  const width = Math.round(Math.abs(score) * 100)
  return `${Math.max(8, width)}%`
}

function SignalBar({ label, score, detail, icon }: {
  label: string
  score: number
  detail: string
  icon: React.ReactNode
}) {
  const color = scoreToColor(score)
  const width = scoreToWidth(score)
  const isPositive = score >= 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ color: 'rgba(255,255,255,0.4)' }}>{icon}</span>
          <span style={{ fontSize: '0.75rem', fontWeight: 600 }} className="text-white-main">{label}</span>
        </div>
        <span style={{ fontSize: '0.72rem', color, fontWeight: 700 }}>
          {score >= 0 ? '+' : ''}{score.toFixed(2)}
        </span>
      </div>
      {/* bar track */}
      <div style={{ height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute',
          top: 0,
          [isPositive ? 'left' : 'right']: 0,
          width,
          height: '100%',
          background: color,
          borderRadius: 4,
          transition: 'width 0.4s ease',
        }} />
      </div>
      <p style={{ margin: 0, fontSize: '0.72rem', lineHeight: 1.4 }} className="text-muted-main">{detail}</p>
    </div>
  )
}

export function Intelligence() {
  const { stocks } = useStock()
  const [isLoading, setIsLoading] = useState(false)
  const [profile, setProfile] = useState<RecommendationProfile>(() => {
    if (typeof window === 'undefined') return 'default'
    const raw = window.localStorage.getItem(PROFILE_STORAGE_KEY)
    if (raw === 'default' || raw === 'aggressive' || raw === 'balanced' || raw === 'conservative') {
      return raw
    }
    return 'default'
  })
  const [guidanceBySymbol, setGuidanceBySymbol] = useState<Record<string, StockGuidance>>({})
  const [newsBySymbol, setNewsBySymbol] = useState<Record<string, CompanyNewsItem[]>>(() => loadPersistedNews())
  const [newsLoadedBySymbol, setNewsLoadedBySymbol] = useState<Record<string, boolean>>(() => {
    const persisted = loadPersistedNews()
    const loaded: Record<string, boolean> = {}
    Object.keys(persisted).forEach((symbol) => {
      loaded[symbol] = true
    })
    return loaded
  })
  const [lastInsightsSyncAt, setLastInsightsSyncAt] = useState<string | null>(null)
  const [newsNotice, setNewsNotice] = useState<string | null>(null)
  const requestSeqRef = useRef(0)
  const skipFirstProfileRefreshRef = useRef(true)

  const symbolsKey = stocks.map((s) => s.symbol).sort().join('|')

  const loadIntelligence = async ({ refreshNews = true }: { refreshNews?: boolean } = {}) => {
    const requestId = ++requestSeqRef.current
    if (stocks.length === 0) {
      setGuidanceBySymbol({})
      if (refreshNews) {
        setNewsBySymbol({})
        setNewsLoadedBySymbol({})
      }
      return
    }

    setIsLoading(true)
    try {
      const symbols = stocks.map((s) => s.symbol)
      const guidancePromise = Promise.all(stocks.map((stock) => getEnrichedGuidance(stock.symbol, profile, stock.name)))
      const newsPromise = refreshNews
        ? Promise.all(stocks.map((stock) => fetchCompanyNews(stock.symbol, 5, 4, stock.name)))
        : null

      const guidanceResults = await guidancePromise

      if (requestId !== requestSeqRef.current) return

      let newsResults: CompanyNewsItem[][] | null = null
      if (refreshNews && newsPromise) {
        newsResults = await newsPromise
        if (requestId !== requestSeqRef.current) return

        const emptyIndexes = newsResults
          .map((items, idx) => ({ idx, items }))
          .filter(({ items }) => items.length === 0)
          .map(({ idx }) => idx)

        // First-load resilience: retry only empty symbols once after a short delay.
        if (emptyIndexes.length > 0) {
          await new Promise((resolve) => setTimeout(resolve, 900))
          if (requestId !== requestSeqRef.current) return

          const retryResults = await Promise.all(
            emptyIndexes.map((idx) => fetchCompanyNews(stocks[idx].symbol, 10, 4, stocks[idx].name)),
          )
          if (requestId !== requestSeqRef.current) return

          retryResults.forEach((items, retryIdx) => {
            if (items.length > 0 && newsResults) {
              const originalIdx = emptyIndexes[retryIdx]
              newsResults[originalIdx] = items
            }
          })
        }
      }

      const nextGuidance: Record<string, StockGuidance> = {}
      guidanceResults.forEach((g, i) => { if (g) nextGuidance[symbols[i]] = g })

      setGuidanceBySymbol(nextGuidance)
      if (refreshNews && newsResults) {
        setNewsBySymbol((current) => {
          const next: Record<string, CompanyNewsItem[]> = {}

          // Keep current entries for currently tracked symbols.
          symbols.forEach((symbol) => {
            if (current[symbol]) next[symbol] = current[symbol]
          })

          // Replace only when non-empty, or when no previous entry exists.
          newsResults.forEach((items, i) => {
            const symbol = symbols[i]
            if (items.length > 0 || !next[symbol]) {
              next[symbol] = items
            }
          })

          const persistable: Record<string, CompanyNewsItem[]> = {}
          Object.entries(next).forEach(([symbol, items]) => {
            if (items.length > 0) {
              persistable[symbol] = items
            }
          })
          if (typeof window !== 'undefined') {
            try {
              window.localStorage.setItem(NEWS_STORAGE_KEY, JSON.stringify(persistable))
            } catch {
              // ignore storage write failures
            }
          }

          return next
        })

        setNewsLoadedBySymbol((current) => {
          const next: Record<string, boolean> = {}
          symbols.forEach((symbol) => {
            next[symbol] = true
          })
          return { ...current, ...next }
        })

        const notice = consumeNewsFetchNotice()
        setNewsNotice(notice)
      }
      setLastInsightsSyncAt(new Date().toISOString())
    } finally {
      if (requestId === requestSeqRef.current) {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    void loadIntelligence({ refreshNews: true })
    const interval = setInterval(() => void loadIntelligence({ refreshNews: true }), INTELLIGENCE_REFRESH_MS)
    return () => clearInterval(interval)
  }, [symbolsKey])

  useEffect(() => {
    if (skipFirstProfileRefreshRef.current) {
      skipFirstProfileRefreshRef.current = false
      return
    }
    setGuidanceBySymbol((current) => {
      const next: Record<string, StockGuidance> = {}
      Object.entries(current).forEach(([symbol, guidance]) => {
        next[symbol] = reprofileGuidance(guidance, profile)
      })
      return next
    })
  }, [profile])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(PROFILE_STORAGE_KEY, profile)
  }, [profile])

  const actionMeta = {
    buy:  { label: 'Buy Bias',  className: 'badge-buy',       icon: <TrendingDown size={12} /> },
    hold: { label: 'Hold Bias', className: 'badge-triggered',  icon: <Minus size={12} /> },
    sell: { label: 'Sell Bias', className: 'badge-sell',       icon: <TrendingUp size={12} /> },
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="page-title">Intelligence</h2>
          <p className="page-subtitle">Multi-signal guidance: momentum · sentiment · fundamentals.</p>
          <p style={{ margin: '0.3rem 0 0', fontSize: '0.78rem' }} className="text-muted-main">
            {lastInsightsSyncAt
              ? `Last sync: ${new Date(lastInsightsSyncAt).toLocaleTimeString()}`
              : 'Waiting for first sync...'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <button className="btn-ghost" onClick={() => void loadIntelligence()} disabled={isLoading}>
            <RefreshCw size={14} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
            {isLoading ? 'Analysing...' : 'Refresh'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
        {PROFILE_OPTIONS.map((option) => {
          const active = option.value === profile
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setProfile(option.value)}
              style={{
                border: active ? '1px solid rgba(99,102,241,0.55)' : '1px solid rgba(255,255,255,0.14)',
                background: active ? 'rgba(99,102,241,0.16)' : 'rgba(255,255,255,0.04)',
                color: 'inherit',
                borderRadius: 999,
                padding: '0.35rem 0.55rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontSize: '0.74rem',
                cursor: 'pointer',
              }}
              aria-pressed={active}
            >
              <span style={{ color: active ? 'rgba(129,140,248,0.95)' : 'rgba(255,255,255,0.55)' }}>
                {PROFILE_ICON[option.value]}
              </span>
              <span style={{ fontWeight: active ? 700 : 600 }}>
                {option.label}
              </span>
            </button>
          )
        })}
      </div>

      {newsNotice && (
        <div
          className="glass-card"
          style={{
            border: '1px solid rgba(245, 158, 11, 0.35)',
            background: 'rgba(245, 158, 11, 0.10)',
            padding: '0.65rem 0.8rem',
          }}
        >
          <p style={{ margin: 0, fontSize: '0.78rem' }} className="text-white-main">
            {newsNotice}
          </p>
        </div>
      )}

      <div
        className="glass-card"
        style={{
          border: '1px solid rgba(99,102,241,0.24)',
          padding: '0.9rem 1rem',
          background: 'rgba(99,102,241,0.08)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.6rem',
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>
          {PROFILE_ICON[profile]}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
          <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700 }} className="text-white-main">
            {PROFILE_OPTIONS.find((p) => p.value === profile)?.label}
          </p>
          <p style={{ margin: 0, fontSize: '0.78rem' }} className="text-muted-main">
            {PROFILE_EXPLANATIONS[profile]}
          </p>
        </div>
      </div>

      {stocks.length === 0 && (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Brain size={40} color="rgba(99,102,241,0.55)" style={{ marginBottom: '0.75rem' }} />
          <p style={{ fontWeight: 700, fontSize: '1.05rem', margin: 0 }} className="text-white-main">
            Add stocks to unlock intelligence
          </p>
          <p className="text-muted-main" style={{ marginTop: '0.45rem', fontSize: '0.85rem' }}>
            Kairos analyses momentum, news sentiment, and fundamentals to generate explainable guidance.
          </p>
        </div>
      )}

      {stocks.map((stock) => {
        const guidance  = guidanceBySymbol[stock.symbol]
        const newsItems = newsBySymbol[stock.symbol] ?? []
        const hasLoadedNews = newsLoadedBySymbol[stock.symbol] === true
        const signals   = guidance?.signals

        return (
          <div key={stock.id} className="glass-card" style={{ border: '1px solid rgba(99,102,241,0.24)' }}>

            {/* ── Header ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '0.85rem' }}>
              <div>
                <p style={{ margin: 0, fontWeight: 800, fontSize: '1.02rem' }} className="text-white-main">{stock.symbol}</p>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }} className="text-muted-main">{stock.name}</p>
              </div>
              {guidance && (
                <span className={actionMeta[guidance.action].className} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
                  {actionMeta[guidance.action].icon}
                  {actionMeta[guidance.action].label} · {guidance.confidence}% confidence
                </span>
              )}
            </div>

            {/* ── Price row ── */}
            {guidance && (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem' }} className="text-muted-main">
                Price: <strong className="text-white-main">{guidance.price.toFixed(2)} {stock.currency}</strong>
                {' '}·{' '}
                Day change: <strong style={{ color: guidance.changePercent >= 0 ? 'var(--color-gain,#22c55e)' : 'var(--color-loss,#ef4444)' }}>
                  {guidance.changePercent >= 0 ? '+' : ''}{guidance.changePercent.toFixed(2)}%
                </strong>
              </p>
            )}

            {/* ── Signal breakdown bars ── */}
            {signals && (
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10,
                padding: '0.85rem 1rem',
                marginBottom: '1rem',
                display: 'grid',
                gap: '0.85rem',
              }}>
                <p style={{ margin: '0 0 0.25rem', fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }} className="text-muted-main">
                  Signal breakdown
                </p>
                <SignalBar
                  label="Momentum"
                  score={signals.momentum.score}
                  detail={signals.momentum.detail}
                  icon={<Activity size={12} />}
                />
                <SignalBar
                  label="Sentiment"
                  score={signals.sentiment.score}
                  detail={signals.sentiment.detail}
                  icon={<MessageSquare size={12} />}
                />
                <SignalBar
                  label="Fundamentals"
                  score={signals.fundamentals.score}
                  detail={signals.fundamentals.detail}
                  icon={<BarChart2 size={12} />}
                />
              </div>
            )}

            {/* ── Reasons ── */}
            {guidance ? (
              <ul style={{ margin: '0 0 1rem', paddingLeft: '1rem', display: 'grid', gap: '0.3rem' }}>
                {guidance.reasons.map((reason) => (
                  <li key={reason} style={{ fontSize: '0.8rem' }} className="text-muted-main">{reason}</li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: '0 0 1rem', fontSize: '0.8rem' }} className="text-muted-main">
                Analysing {stock.symbol}...
              </p>
            )}

            {/* ── News ── */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.6rem' }}>
                <Newspaper size={14} className="text-muted-main" />
                <span style={{ fontSize: '0.8rem', fontWeight: 700 }} className="text-white-main">Latest company updates</span>
              </div>

              {!hasLoadedNews && isLoading ? (
                <p style={{ margin: 0, fontSize: '0.78rem' }} className="text-muted-main">Loading latest company updates...</p>
              ) : newsItems.length === 0 ? (
                <p style={{ margin: 0, fontSize: '0.78rem' }} className="text-muted-main">No recent news found for this symbol.</p>
              ) : (
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {newsItems.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        textDecoration: 'none',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10,
                        padding: '0.6rem 0.7rem',
                        background: 'rgba(255,255,255,0.03)',
                        color: 'inherit',
                      }}
                    >
                      <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 600 }} className="text-white-main">{item.headline}</p>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem' }} className="text-muted-main">
                        {item.source} · {new Date(item.datetime * 1000).toLocaleString()}
                      </p>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })}

      <p style={{ margin: 0, fontSize: '0.75rem' }} className="text-muted-main">
        Signals combine price momentum, news sentiment (Finnhub / Loughran-McDonald lexicon), and basic fundamentals. Not financial advice.
      </p>
    </div>
  )
}
