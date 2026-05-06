import { TrendingUp, Building2, LineChart, Newspaper, Radar } from 'lucide-react'
import { useStock } from '../contexts/StockContext'

export function Portfolio() {
  const { stocks, livePricesEnabled, lastPriceSyncAt } = useStock()

  const stats = [
    {
      label: 'Tracked Stocks',
      value: stocks.length,
      icon: <TrendingUp size={20} strokeWidth={2} color="#a5b4fc" />,
      gradient: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))',
      border: 'rgba(99,102,241,0.3)',
      glow: 'rgba(99,102,241,0.2)',
    },
    {
      label: 'Live Quotes',
      value: livePricesEnabled ? 'ON' : 'OFF',
      subtext: lastPriceSyncAt ? `Last sync ${new Date(lastPriceSyncAt).toLocaleTimeString()}` : 'Waiting for first sync',
      icon: <Radar size={20} strokeWidth={2} color="#c4b5fd" />,
      gradient: 'linear-gradient(135deg, rgba(139,92,246,0.25), rgba(236,72,153,0.15))',
      border: 'rgba(139,92,246,0.3)',
      glow: 'rgba(139,92,246,0.2)',
    },
    {
      label: 'News Monitored',
      value: stocks.length,
      subtext: 'Company updates enabled',
      icon: <Newspaper size={20} strokeWidth={2} color="#fcd34d" />,
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(239,68,68,0.15))',
      border: 'rgba(245,158,11,0.4)',
      glow: 'rgba(245,158,11,0.2)',
    },
    {
      label: 'Platforms',
      value: [...new Set(stocks.map((s: any) => s.brokeragePlatform).filter(Boolean))].length || '—',
      icon: <Building2 size={20} strokeWidth={2} color="#6ee7b7" />,
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.25), rgba(6,182,212,0.15))',
      border: 'rgba(16,185,129,0.3)',
      glow: 'rgba(16,185,129,0.2)',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* Page title */}
      <div>
        <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', margin: 0, letterSpacing: '-0.02em' }}>
          Dashboard
        </h2>
        <p style={{ color: 'rgba(148,163,184,0.8)', marginTop: 4, fontSize: '0.875rem' }}>
          Your personal stock overview
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
        {stats.map((stat, i) => (
          <div key={i} style={{
            background: stat.gradient,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${stat.border}`,
            borderRadius: 16,
            padding: '1.5rem',
            boxShadow: `0 8px 32px rgba(0,0,0,0.2), 0 0 40px ${stat.glow}`,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(148,163,184,0.8)', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                  {stat.label}
                </p>
                <p style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', margin: '0.5rem 0 0', lineHeight: 1, textShadow: `0 0 20px ${stat.glow}` }}>
                  {stat.value}
                </p>
                {stat.subtext && (
                  <p style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.6)', margin: '0.25rem 0 0' }}>{stat.subtext}</p>
                )}
              </div>
              <div style={{ opacity: 0.9 }}>{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Watchlist Preview */}
      <div className="glass-card">
        <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', margin: '0 0 1rem', letterSpacing: '-0.01em' }}>
          Recent Watchlist
        </h3>

        {stocks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.75rem' }}>
              <LineChart size={36} color="rgba(99,102,241,0.55)" strokeWidth={1.8} />
            </div>
            <p style={{ color: 'rgba(148,163,184,0.6)', fontSize: '0.875rem', marginTop: 8 }}>
              No stocks added yet — go to Watchlist to add your first one
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {(stocks as any[]).slice(0, 6).map((stock) => (
              <div key={stock.id} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.875rem 1rem',
                background: 'rgba(255,255,255,0.04)',
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.06)',
                transition: 'background 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
                    border: '1px solid rgba(99,102,241,0.3)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '0.7rem',
                    color: '#a5b4fc',
                    letterSpacing: '0.02em',
                  }}>
                    {stock.symbol.slice(0, 3)}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>{stock.symbol}</p>
                    <p style={{ margin: 0, fontSize: '0.75rem', color: 'rgba(148,163,184,0.7)' }}>{stock.name}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: 'white', fontSize: '0.9rem' }}>
                    {stock.currentPrice.toLocaleString('de-DE', { style: 'currency', currency: stock.currency || 'EUR' })}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.72rem', color: 'rgba(148,163,184,0.5)' }}>
                    {new Date(stock.addedDate).toLocaleDateString('de-DE')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
