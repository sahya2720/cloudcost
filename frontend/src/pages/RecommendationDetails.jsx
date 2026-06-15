import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import Card from '../components/Card';
import { fetchResources } from '../services/api';

function fmtCost(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

/* Derive confidence from rule type: cost-spike > idle > over-prov */
function deriveConfidence(issue = '') {
  const low = issue.toLowerCase();
  if (low.includes('high-cost')) return 0.92;
  if (low.includes('idle'))      return 0.85;
  return 0.70;
}

/* Actions per rule type */
function actionSteps(issue = '') {
  const low = issue.toLowerCase();
  if (low.includes('idle')) return [
    'Verify no background processes depend on this instance.',
    'Schedule automated shutdown during off-hours.',
    'Consider switching to on-demand or spot provisioning.',
    'Enable auto-scaling to spin up only under real load.',
  ];
  if (low.includes('over-prov')) return [
    'Review workload CPU & memory metrics over a 7-day window.',
    'Downsize to the next smaller instance SKU.',
    'Evaluate replacing with a managed service offering.',
    'Set a budget alert at 80% of projected monthly cost.',
  ];
  return [
    'Audit recent workload changes and data-transfer volumes.',
    'Review reserved-instance commitments vs. on-demand usage.',
    'Set billing alerts to catch future spikes early.',
    'Investigate unusually large network egress charges.',
  ];
}

function riskStatement(issue = '') {
  const low = issue.toLowerCase();
  if (low.includes('idle'))      return 'Continuous spend on an unused instance burns budget with zero ROI. Left unchecked, this pattern compounds across your estate.';
  if (low.includes('over-prov')) return 'Capital locked in unused compute capacity prevents right-sizing. Missed savings accumulate monthly.';
  return 'Uncontrolled cost growth risks budget overruns and may obscure genuinely anomalous activity in billing reports.';
}

export default function RecommendationDetails({ rec, onBack }) {
  const [peers, setPeers]         = useState([]);
  const [sliderPct, setSliderPct] = useState(50);
  const [loadingPeers, setLP]     = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const all = await fetchResources();
        // Same resource_type as peers for the bar chart
        const same = all
          .filter(r => r.resource_type === rec.resource_type)
          .slice(0, 8)
          .map(r => ({
            name: r.resource_id?.slice(-6) || r.resource_id,
            cpu:  +(r.cpu_utilization || 0).toFixed(1),
            cost: +(r.cost || 0).toFixed(2),
            mem:  +(r.memory_utilization || 0).toFixed(1),
          }));
        setPeers(same);
      } catch (_) { /* non-critical */ }
      finally { setLP(false); }
    })();
  }, [rec]);

  const confidence   = deriveConfidence(rec.issue);
  const estimatedSave = (rec.cost * sliderPct) / 100;

  /* Radar data from real fields */
  const radarData = [
    { metric: 'CPU %',    value: +(rec.cpu_utilization || 0).toFixed(1),    max: 100 },
    { metric: 'Memory %', value: +(rec.memory_utilization || 0).toFixed(1), max: 100 },
    { metric: 'Runtime',  value: Math.min(+(rec.runtime_hours || 0).toFixed(0), 100), max: 100 },
    { metric: 'Cost Idx', value: Math.min(+(rec.cost / 100).toFixed(1), 100), max: 100 },
  ];

  return (
    <div className="details-root">
      <button className="back-btn" onClick={onBack}>
        ← Back to Recommendations
      </button>

      {/* Header */}
      <div className="details-header fade-up">
        <div>
          <div className="details-title">
            {rec.issue?.toLowerCase().includes('idle')       && 'Idle Instance Detected'}
            {rec.issue?.toLowerCase().includes('over-prov')  && 'Over-Provisioned Resource'}
            {rec.issue?.toLowerCase().includes('high-cost')  && 'Cost Spike Anomaly'}
            {!rec.issue?.toLowerCase().includes('idle') &&
             !rec.issue?.toLowerCase().includes('over-prov') &&
             !rec.issue?.toLowerCase().includes('high-cost') && 'Resource Optimisation'}
          </div>
          <div className="details-id">
            ID: {rec.resource_id} · {rec.resource_type} · {rec.region}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--danger)', fontFamily: 'Syne, sans-serif' }}>
            {fmtCost(rec.cost)}
          </div>
          <div className="text-xs text-3">resource cost on record</div>
        </div>
      </div>

      {/* Metric tiles */}
      <div className="metrics-row fade-up delay-1">
        {[
          { label: 'CPU Util.',   val: `${(rec.cpu_utilization||0).toFixed(1)}%` },
          { label: 'Memory',      val: `${(rec.memory_utilization||0).toFixed(1)}%` },
          { label: 'Runtime',     val: `${(rec.runtime_hours||0).toFixed(1)}h` },
          { label: 'Cost',        val: fmtCost(rec.cost) },
          { label: 'Cluster',     val: rec.cluster != null ? `#${rec.cluster}` : '—' },
          { label: 'Anomaly',     val: rec.anomaly ? '🔴 Yes' : '🟢 No' },
        ].map(m => (
          <Card key={m.label} className="metric-tile no-lift">
            <div className="metric-num">{m.val}</div>
            <div className="metric-lbl">{m.label}</div>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="charts-grid fade-up delay-2" style={{ marginBottom: 22 }}>
        {/* Peer CPU vs Cost bar chart */}
        <Card className="chart-card">
          <div className="chart-title">CPU & Cost — Same Service Type Peers</div>
          {loadingPeers ? (
            <div className="flex-center" style={{ height: 200 }}>
              <span className="spinner-icon" style={{ fontSize: 28 }}>⏳</span>
            </div>
          ) : peers.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={peers} margin={{ top: 5, right: 12, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
                <YAxis yAxisId="left" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fill: 'var(--text3)', fontSize: 10 }} tickFormatter={v => `$${(v/1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
                  labelStyle={{ color: 'var(--text)' }}
                />
                <Bar yAxisId="left"  dataKey="cpu"  name="CPU %"    fill="#1E90FF" radius={[4,4,0,0]} />
                <Bar yAxisId="right" dataKey="cost" name="Cost ($)"  fill="#5A4FCF" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-3 flex-center" style={{ height: 200 }}>No peer data available.</p>
          )}
        </Card>

        {/* Radar chart */}
        <Card className="chart-card">
          <div className="chart-title">Resource Health Profile</div>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: 'var(--text2)', fontSize: 12 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: 'var(--text3)', fontSize: 10 }} />
              <Radar name="Resource" dataKey="value" stroke="#1E90FF" fill="#1E90FF" fillOpacity={0.22} strokeWidth={2} />
              <Tooltip
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10 }}
                labelStyle={{ color: 'var(--text)' }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Explanation */}
      <Card className="card-pad detail-section fade-up delay-2">
        <div className="section-label">🔎 Why This Was Flagged</div>
        <p className="text-sm text-2" style={{ lineHeight: 1.7 }}>{rec.issue}</p>
      </Card>

      {/* Risk */}
      <Card className="card-pad detail-section fade-up delay-3">
        <div className="section-label">⚠️ Risk If Ignored</div>
        <div className="risk-box">{riskStatement(rec.issue)}</div>
      </Card>

      {/* Suggestion */}
      <Card className="card-pad detail-section fade-up delay-3">
        <div className="section-label">💡 Recommendation</div>
        <p className="text-sm text-2" style={{ lineHeight: 1.7 }}>{rec.suggestion}</p>
      </Card>

      {/* Action plan */}
      <Card className="card-pad detail-section fade-up delay-4">
        <div className="section-label">📋 Action Plan</div>
        <div className="action-list">
          {actionSteps(rec.issue).map((step, i) => (
            <div key={i} className="action-item">
              <span className="action-num">{i + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Confidence score */}
      <Card className="card-pad detail-section fade-up delay-4">
        <div className="section-label">📊 Confidence Score</div>
        <div className="conf-wrap">
          <div className="conf-row">
            <span className="text-sm text-2">Model confidence</span>
            <span className="text-sm" style={{ fontWeight: 700, color: 'var(--primary)' }}>
              {(confidence * 100).toFixed(0)}%
            </span>
          </div>
          <div className="conf-track">
            <div className="conf-fill" style={{ width: `${confidence * 100}%` }} />
          </div>
          <p className="text-xs text-3" style={{ marginTop: 8 }}>
            Based on IsolationForest anomaly detection + rule-match certainty.
          </p>
        </div>
      </Card>

      {/* Savings simulator */}
      <Card className="card-pad detail-section fade-up delay-5">
        <div className="section-label">💰 Savings Simulator</div>
        <p className="text-sm text-2" style={{ marginBottom: 16 }}>
          Drag the slider to estimate savings based on what percentage of this resource's cost you could eliminate.
        </p>
        <div className="slider-wrap">
          <div className="conf-row" style={{ marginBottom: 8 }}>
            <span className="text-xs text-3">0%</span>
            <span className="text-sm" style={{ fontWeight: 600, color: 'var(--primary)' }}>
              Reduction: {sliderPct}%
            </span>
            <span className="text-xs text-3">100%</span>
          </div>
          <input
            className="slider-input"
            type="range"
            min={0}
            max={100}
            value={sliderPct}
            onChange={e => setSliderPct(+e.target.value)}
          />
        </div>
        <div className="savings-display">{fmtCost(estimatedSave)}</div>
        <div className="savings-pct">
          Estimated savings at {sliderPct}% reduction on a {fmtCost(rec.cost)} resource
        </div>
      </Card>
    </div>
  );
}