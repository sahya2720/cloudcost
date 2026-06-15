import { useEffect, useState } from 'react'
import Card from '../components/Card.jsx'
import { fetchAnomalies } from '../services/api.js'

/* Score → colour band */
function scoreBand(s) {
  if (s >= 0.70) return { cls: 'pill-red',    label: 'Critical' }
  if (s >= 0.45) return { cls: 'pill-orange',  label: 'High' }
  if (s >= 0.25) return { cls: 'pill-blue',    label: 'Medium' }
  return               { cls: 'pill-green',   label: 'Low' }
}

const TH = { padding: '10px 14px', textAlign: 'left', fontSize: 11,
             fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
             color: 'var(--text3)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }
const TD = { padding: '11px 14px', borderBottom: '1px solid var(--border)',
             fontSize: 13, verticalAlign: 'top' }

export default function Anomalies() {
  const [data, setData]       = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')
  const [sortKey, setSortKey] = useState('anomaly_score')
  const [filter, setFilter]   = useState('all')

  useEffect(() => {
    fetchAnomalies()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="spinner-icon" style={{ fontSize: 36 }}>⏳</span>
      <p className="text-sm text-2">Loading anomaly records…</p>
    </div>
  )

  if (error) return (
    <div className="state-box">
      <span className="state-icon">⚠️</span>
      <p className="state-msg">Could not load anomalies: {error}</p>
    </div>
  )

  if (data.length === 0) return (
    <div className="state-box">
      <span className="state-icon">🎉</span>
      <p className="state-msg">No anomalies detected in the current dataset.</p>
    </div>
  )

  /* Filter */
  const filtered = filter === 'all' ? data : data.filter(r => {
    const b = scoreBand(r.anomaly_score).label.toLowerCase()
    return b === filter
  })

  /* Sort */
  const sorted = [...filtered].sort((a, b) =>
    sortKey === 'cost'           ? b.cost - a.cost
    : sortKey === 'anomaly_score' ? b.anomaly_score - a.anomaly_score
    : a.resource_id.localeCompare(b.resource_id)
  )

  const counts = data.reduce((acc, r) => {
    const l = scoreBand(r.anomaly_score).label.toLowerCase()
    acc[l] = (acc[l] || 0) + 1
    return acc
  }, {})

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16 fade-up" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">Anomaly Detection</h1>
          <p className="page-sub">
            {data.length} anomalous resources identified by IsolationForest + cost deviation analysis
          </p>
        </div>
        <div className="rec-summary-pills">
          <span className="pill pill-red">🔴 {counts.critical || 0} Critical</span>
          <span className="pill pill-orange">🟠 {counts.high || 0} High</span>
          <span className="pill pill-blue">🔵 {counts.medium || 0} Medium</span>
          <span className="pill pill-green">🟢 {counts.low || 0} Low</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-8 mb-24 fade-up delay-1" style={{ flexWrap: 'wrap' }}>
        {['all','critical','high','medium','low'].map(f => (
          <button key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f !== 'all' ? ` (${counts[f] || 0})` : ` (${data.length})`}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="text-xs text-3">Sort by:</span>
          {['anomaly_score','cost','resource_id'].map(k => (
            <button key={k}
              className={`btn btn-sm ${sortKey === k ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setSortKey(k)}>
              {k === 'anomaly_score' ? 'Score' : k === 'cost' ? 'Cost' : 'ID'}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <Card className="fade-up delay-2" noHover>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Resource ID</th>
                <th style={TH}>Service</th>
                <th style={TH}>Region</th>
                <th style={TH}>Actual Cost</th>
                <th style={TH}>Expected Cost</th>
                <th style={TH}>Δ Cost</th>
                <th style={TH}>Score</th>
                <th style={{ ...TH, minWidth: 280 }}>Reason</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row, i) => {
                const band  = scoreBand(row.anomaly_score)
                const delta = row.cost - row.expected_cost
                const isHigh = row.anomaly_score >= 0.45
                return (
                  <tr key={`${row.resource_id}-${i}`}
                    style={{ background: isHigh ? 'rgba(230,57,70,0.04)' : undefined }}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, color: 'var(--text)' }}>
                      {row.resource_id}
                    </td>
                    <td style={{ ...TD, color: 'var(--text2)' }}>{row.service}</td>
                    <td style={{ ...TD, color: 'var(--text2)' }}>{row.region}</td>
                    <td style={{ ...TD, fontWeight: 600,
                      color: isHigh ? 'var(--danger)' : 'var(--text)' }}>
                      {row.cost.toFixed(4)}
                    </td>
                    <td style={{ ...TD, color: 'var(--text2)' }}>{row.expected_cost.toFixed(4)}</td>
                    <td style={{ ...TD, fontWeight: 600,
                      color: delta > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {delta >= 0 ? '+' : ''}{delta.toFixed(4)}
                    </td>
                    <td style={TD}>
                      {/* Score bar */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 60, height: 6, borderRadius: 3,
                          background: 'var(--border)', overflow: 'hidden' }}>
                          <div style={{ width: `${row.anomaly_score * 100}%`, height: '100%',
                            borderRadius: 3, background: 'var(--grad)' }} />
                        </div>
                        <span className={`pill ${band.cls}`} style={{ fontSize: 10 }}>
                          {(row.anomaly_score * 100).toFixed(0)}%
                        </span>
                      </div>
                    </td>
                    <td style={{ ...TD, color: 'var(--text2)', lineHeight: 1.55 }}>
                      {row.reason}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)' }}>
          <span className="text-xs text-3">
            Showing {sorted.length} of {data.length} anomalies
            {filter !== 'all' ? ` (filtered: ${filter})` : ''}
          </span>
        </div>
      </Card>
    </div>
  )
}