import Card from '../components/Card';

const FEATURES = [
  { icon: '🤖', name: 'ML-Powered Detection',   desc: 'KMeans clustering and Isolation Forest anomaly detection run directly on your uploaded billing CSV — zero synthetic data.' },
  { icon: '💡', name: 'Actionable Recommendations', desc: 'Every recommendation is generated from real data rules: idle VMs, over-provisioned resources, and top-cost outliers.' },
  { icon: '📊', name: 'Live Dashboard',         desc: 'KPI cards and Recharts visualisations render only from your backend API responses — total cost, anomaly counts, resource breakdown.' },
  { icon: '🔒', name: 'Private by Design',      desc: 'Your data never leaves your infrastructure. The backend runs locally and the frontend connects only to localhost:8000.' },
  { icon: '⚡', name: 'Fast Pipeline',          desc: 'From CSV upload to full ML results in seconds. The FastAPI backend handles feature engineering and model inference in one pass.' },
  { icon: '🎯', name: 'Structured Explanations', desc: 'Each flagged resource includes the exact rule that triggered it, the raw values involved, and concrete remediation steps.' },
];

export default function LandingPage({ user, onNavigate }) {
  return (
    <div className="landing-root">
      {/* ── Hero ──────────────────────────────────────────── */}
      <section className="hero-section">
        <div className="hero-bg" />
        <div className="hero-orb hero-orb-1" />
        <div className="hero-orb hero-orb-2" />

        <div className="hero-eyebrow fade-up">
          <span className="hero-eyebrow-dot" />
          GCP · FinOps Intelligence Platform
        </div>

        <h1 className="hero-title fade-up delay-1">
          OptiCloud<br />
          <span className="hero-title-grad">FinOps Platform</span>
        </h1>

        <p className="hero-sub fade-up delay-2">
          Turn cloud chaos into cost control.
          Upload your billing CSV, run real ML models,
          and get actionable recommendations in seconds.
        </p>

        <div className="hero-cta-row fade-up delay-3">
          {user ? (
            <button className="btn btn-primary btn-lg" onClick={() => onNavigate('upload')}>
              🚀 Start Optimization
            </button>
          ) : (
            <>
              <button className="btn btn-primary btn-lg" onClick={() => onNavigate('auth')}>
                Get Started Free
              </button>
              <button className="btn btn-outline btn-lg" onClick={() => onNavigate('auth')}>
                Connect Live Cloud Server
              </button>
            </>
          )}
        </div>

        {/* Floating stats */}
        <div className="hero-stats fade-up delay-4">
          {[
            { v: 'KMeans',    l: 'Workload Clustering' },
            { v: 'IsoForest', l: 'Anomaly Detection' },
            { v: 'Top 10%',   l: 'Cost Spike Rules' },
            { v: 'Real CSV',  l: 'No Synthetic Data' },
          ].map(s => (
            <Card key={s.v} className="stat-pill" noHover>
              <div className="stat-num">{s.v}</div>
              <div className="stat-lbl">{s.l}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────── */}
      <section className="features-section">
        <h2 className="section-heading">
          Everything you need to<br />
          <span className="text-grad">optimise cloud spend</span>
        </h2>
        <div className="features-grid">
          {FEATURES.map((f, i) => (
            <Card key={f.name} className={`card-pad fade-up delay-${(i % 3) + 1}`}>
              <span className="feature-icon">{f.icon}</span>
              <div className="feature-name">{f.name}</div>
              <div className="feature-desc">{f.desc}</div>
            </Card>
          ))}
        </div>
      </section>

      {/* ── CTA banner ────────────────────────────────────── */}
      <div className="cta-banner">
        <h2 className="section-heading" style={{ marginBottom: 18 }}>
          Ready to cut your cloud bill?
        </h2>
        <p className="text-sm text-2" style={{ marginBottom: 28 }}>
          Upload your GCP billing export and get your first insights in under 30 seconds.
        </p>
        <button
          className="btn btn-primary btn-lg"
          onClick={() => onNavigate(user ? 'upload' : 'auth')}
        >
          {user ? 'Upload Dataset →' : 'Create Free Account →'}
        </button>
      </div>
    </div>
  );
}