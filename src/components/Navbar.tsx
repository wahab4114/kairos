import { LogOut, Moon, Sun, Timer } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'

export function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const { user, isDemoMode, signOut } = useAuth()
  const isLight = theme === 'light'

  return (
    <nav
      style={{
        background: isLight ? 'rgba(248,250,252,0.75)' : 'rgba(10,10,26,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: isLight ? '1px solid rgba(148,163,184,0.2)' : '1px solid rgba(255,255,255,0.07)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 64 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{
              width: 36,
              height: 36,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px rgba(99,102,241,0.4)',
            }}>
              <Timer size={18} color="white" strokeWidth={2.5} />
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: isLight ? '#0f172a' : 'white' }}>
              Kairos
            </span>
            <span style={{
              background: 'rgba(99,102,241,0.2)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: 6,
              padding: '2px 8px',
              fontSize: '0.65rem',
              fontWeight: 600,
              color: '#a5b4fc',
              textTransform: 'uppercase' as const,
              letterSpacing: '0.08em',
            }}>
              Beta
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: isLight ? '#334155' : 'rgba(226,232,240,0.92)' }}>
                {isDemoMode ? 'Demo Mode' : user?.email}
              </span>
              <span style={{ fontSize: '0.68rem', color: isLight ? '#64748b' : 'rgba(148,163,184,0.75)' }}>
                {isDemoMode ? 'Add Supabase keys to enable auth' : 'Supabase secured'}
              </span>
            </div>

            {!isDemoMode && (
              <button
                onClick={() => void signOut()}
                aria-label="Sign out"
                className="btn-ghost"
                style={{ padding: '0.5rem 0.75rem' }}
              >
                <LogOut size={15} strokeWidth={2} /> Sign out
              </button>
            )}

            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              style={{
                background: isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.07)',
                border: isLight ? '1px solid rgba(148,163,184,0.3)' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                color: isLight ? '#475569' : 'rgba(226,232,240,0.9)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.8rem',
                fontWeight: 500,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {isLight
                ? <><Moon size={15} strokeWidth={2} /> Dark</>
                : <><Sun size={15} strokeWidth={2} /> Light</>
              }
            </button>
          </div>
        </div>
      </div>
    </nav>
  )
}
