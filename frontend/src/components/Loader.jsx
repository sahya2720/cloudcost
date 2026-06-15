const STEPS = [
  { label: 'Cleaning Data',        desc: 'Validating schema and filling nulls',    icon: '🧹' },
  { label: 'Feature Engineering',  desc: 'Computing cost_per_hour, efficiency…',  icon: '⚙️' },
  { label: 'Running ML Models',    desc: 'KMeans clustering + IsolationForest',    icon: '🤖' },
  { label: 'Generating Insights',  desc: 'Building recommendation engine output', icon: '✨' },
];

export default function Loader({ currentStep }) {
  return (
    <div className="loader-root">
      <div className="loader-heading">Analysing your cloud data…</div>

      <div className="loader-steps">
        {STEPS.map((step, i) => {
          const isDone   = i < currentStep;
          const isActive = i === currentStep;
          return (
            <div
              key={step.label}
              className={`loader-step${isDone ? ' step-done' : ''}${isActive ? ' step-active' : ''}`}
            >
              <div className="step-icon-wrap">
                {isDone   && '✅'}
                {isActive && <span className="spinner-icon">⏳</span>}
                {!isDone && !isActive && step.icon}
              </div>
              <div className="step-text-wrap">
                <div className="step-title">{step.label}</div>
                <div className="step-desc">{step.desc}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-3" style={{ textAlign: 'center' }}>
        Do not close this tab — processing your dataset
      </div>
    </div>
  );
}