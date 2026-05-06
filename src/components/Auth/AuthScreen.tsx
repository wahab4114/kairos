import { useState } from 'react'
import { LockKeyhole, Mail, Send } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function AuthScreen() {
  const { signInWithEmail } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setStatus('sending')
    setErrorMessage('')

    try {
      await signInWithEmail(email)
      setStatus('sent')
    } catch (error) {
      setStatus('error')
      setErrorMessage(error instanceof Error ? error.message : 'Unable to send login link.')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: 460, border: '1px solid rgba(99,102,241,0.22)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1rem' }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(99,102,241,0.28), rgba(139,92,246,0.18))',
            border: '1px solid rgba(99,102,241,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <LockKeyhole size={28} color="#a5b4fc" strokeWidth={2} />
          </div>
        </div>

        <h1 className="page-title" style={{ textAlign: 'center', fontSize: '1.9rem' }}>Secure Sign In</h1>
        <p className="page-subtitle" style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          Kairos uses Supabase magic-link authentication so you can keep one secure account across web and app later.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label className="form-label">Email</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="rgba(148,163,184,0.7)" style={{ position: 'absolute', left: 12, top: 12 }} />
              <input
                className="glass-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                style={{ paddingLeft: '2.3rem' }}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={status === 'sending'}>
            <Send size={14} /> {status === 'sending' ? 'Sending Link...' : 'Send Magic Link'}
          </button>
        </form>

        {status === 'sent' && (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#6ee7b7', textAlign: 'center' }}>
            Check your email for the login link.
          </p>
        )}

        {status === 'error' && (
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#fca5a5', textAlign: 'center' }}>
            {errorMessage}
          </p>
        )}
      </div>
    </div>
  )
}
