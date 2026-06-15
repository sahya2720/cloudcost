import { useEffect, useState } from 'react'
import { postLogout } from '../services/api.js'

export default function Navbar({ user, onNavigate, onLogout, darkMode, toggleDark }) {
  const [scrolled, setScrolled]   = useState(false)
  const [loggingOut, setLogging]  = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleLogout = async () => {
    setLogging(true)
    try { await postLogout() } catch (_) { /* fire-and-forget */ }
    finally { setLogging(false) }
    onLogout()
  }

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <button className="nav-logo btn-ghost" onClick={() => onNavigate('landing')}>
        ⚡ OptiCloud
      </button>

      <div className="nav-right">
        {/* Theme toggle */}
        <span className="theme-label">{darkMode ? '🌙' : '☀️'}</span>
        <button
          className={`theme-toggle${darkMode ? ' active' : ''}`}
          onClick={toggleDark}
          aria-label="Toggle dark mode"
        />

        {/* Auth area */}
        {user ? (
          <>
            {/* Quick-nav links (only when logged in) */}
            {[
              { id: 'dashboard',     label: 'Dashboard' },
              { id: 'cost-overview', label: 'Cost' },
              { id: 'anomalies',     label: 'Anomalies' },
              { id: 'report',        label: 'Report' },
            ].map(link => (
              <button
                key={link.id}
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate(link.id)}
                style={{ fontSize: 13 }}
              >
                {link.label}
              </button>
            ))}

            {/* Avatar */}
            <button
              className="avatar-btn"
              title={user.name}
              onClick={() => onNavigate('landing')}
            >
              {user.name?.[0]?.toUpperCase() || 'U'}
            </button>

            {/* Logout */}
            <button
              className="btn btn-outline btn-sm"
              onClick={handleLogout}
              disabled={loggingOut}
              style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              {loggingOut ? '…' : 'Log out'}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('auth')}>
              Sign In
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('auth')}>
              Get Started
            </button>
          </>
        )}
      </div>
    </nav>
  )
}