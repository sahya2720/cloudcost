import { useRef, useState } from 'react'
import Card from '../components/Card.jsx'
import Loader from '../components/Loader.jsx'
import { uploadCSV, processData } from '../services/api.js'

const STEP_LABELS = [
  'Uploading file to backend…',
  'Normalising column names…',
  'Running ML models (KMeans + IsolationForest)…',
  'Generating insights & recommendations…',
]

// Both naming conventions shown to the user
const ACCEPTED_COLUMNS = [
  { canonical: 'instance_id / resource_id',        required: true  },
  { canonical: 'service_type / resource_type',      required: true  },
  { canonical: 'region',                            required: true  },
  { canonical: 'cost',                              required: true  },
  { canonical: 'runtime_hours',                     required: true  },
  { canonical: 'cpu_utilization',                   required: true  },
  { canonical: 'memory_utilization',                required: true  },
  { canonical: 'timestamp',                         required: false },
]

export default function UploadPage({ onComplete }) {
  const inputRef              = useRef(null)
  const [file, setFile]       = useState(null)
  const [dragging, setDrag]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [step, setStep]       = useState(0)
  const [progress, setProg]   = useState(0)
  const [error, setError]     = useState('')

  const handleFile = (f) => {
    if (!f) return
    if (!f.name.endsWith('.csv')) { setError('Please upload a CSV file (.csv).'); return }
    setError('')
    setFile(f)
  }

  const handleDrop = (e) => {
    e.preventDefault(); setDrag(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const run = async () => {
    if (!file) { setError('Please select a CSV file first.'); return }
    setError(''); setLoading(true)
    try {
      setStep(0); setProg(15)
      await uploadCSV(file)
      setProg(40)

      setStep(1); setProg(55)
      await new Promise(r => setTimeout(r, 500))

      setStep(2); setProg(70)
      await processData()
      setProg(90)

      setStep(3); setProg(100)
      await new Promise(r => setTimeout(r, 650))
      onComplete()
    } catch (err) {
      setError(`Error: ${err.message}`)
      setLoading(false); setProg(0)
    }
  }

  if (loading) return <Loader currentStep={step} />

  return (
    <div className="upload-root">
      <h1 className="upload-title fade-up">Upload Billing Data</h1>
      <p className="upload-sub fade-up delay-1">
        Upload your GCP billing CSV. The backend auto-detects both
        <code style={{ margin: '0 4px', color: 'var(--primary)' }}>instance_id</code> and
        <code style={{ margin: '0 4px', color: 'var(--primary)' }}>resource_id</code> naming conventions.
      </p>

      <Card className="fade-up delay-2">
        {/* Drop zone */}
        <div
          className={`dropzone${dragging ? ' dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
        >
          <input
            ref={inputRef} type="file" accept=".csv"
            style={{ display: 'none' }}
            onChange={e => handleFile(e.target.files?.[0])}
          />
          <span className="dropzone-icon">{file ? '✅' : '📂'}</span>
          <div className="dropzone-title">
            {file ? file.name : 'Drop your CSV here or click to browse'}
          </div>
          <div className="dropzone-sub">
            {file
              ? `${(file.size / 1024).toFixed(1)} KB — ready to upload`
              : 'Accepts GCP billing exports with either resource_id or instance_id columns'}
          </div>
        </div>

        {file && (
          <div className="file-info">
            <span>📄 {file.name}</span>
            <span className="text-sm text-3">{(file.size / 1024).toFixed(1)} KB</span>
          </div>
        )}

        {progress > 0 && progress < 100 && (
          <div className="progress-wrap" style={{ padding: '0 24px' }}>
            <div className="progress-label">
              <span>{STEP_LABELS[step]}</span>
              <span>{progress}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {error && (
          <div className="auth-error" style={{ margin: '0 24px 16px' }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ padding: '16px 24px 28px', textAlign: 'center' }}>
          <button className="btn btn-primary btn-lg" onClick={run} disabled={!file}>
            🚀 Upload &amp; Analyse
          </button>
        </div>
      </Card>

      {/* Column reference card */}
      <Card className="card-pad fade-up delay-3" style={{ marginTop: 20 }} noHover>
        <div className="chart-title">Accepted CSV Columns</div>
        <p className="text-sm text-2" style={{ marginBottom: 16, lineHeight: 1.6 }}>
          Your CSV may use either the GCP export naming
          (<code style={{ color: 'var(--primary)' }}>instance_id</code>,&nbsp;
          <code style={{ color: 'var(--primary)' }}>service_type</code>) or the
          canonical naming (<code style={{ color: 'var(--primary)' }}>resource_id</code>,&nbsp;
          <code style={{ color: 'var(--primary)' }}>resource_type</code>).
          The backend normalises both automatically.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px' }}>
          {ACCEPTED_COLUMNS.map(col => (
            <div key={col.canonical} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: col.required ? 'var(--success)' : 'var(--text3)', fontSize: 13 }}>
                {col.required ? '✓' : '○'}
              </span>
              <code style={{ fontSize: 12, color: 'var(--text2)' }}>{col.canonical}</code>
              {!col.required && (
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>(optional)</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}