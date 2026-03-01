import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function AuthScreen() {
  const [mode, setMode] = useState('login') // login | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email for a confirmation link!')
      } else if (mode === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        })
        if (error) throw error
        setMessage('Password reset email sent!')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      background: '#f8f8fc',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#e8e6f0',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=Playfair+Display:wght@700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input { font-family: inherit; background: #1e1e2e; border: 1px solid #2e2e42; color: #e8e6f0; padding: 11px 14px; border-radius: 9px; width: 100%; outline: none; font-size: 14px; }
        input:focus { border-color: #7c6af7; }
        .auth-btn { cursor: pointer; border: none; font-family: inherit; border-radius: 9px; font-weight: 600; font-size: 14px; padding: 12px; width: 100%; transition: filter .15s; }
        .auth-btn:hover { filter: brightness(1.1); }
        .link-btn { background: none; border: none; color: #7c6af7; font-family: inherit; font-size: 13px; cursor: pointer; padding: 0; }
        .link-btn:hover { text-decoration: underline; }
      `}</style>

      <div style={{ width: '100%', maxWidth: 380, padding: '0 20px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 900,
            background: 'linear-gradient(135deg,#a78bfa,#f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            marginBottom: 6 }}>
            Chronos
          </div>
          <div style={{ fontSize: 13, color: '#555' }}>Client & Time Blocking Planner</div>
        </div>

        <div style={{ background: '##ffffff', borderRadius: 16, padding: 28, border: '1px solid #1e1e2e', boxShadow: '0 24px 80px rgba(0,0,0,.4)' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#e8e6f0' }}>
            {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
          </h2>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 12 }}>
              <input type="email" placeholder="Email address" value={email}
                onChange={e => setEmail(e.target.value)} required />
            </div>
            {mode !== 'reset' && (
              <div style={{ marginBottom: 20 }}>
                <input type="password" placeholder="Password" value={password}
                  onChange={e => setPassword(e.target.value)} required minLength={6} />
              </div>
            )}
            {mode === 'reset' && <div style={{ marginBottom: 20 }} />}

            {error && (
              <div style={{ background: '#2a1a1a', border: '1px solid #ff444433', borderRadius: 8,
                padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#f87171' }}>
                {error}
              </div>
            )}
            {message && (
              <div style={{ background: '#1a2a1a', border: '1px solid #4ade8033', borderRadius: 8,
                padding: '10px 12px', marginBottom: 14, fontSize: 13, color: '#4ade80' }}>
                {message}
              </div>
            )}

            <button type="submit" className="auth-btn" disabled={loading}
              style={{ background: loading ? '#1e1e2e' : 'linear-gradient(135deg,#7c6af7,#a78bfa)', color: loading ? '#555' : '#fff', marginBottom: 14 }}>
              {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Email'}
            </button>
          </form>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: '#555' }}>
            {mode === 'login' && <>
              <button className="link-btn" onClick={() => { setMode('signup'); setError(null); setMessage(null); }}>
                Create account
              </button>
              <button className="link-btn" onClick={() => { setMode('reset'); setError(null); setMessage(null); }}>
                Forgot password?
              </button>
            </>}
            {mode === 'signup' && <>
              <button className="link-btn" onClick={() => { setMode('login'); setError(null); setMessage(null); }}>
                Already have an account? Sign in
              </button>
            </>}
            {mode === 'reset' && <>
              <button className="link-btn" onClick={() => { setMode('login'); setError(null); setMessage(null); }}>
                ← Back to sign in
              </button>
            </>}
          </div>
        </div>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#333' }}>
          Your data is private and secured by Supabase RLS.
        </p>
      </div>
    </div>
  )
}
