import { useState } from 'react'

import Navbar  from './components/Navbar.jsx'
import Sidebar from './components/Sidebar.jsx'

import LandingPage           from './pages/LandingPage.jsx'
import AuthPage              from './pages/AuthPage.jsx'
import UploadPage            from './pages/UploadPage.jsx'
import Dashboard             from './pages/Dashboard.jsx'
import RecommendationPage    from './pages/RecommendationPage.jsx'
import RecommendationDetails from './pages/RecommendationDetails.jsx'
import Anomalies             from './pages/Anomalies.jsx'
import CostOverview          from './pages/CostOverview.jsx'
import Report                from './pages/Report.jsx'

// All pages that require auth + render inside the sidebar shell
const SHELL_PAGES = [
  'dashboard', 'recommendations', 'rec-details',
  'upload', 'anomalies', 'cost-overview', 'report',
]

export default function App() {
  const [dark, setDark]       = useState(false)
  const [user, setUser]       = useState(null)
  const [page, setPage]       = useState('landing')
  const [selectedRec, setRec] = useState(null)

  const themeClass = dark ? 'dark' : 'light'

  const navigate = (target) => {
    if (SHELL_PAGES.includes(target) && !user) { setPage('auth'); return }
    setPage(target)
  }

  const handleLogin  = (userData) => setUser(userData)
  const handleLogout = () => { setUser(null); setPage('landing') }

  const handleUploadComplete = () => setPage('dashboard')
  const handleSelectRec = (rec) => { setRec(rec); setPage('rec-details') }

  const inShell      = user && SHELL_PAGES.includes(page)
  const sidebarActive = page === 'rec-details' ? 'recommendations' : page

  return (
    <div
      className={themeClass}
      style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}
    >
      <Navbar
        user={user}
        onNavigate={navigate}
        onLogout={handleLogout}
        darkMode={dark}
        toggleDark={() => setDark(d => !d)}
      />

      {inShell ? (
        <div className="layout-shell">
          <Sidebar active={sidebarActive} onNavigate={navigate} />
          <main className="page-main">
            {page === 'dashboard'       && <Dashboard         onNavigate={navigate} />}
            {page === 'recommendations' && <RecommendationPage onSelectRec={handleSelectRec} />}
            {page === 'rec-details'     && selectedRec && (
              <RecommendationDetails
                rec={selectedRec}
                onBack={() => setPage('recommendations')}
              />
            )}
            {page === 'upload'          && <UploadPage onComplete={handleUploadComplete} />}
            {page === 'anomalies'       && <Anomalies />}
            {page === 'cost-overview'   && <CostOverview />}
            {page === 'report'          && <Report />}
          </main>
        </div>
      ) : (
        <div style={{ paddingTop: 64 }}>
          {page === 'landing' && <LandingPage user={user} onNavigate={navigate} />}
          {page === 'auth'    && <AuthPage onLogin={handleLogin} onNavigate={navigate} />}
          {SHELL_PAGES.includes(page) && !user && (
            <AuthPage onLogin={handleLogin} onNavigate={navigate} />
          )}
        </div>
      )}
    </div>
  )
}