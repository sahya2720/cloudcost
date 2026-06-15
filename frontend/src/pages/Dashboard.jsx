import { useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import Card from '../components/Card';
import { fetchDashboard, fetchResources } from '../services/api';

const COLORS = ['#1E90FF', '#5A4FCF', '#00D4FF', '#06D6A0', '#FFB703', '#E63946'];

function fmtCost(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n?.toFixed(2) ?? 0}`;
}

export default function Dashboard({ onNavigate }) {
  const [kpis, setKpis]       = useState(null);
  const [resources, setRes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [dash, res] = await Promise.all([fetchDashboard(), fetchResources()]);
        setKpis(dash);
        setRes(res);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex-center" style={{ minHeight: '60vh', flexDirection: 'column', gap: 16 }}>
        <span style={{ fontSize: 40 }} className="spinner-icon">⏳</span>
        <p className="text-sm text-2">Loading dashboard from backend…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-box">
        <span className="state-icon">⚠️</span>
        <p className="state-msg">Could not load dashboard: {error}</p>
        <button className="btn btn-primary" onClick={() => onNavigate('upload')}>
          Upload Data First
        </button>
      </div>
    );
  }

  /* ── Derive chart data from real resources ── */
  // Cost by resource type (pie)
  const costByType = Object.entries(
    resources.reduce((acc, r) => {
      acc[r.resource_type] = (acc[r.resource_type] || 0) + (r.cost || 0);
      return acc;
    }, {})
  )
    .map(([name, value]) => ({ name, value: +value.toFixed(2) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Cost by region (bar-style via line)
  const costByRegion = Object.entries(
    resources.reduce((acc, r) => {
      const short = r.region?.split('-').slice(0, 2).join('-') || r.region || 'unknown';
      acc[short] = (acc[short] || 0) + (r.cost || 0);
      return acc;
    }, {})
  )
    .map(([name, cost]) => ({ name, cost: +cost.toFixed(2) }))
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 8);

  const KPI = [
    { label: 'Total Cost',       val: fmtCost(kpis.total_cost),    sub: 'from all resources' },
    { label: 'Total Resources',  val: kpis.total_resources,         sub: 'instances loaded' },
    { label: 'Anomalies Found',  val: kpis.anomaly_count,           sub: 'flagged by ML' },
    { label: 'Anomaly Rate',
      val: kpis.total_resources
        ? `${((kpis.anomaly_count / kpis.total_resources) * 100).toFixed(1)}%`
        : '—',
      sub: 'of total instances' },
  ];

  return (
    <div>
      <h1 className="page-title fade-up">Dashboard</h1>
      <p className="page-sub fade-up delay-1">
        Real-time metrics from your uploaded billing dataset · powered by FastAPI
      </p>

      {/* KPI row */}
      <div className="kpi-row">
        {KPI.map((k, i) => (
          <Card key={k.label} className={`kpi-card fade-up delay-${i + 1}`}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-val">{k.val}</div>
            <div className="kpi-sub">{k.sub}</div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Cost by region — line chart */}
        <Card className="chart-card fade-up delay-2">
          <div className="chart-title">Cost by Region</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={costByRegion} margin={{ top: 5, right: 16, bottom: 30, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
              <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
                labelStyle={{ color: 'var(--text)' }}
                formatter={v => [`$${v.toLocaleString()}`, 'Cost']}
              />
              <Line type="monotone" dataKey="cost" stroke="#1E90FF" strokeWidth={2.5} dot={{ r: 4, fill: '#1E90FF' }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Cost by service type — pie chart */}
        <Card className="chart-card fade-up delay-3">
          <div className="chart-title">Cost by Service Type</div>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={costByType}
                dataKey="value"
                nameKey="name"
                cx="50%" cy="50%"
                outerRadius={90}
                innerRadius={50}
                paddingAngle={3}
                label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {costByType.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
                formatter={v => [`$${v.toLocaleString()}`, 'Cost']}
              />
              <Legend wrapperStyle={{ fontSize: 12, color: 'var(--text2)' }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Anomaly table */}
      {kpis.anomaly_count > 0 && (
        <Card className="card-pad fade-up delay-4" style={{ marginTop: 22 }}>
          <div className="chart-title">
            🔴 Anomalous Resources ({kpis.anomaly_count} flagged)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  {['Resource ID', 'Type', 'Region', 'Cost ($)', 'CPU %', 'Memory %'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11,
                      fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
                      color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {resources
                  .filter(r => r.anomaly)
                  .slice(0, 10)
                  .map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '9px 12px', color: 'var(--text)', fontFamily: 'monospace', fontSize: 12 }}>{r.resource_id}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{r.resource_type}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{r.region}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--danger)', fontWeight: 600 }}>{fmtCost(r.cost)}</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{r.cpu_utilization?.toFixed(1)}%</td>
                      <td style={{ padding: '9px 12px', color: 'var(--text2)' }}>{r.memory_utilization?.toFixed(1)}%</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          {kpis.anomaly_count > 10 && (
            <p className="text-xs text-3" style={{ marginTop: 12 }}>
              Showing 10 of {kpis.anomaly_count} anomalies. Visit Recommendations for full list.
            </p>
          )}
        </Card>
      )}

      <div style={{ marginTop: 24, textAlign: 'right' }}>
        <button className="btn btn-primary" onClick={() => onNavigate('recommendations')}>
          View Recommendations →
        </button>
      </div>
    </div>
  );
}