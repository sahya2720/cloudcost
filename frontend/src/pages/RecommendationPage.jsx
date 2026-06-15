import { useEffect, useState } from 'react';
import Card from '../components/Card';
import { fetchRecommendations } from '../services/api';

/* Map backend "issue" text to a visual tag */
function detectImpact(issue = '') {
  const low = issue.toLowerCase();
  if (low.includes('idle'))            return { label: 'High',     cls: 'tag-high' };
  if (low.includes('over-provisioned')) return { label: 'Medium',   cls: 'tag-medium' };
  if (low.includes('high-cost'))       return { label: 'Critical',  cls: 'tag-critical' };
  return                                      { label: 'Low',       cls: 'tag-low' };
}

function fmtCost(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n?.toFixed(2) ?? '0.00'}`;
}

/* Derive a human-readable title from the issue string */
function titleFromIssue(issue = '') {
  const low = issue.toLowerCase();
  if (low.includes('idle'))            return 'Idle Instance Detected';
  if (low.includes('over-provisioned')) return 'Over-Provisioned Resource';
  if (low.includes('high-cost'))       return 'Cost Spike Anomaly';
  return 'Resource Optimisation';
}

export default function RecommendationPage({ onSelectRec }) {
  const [recs, setRecs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [filter, setFilter]   = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchRecommendations();
        setRecs(data);
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
        <span className="spinner-icon" style={{ fontSize: 40 }}>⏳</span>
        <p className="text-sm text-2">Fetching recommendations from backend…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state-box">
        <span className="state-icon">⚠️</span>
        <p className="state-msg">Could not load recommendations: {error}</p>
      </div>
    );
  }

  if (recs.length === 0) {
    return (
      <div className="state-box">
        <span className="state-icon">🎉</span>
        <p className="state-msg">No recommendations generated. Your resources look healthy!</p>
      </div>
    );
  }

  // Category counts
  const counts = recs.reduce((acc, r) => {
    const low = r.issue?.toLowerCase() || '';
    if (low.includes('idle'))            acc.idle++;
    else if (low.includes('over-prov'))  acc.over++;
    else if (low.includes('high-cost'))  acc.cost++;
    else                                 acc.other++;
    return acc;
  }, { idle: 0, over: 0, cost: 0, other: 0 });

  const totalSavings = recs.reduce((s, r) => s + (r.cost || 0), 0);

  // Filter
  const filtered = filter === 'all' ? recs : recs.filter(r => {
    const low = r.issue?.toLowerCase() || '';
    if (filter === 'idle')   return low.includes('idle');
    if (filter === 'over')   return low.includes('over-prov');
    if (filter === 'cost')   return low.includes('high-cost');
    return true;
  });

  return (
    <div>
      {/* Header */}
      <div className="rec-page-header fade-up">
        <div>
          <h1 className="page-title">Recommendations</h1>
          <p className="page-sub">
            {recs.length} issues found · Potential spend impact: <strong>{fmtCost(totalSavings)}</strong>
          </p>
        </div>
        <div className="rec-summary-pills">
          <span className="pill pill-orange">🛑 {counts.idle} Idle</span>
          <span className="pill pill-blue">📦 {counts.over} Over-Prov</span>
          <span className="pill pill-red">💸 {counts.cost} High-Cost</span>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-8 mb-24 fade-up delay-1" style={{ flexWrap: 'wrap' }}>
        {[
          { key: 'all',  label: `All (${recs.length})` },
          { key: 'idle', label: `Idle (${counts.idle})` },
          { key: 'over', label: `Over-prov (${counts.over})` },
          { key: 'cost', label: `High-cost (${counts.cost})` },
        ].map(f => (
          <button
            key={f.key}
            className={`btn btn-sm ${filter === f.key ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className="rec-grid">
        {filtered.map((rec, i) => {
          const impact = detectImpact(rec.issue);
          const title  = titleFromIssue(rec.issue);
          return (
            <Card
              key={`${rec.resource_id}-${i}`}
              className={`rec-card fade-up delay-${(i % 4) + 1}`}
              onClick={() => onSelectRec(rec)}
            >
              <div className="rec-card-accent" />
              <div className={`rec-impact-tag ${impact.cls}`}>
                {impact.label === 'Critical' && '🔴 '}
                {impact.label === 'High'     && '🟠 '}
                {impact.label === 'Medium'   && '🔵 '}
                {impact.label === 'Low'      && '🟢 '}
                {impact.label}
              </div>
              <div className="rec-title">{title}</div>
              <div className="rec-issue">{rec.issue}</div>
              <div className="rec-meta">
                <div>
                  <div className="rec-cost">{fmtCost(rec.cost)}</div>
                  <div className="rec-cost-lbl">resource cost</div>
                </div>
                <div>
                  <div className="rec-type">{rec.resource_type}</div>
                  <div className="text-xs text-3" style={{ marginTop: 4, textAlign: 'right' }}>{rec.region}</div>
                </div>
              </div>
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-outline btn-sm w-full" style={{ justifyContent: 'center' }}>
                  View Details →
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}