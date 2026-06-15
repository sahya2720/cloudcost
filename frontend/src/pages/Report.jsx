import { useEffect, useState } from 'react'
import Card from '../components/Card.jsx'
import { fetchReport } from '../services/api.js'

const PRIORITY_STYLE = {
  high:   { cls: 'pill-red',    icon: '🔴' },
  medium: { cls: 'pill-orange', icon: '🟠' },
  low:    { cls: 'pill-blue',   icon: '🔵' },
}

function ScoreBar({ value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ flex: 1, height: 6, borderRadius: 3,
        background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${value * 100}%`, height: '100%',
          borderRadius: 3, background: 'var(--grad)', transition: 'width .6s' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)',
        width: 36, textAlign: 'right' }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  )
}

export default function Report() {
  const [report, setReport]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetchReport()
      .then(setReport)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="spinner-icon" style={{ fontSize: 36 }}>⏳</span>
      <p className="text-sm text-2">Generating report from backend…</p>
    </div>
  )
  if (error) return (
    <div className="state-box">
      <span className="state-icon">⚠️</span>
      <p className="state-msg">Could not generate report: {error}</p>
    </div>
  )
  if (!report) return null

  const { dashboard, top_anomalies, cost_insights, recommendations, generated_at } = report
  const tsLabel = new Date(generated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Report header */}
      <div className="flex-between mb-24 fade-up" style={{ flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 className="page-title">FinOps Report</h1>
          <p className="page-sub">Generated {tsLabel} IST · All data sourced from processed dataset</p>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => window.print()}>
          🖨 Print / Export
        </button>
      </div>

      {/* ── Dashboard summary cards ── */}
      <div className="section-label mb-16 fade-up delay-1">📊 Executive Summary</div>
      <div className="kpi-row fade-up delay-1">
        {[
          { label: 'Total Resources',    val: dashboard.total_resources,                     sub: 'instances loaded' },
          { label: 'Total Cost',         val: dashboard.total_cost.toFixed(4),               sub: 'normalised units' },
          { label: 'Anomalies Found',    val: dashboard.anomaly_count,                       sub: `${dashboard.anomaly_rate_pct}% of fleet` },
          { label: 'Top Cost Driver',    val: dashboard.top_cost_driver || '—',              sub: 'by service type' },
          { label: 'Costliest Region',   val: cost_insights.costliest_region || '—',         sub: 'highest total spend' },
          { label: 'Underutilised',      val: cost_insights.underutilized_count,             sub: 'low util, high cost' },
        ].map((k, i) => (
          <Card key={k.label} className={`kpi-card fade-up delay-${(i % 3) + 1}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-val" style={{ fontSize: 22 }}>{k.val}</div>
            <div className="kpi-sub">{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* ── Cost by service (compact table) ── */}
      <Card className="card-pad fade-up delay-2" style={{ marginBottom: 22 }} noHover>
        <div className="chart-title">Cost Distribution by Service Type</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 32px', marginTop: 12 }}>
          {Object.entries(dashboard.cost_by_type).slice(0, 12).map(([svc, cost]) => {
            const pct = (cost / dashboard.total_cost * 100).toFixed(1)
            return (
              <div key={svc} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{svc}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 60, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(+pct, 100)}%`, height: '100%',
                      background: 'var(--grad)', borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 700, width: 38, textAlign: 'right' }}>
                    {pct}%
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* ── Top anomalies ── */}
      {top_anomalies.length > 0 && (
        <Card className="card-pad fade-up delay-2" style={{ marginBottom: 22 }} noHover>
          <div className="chart-title">🔴 Top Anomalies (up to 5)</div>
          <p className="text-xs text-3" style={{ marginBottom: 16 }}>
            Ranked by anomaly score — computed from cost deviation + utilisation pattern.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {top_anomalies.map((a, i) => {
              const delta    = a.cost - a.expected_cost
              const deltaStr = (delta >= 0 ? '+' : '') + delta.toFixed(4)
              return (
                <div key={`${a.resource_id}-${i}`}
                  style={{ padding: '14px 16px', borderRadius: 12,
                    background: 'var(--surface2)', border: '1px solid var(--border)',
                    display: 'grid', gridTemplateColumns: '1fr auto', gap: '8px 16px', alignItems: 'start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <code style={{ fontSize: 12, color: 'var(--text)', fontWeight: 700 }}>{a.resource_id}</code>
                      <span className="pill pill-blue" style={{ fontSize: 10 }}>{a.service}</span>
                      <span className="text-xs text-3">{a.region}</span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.58, marginBottom: 8 }}>
                      {a.reason}
                    </p>
                    <ScoreBar value={a.anomaly_score} />
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne, sans-serif',
                      color: delta > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {deltaStr}
                    </div>
                    <div className="text-xs text-3" style={{ marginTop: 2 }}>cost vs expected</div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>
                      actual: {a.cost.toFixed(4)}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* ── Cost insights ── */}
      <Card className="card-pad fade-up delay-3" style={{ marginBottom: 22 }} noHover>
        <div className="chart-title">💡 Cost Insights</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
          {[
            ['Avg Cost / Resource',    cost_insights.avg_cost_per_resource?.toFixed(6)],
            ['Cost Std Deviation',     cost_insights.cost_std_dev?.toFixed(6)],
            ['Top Cost Driver',        cost_insights.top_cost_driver],
            ['Costliest Region',       cost_insights.costliest_region],
            ['Underutilised Count',    cost_insights.underutilized_count],
            ['Inefficient Regions',    cost_insights.inefficient_regions?.length || 0],
          ].map(([label, val]) => (
            <div key={label} style={{ padding: '12px 14px', background: 'var(--grad-soft)',
              borderRadius: 10, border: '1px solid var(--border)' }}>
              <div className="text-xs text-3" style={{ marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>
                {val ?? '—'}
              </div>
            </div>
          ))}
        </div>

        {cost_insights.inefficient_regions?.length > 0 && (
          <div style={{ marginTop: 14, padding: '12px 14px', background: 'rgba(230,57,70,0.07)',
            borderRadius: 10, border: '1px solid rgba(230,57,70,0.20)' }}>
            <div className="text-xs text-3" style={{ marginBottom: 6 }}>⚠️ Inefficient Regions</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {cost_insights.inefficient_regions.map(r => (
                <span key={r} className="pill pill-red">{r}</span>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* ── Recommendations ── */}
      {recommendations.length > 0 && (
        <Card className="card-pad fade-up delay-4" noHover>
          <div className="chart-title">📋 Recommendations</div>
          <p className="text-xs text-3" style={{ marginBottom: 18 }}>
            Generated from anomaly scores and region efficiency analysis — not hardcoded.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {recommendations.map((rec, i) => {
              const ps = PRIORITY_STYLE[rec.priority] || PRIORITY_STYLE.low
              return (
                <div key={i} style={{ padding: '14px 18px', borderRadius: 12,
                  background: 'var(--surface2)', border: '1px solid var(--border)',
                  position: 'relative', paddingLeft: 20 }}>
                  {/* Left accent */}
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: 3, borderRadius: '12px 0 0 12px', background: 'var(--grad)' }} />

                  <div style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <span className={`pill ${ps.cls}`}>{ps.icon} {rec.priority}</span>
                        <span className="pill pill-blue">{rec.type}</span>
                        <code style={{ fontSize: 11, color: 'var(--text3)' }}>{rec.region}</code>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
                        {rec.action}
                      </p>
                    </div>
                    {rec.estimated_impact !== undefined && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Syne, sans-serif',
                          color: 'var(--success)' }}>
                          {rec.estimated_impact > 0 ? '+' : ''}{rec.estimated_impact.toFixed(4)}
                        </div>
                        <div className="text-xs text-3">est. impact</div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}