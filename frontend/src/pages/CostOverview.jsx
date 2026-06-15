import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend
} from 'recharts'
import Card from '../components/Card.jsx'
import { fetchCostOverview } from '../services/api.js'

const COLORS = ['#1E90FF', '#5A4FCF', '#00D4FF', '#06D6A0', '#FFB703', '#E63946']

const EFF_COLOR = { efficient: 'var(--success)', inefficient: 'var(--danger)', average: 'var(--warning)' }
const EFF_ICON  = { efficient: '✅', inefficient: '⚠️', average: '➡️' }

const TH = { padding: '10px 14px', textAlign: 'left', fontSize: 11,
             fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
             color: 'var(--text3)', borderBottom: '1px solid var(--border)' }
const TD = { padding: '11px 14px', borderBottom: '1px solid var(--border)', fontSize: 13 }

export default function CostOverview() {
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    fetchCostOverview()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
      <span className="spinner-icon" style={{ fontSize: 36 }}>⏳</span>
      <p className="text-sm text-2">Loading cost overview…</p>
    </div>
  )
  if (error) return (
    <div className="state-box">
      <span className="state-icon">⚠️</span>
      <p className="state-msg">Could not load cost overview: {error}</p>
    </div>
  )
  if (!data) return null

  const { top_3_services_by_cost, cost_by_region_with_efficiency, underutilized_resources } = data

  /* Region bar chart data */
  const regionChartData = cost_by_region_with_efficiency
    .slice(0, 12)
    .map(r => ({
      name:          r.region.split('-').slice(0, 2).join('-'),
      full_region:   r.region,
      cost:          r.total_cost,
      cost_per_usage: r.cost_per_usage,
      flag:          r.efficiency_flag,
    }))

  return (
    <div>
      <h1 className="page-title fade-up">Cost Overview</h1>
      <p className="page-sub fade-up delay-1">
        Service cost breakdown, region efficiency analysis, and underutilised resource identification
      </p>

      {/* Top 3 services — prominent cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginBottom: 28 }}>
        {top_3_services_by_cost.map((svc, i) => (
          <Card key={svc.service} className={`kpi-card fade-up delay-${i + 1}`}>
            <div className="kpi-label">#{i + 1} Top Cost Driver</div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 16, fontWeight: 700,
              color: 'var(--text)', marginBottom: 6 }}>
              {svc.service}
            </div>
            <div className="kpi-val">{svc.total_cost.toFixed(4)}</div>
            <div className="kpi-sub">{svc.resource_count} resources</div>
          </Card>
        ))}
      </div>

      {/* Region charts */}
      <div className="charts-grid fade-up delay-2" style={{ marginBottom: 26 }}>
        {/* Bar: total cost by region */}
        <Card className="chart-card">
          <div className="chart-title">Total Cost by Region</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={regionChartData} margin={{ top: 5, right: 12, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10 }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.full_region || ''}
                formatter={v => [v.toFixed(4), 'Total Cost']}
              />
              <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
                {regionChartData.map((r, i) => (
                  <Cell key={i} fill={
                    r.flag === 'inefficient' ? '#E63946'
                    : r.flag === 'efficient' ? '#06D6A0'
                    : '#1E90FF'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, padding: '8px 0 0', justifyContent: 'center', flexWrap: 'wrap' }}>
            {[['#06D6A0','Efficient'],['#1E90FF','Average'],['#E63946','Inefficient']].map(([c,l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: c, display: 'inline-block' }} />
                {l}
              </div>
            ))}
          </div>
        </Card>

        {/* Bar: cost-per-usage efficiency */}
        <Card className="chart-card">
          <div className="chart-title">Cost-per-Usage Ratio by Region</div>
          <p className="text-xs text-3" style={{ marginBottom: 12 }}>
            Higher = less efficient (cost ÷ avg utilisation). Dataset average shown as baseline.
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={regionChartData} margin={{ top: 5, right: 12, bottom: 30, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10 }}
                angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
                formatter={v => [v.toFixed(4), 'Cost/Usage']}
              />
              <Bar dataKey="cost_per_usage" radius={[4, 4, 0, 0]}>
                {regionChartData.map((r, i) => (
                  <Cell key={i} fill={
                    r.flag === 'inefficient' ? '#E63946'
                    : r.flag === 'efficient'  ? '#06D6A0'
                    : '#FFB703'
                  } />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Region efficiency table */}
      <Card className="fade-up delay-3" noHover style={{ marginBottom: 26 }}>
        <div style={{ padding: '20px 24px 4px' }}>
          <div className="chart-title">Region Efficiency Details</div>
          <p className="text-xs text-3" style={{ marginBottom: 12 }}>
            Efficiency is classified relative to the dataset mean cost-per-usage ratio.
          </p>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Region</th>
                <th style={TH}>Total Cost</th>
                <th style={TH}>Avg CPU %</th>
                <th style={TH}>Avg Memory %</th>
                <th style={TH}>Cost / Usage</th>
                <th style={TH}>Efficiency</th>
              </tr>
            </thead>
            <tbody>
              {cost_by_region_with_efficiency.map(r => (
                <tr key={r.region}>
                  <td style={{ ...TD, color: 'var(--text)', fontWeight: 500 }}>{r.region}</td>
                  <td style={{ ...TD, color: 'var(--text2)' }}>{r.total_cost.toFixed(4)}</td>
                  <td style={{ ...TD, color: 'var(--text2)' }}>{r.avg_cpu.toFixed(1)}%</td>
                  <td style={{ ...TD, color: 'var(--text2)' }}>{r.avg_memory.toFixed(1)}%</td>
                  <td style={{ ...TD, fontWeight: 600, color: EFF_COLOR[r.efficiency_flag] }}>
                    {r.cost_per_usage.toFixed(4)}
                  </td>
                  <td style={TD}>
                    <span className={`pill ${r.efficiency_flag === 'efficient' ? 'pill-green'
                      : r.efficiency_flag === 'inefficient' ? 'pill-red' : 'pill-orange'}`}>
                      {EFF_ICON[r.efficiency_flag]} {r.efficiency_flag.charAt(0).toUpperCase() + r.efficiency_flag.slice(1)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Underutilized resources */}
      {underutilized_resources.length > 0 && (
        <Card className="fade-up delay-4" noHover>
          <div style={{ padding: '20px 24px 4px' }}>
            <div className="chart-title">
              ⚡ Underutilised Resources ({underutilized_resources.length})
            </div>
            <p className="text-xs text-3" style={{ marginBottom: 12 }}>
              Resources with utilisation in the bottom 25th percentile but cost above the dataset median.
            </p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Resource ID</th>
                  <th style={TH}>Service</th>
                  <th style={TH}>Region</th>
                  <th style={TH}>Cost</th>
                  <th style={TH}>CPU %</th>
                  <th style={TH}>Memory %</th>
                  <th style={{ ...TH, minWidth: 300 }}>Why Flagged</th>
                </tr>
              </thead>
              <tbody>
                {underutilized_resources.map((r, i) => (
                  <tr key={`${r.resource_id}-${i}`}>
                    <td style={{ ...TD, fontFamily: 'monospace', fontSize: 12, color: 'var(--text)' }}>
                      {r.resource_id}
                    </td>
                    <td style={{ ...TD, color: 'var(--text2)' }}>{r.service}</td>
                    <td style={{ ...TD, color: 'var(--text2)' }}>{r.region}</td>
                    <td style={{ ...TD, color: 'var(--warning)', fontWeight: 600 }}>
                      {r.cost.toFixed(4)}
                    </td>
                    <td style={{ ...TD, color: r.cpu < 15 ? 'var(--danger)' : 'var(--text2)' }}>
                      {r.cpu.toFixed(1)}%
                    </td>
                    <td style={{ ...TD, color: r.memory < 20 ? 'var(--danger)' : 'var(--text2)' }}>
                      {r.memory.toFixed(1)}%
                    </td>
                    <td style={{ ...TD, color: 'var(--text2)', lineHeight: 1.55, fontSize: 12 }}>
                      {r.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}