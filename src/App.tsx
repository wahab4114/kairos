import { useState } from 'react'
import { LayoutDashboard, ListChecks, Brain } from 'lucide-react'
import { AuthScreen } from './components/Auth/AuthScreen'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { StockProvider } from './contexts/StockContext'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { Navbar } from './components/Navbar'
import { Portfolio } from './components/Portfolio'
import { Watchlist } from './components/Watchlist/Watchlist'
import { Intelligence } from './components/Intelligence/Intelligence'
import './App.css'

type Tab = 'dashboard' | 'watchlist' | 'intelligence'

function AppContent() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard')
  const { theme } = useTheme()
  const { user, isConfigured, isLoading } = useAuth()
  const isLight = theme === 'light'

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={15} strokeWidth={2} /> },
    { id: 'watchlist', label: 'Watchlist', icon: <ListChecks size={15} strokeWidth={2} /> },
    { id: 'intelligence', label: 'Intelligence', icon: <Brain size={15} strokeWidth={2} /> },
  ]

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
        <div className="glass-card" style={{ minWidth: 280, textAlign: 'center' }}>
          <p className="page-title" style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Loading Kairos</p>
          <p className="page-subtitle">Checking your session and syncing your workspace.</p>
        </div>
      </div>
    )
  }

  if (isConfigured && !user) {
    return <AuthScreen />
  }

  return (
    <div style={{ minHeight: '100vh' }}>
      <Navbar />

      {/* Tab bar */}
      <div style={{
        background: isLight ? 'rgba(248,250,252,0.7)' : 'rgba(10,10,26,0.6)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: isLight ? '1px solid rgba(148,163,184,0.18)' : '1px solid rgba(255,255,255,0.06)',
        position: 'sticky',
        top: 64,
        zIndex: 40,
      }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem', display: 'flex', gap: 4 }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '1rem 1.1rem',
                background: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                color: activeTab === tab.id ? '#a5b4fc' : (isLight ? '#94a3b8' : 'rgba(148,163,184,0.7)'),
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '0.45rem',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '2rem 1.5rem' }}>
        {activeTab === 'dashboard' && <Portfolio />}
        {activeTab === 'watchlist' && <Watchlist />}
        {activeTab === 'intelligence' && <Intelligence />}
      </div>
    </div>
  )
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <StockProvider>
          <AppContent />
        </StockProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

export default App
