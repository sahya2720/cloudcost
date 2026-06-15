const NAV_ITEMS = [
  { id: 'dashboard',       icon: '📊', label: 'Dashboard' },
  { id: 'cost-overview',   icon: '💰', label: 'Cost Overview' },
  { id: 'anomalies',       icon: '🔍', label: 'Anomalies' },
  { id: 'recommendations', icon: '💡', label: 'Recommendations' },
  { id: 'report',          icon: '📄', label: 'Report' },
  { id: 'upload',          icon: '📤', label: 'Upload Data' },
]

export default function Sidebar({ active, onNavigate }) {
  return (
    <aside className="sidebar">
      {NAV_ITEMS.map((item, i) => (
        <button
          key={item.id}
          className={`sidebar-item${active === item.id ? ' active' : ''}`}
          onClick={() => onNavigate(item.id)}
          style={{ animationDelay: `${i * 0.05}s` }}
        >
          <span className="sidebar-icon">{item.icon}</span>
          {item.label}
        </button>
      ))}

      <div className="sidebar-divider" />

      <button
        className="sidebar-item"
        style={{ marginTop: 'auto' }}
        onClick={() => onNavigate('landing')}
      >
        <span className="sidebar-icon">🏠</span>
        Home
      </button>
    </aside>
  )
}