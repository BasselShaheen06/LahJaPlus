import { useState } from 'react'

const DIALECTS = [
  { key: 'egyptian', label: 'Egyptian', labelAr: 'مصري' },
  { key: 'levantine', label: 'Levantine', labelAr: 'شامي' },
  { key: 'gulf', label: 'Gulf', labelAr: 'خليجي' },
  { key: 'maghrebi', label: 'Maghrebi', labelAr: 'مغاربي' },
]

export default function SynthesisBar({
  detectedDialect, transcriptReady, translateResult, synthesisUrl,
  translateLoading, synthesisLoading, onTranslate, onSynthesize
}) {
  const [selectedDialect, setSelectedDialect] = useState(null)

  const handleDialectClick = (dialectKey) => {
    if (dialectKey === detectedDialect) return
    setSelectedDialect(dialectKey)
    onTranslate(dialectKey)
  }

  if (!transcriptReady) {
    return (
      <div className="synthesis-bar glass-card">
        <div className="section-header">
          <span className="icon">🔄</span>
          <h2>Dialect Conversion</h2>
        </div>
        <div className="empty-state" style={{ padding: '24px' }}>
          <p>Complete transcription first to enable dialect conversion</p>
        </div>
        <style>{styles}</style>
      </div>
    )
  }

  return (
    <div className="synthesis-bar glass-card fade-in">
      <div className="section-header">
        <span className="icon">🔄</span>
        <h2>Dialect Conversion</h2>
      </div>

      {/* Dialect selector buttons */}
      <div className="sb-dialects">
        <span className="sb-label">Convert to:</span>
        <div className="sb-buttons">
          {DIALECTS.map(d => (
            <button
              key={d.key}
              className={`btn sb-dialect-btn ${
                d.key === detectedDialect ? 'current' :
                d.key === selectedDialect ? 'selected' : ''
              }`}
              onClick={() => handleDialectClick(d.key)}
              disabled={d.key === detectedDialect || translateLoading}
              id={`dialect-btn-${d.key}`}
            >
              <span className="sb-btn-label">{d.label}</span>
              <span className="sb-btn-ar">{d.labelAr}</span>
              {d.key === detectedDialect && <span className="sb-current-tag">(current)</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Translation result */}
      {translateLoading && (
        <div className="sb-translate-preview">
          <div className="spinner" style={{ width: 20, height: 20, margin: '12px auto' }} />
          <p style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>Translating...</p>
        </div>
      )}

      {translateResult && !translateLoading && (
        <div className="sb-translate-preview fade-in">
          <div className="sb-step">
            <span className="sb-step-label">MSA (Fusha)</span>
            <p className="sb-step-text arabic-text" dir="rtl">{translateResult.msa_text}</p>
          </div>
          <div className="sb-arrow">→</div>
          <div className="sb-step">
            <span className="sb-step-label">{selectedDialect}</span>
            <p className="sb-step-text arabic-text" dir="rtl">{translateResult.target_text}</p>
          </div>
        </div>
      )}

      {/* Synthesize button + audio player */}
      {translateResult && !translateLoading && (
        <div className="sb-synth-row">
          <button
            className="btn btn-primary"
            onClick={onSynthesize}
            disabled={synthesisLoading}
            id="synthesize-btn"
          >
            {synthesisLoading ? (
              <>
                <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Synthesizing...
              </>
            ) : (
              <>🔊 Synthesize Speech</>
            )}
          </button>

          {synthesisUrl && (
            <audio controls src={synthesisUrl} className="sb-audio fade-in" id="synthesis-audio">
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      )}

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .synthesis-bar {
    padding: var(--space-lg);
  }
  .sb-dialects {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }
  .sb-label {
    font-size: 0.85rem;
    color: var(--text-secondary);
    font-weight: 500;
    white-space: nowrap;
  }
  .sb-buttons {
    display: flex;
    gap: var(--space-sm);
    flex-wrap: wrap;
  }
  .sb-dialect-btn {
    flex-direction: column;
    padding: 8px 16px;
    gap: 2px;
    min-width: 100px;
  }
  .sb-btn-label {
    font-size: 0.85rem;
  }
  .sb-btn-ar {
    font-family: var(--font-arabic);
    font-size: 0.75rem;
    color: var(--text-muted);
  }
  .sb-dialect-btn.current {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .sb-dialect-btn.selected {
    border-color: var(--teal-500);
    background: var(--teal-glow);
  }
  .sb-current-tag {
    font-size: 0.65rem;
    color: var(--text-muted);
  }
  .sb-translate-preview {
    margin-top: var(--space-md);
    display: flex;
    align-items: stretch;
    gap: var(--space-md);
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    border: 1px solid var(--border-subtle);
  }
  @media (max-width: 700px) {
    .sb-translate-preview {
      flex-direction: column;
    }
    .sb-arrow {
      transform: rotate(90deg);
    }
  }
  .sb-step {
    flex: 1;
  }
  .sb-step-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-muted);
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
  }
  .sb-step-text {
    font-size: 1.1rem;
    color: var(--text-primary);
    line-height: 1.8;
  }
  .sb-arrow {
    display: flex;
    align-items: center;
    color: var(--teal-500);
    font-size: 1.2rem;
    font-weight: 700;
  }
  .sb-synth-row {
    margin-top: var(--space-md);
    display: flex;
    align-items: center;
    gap: var(--space-md);
    flex-wrap: wrap;
  }
  .sb-audio {
    flex: 1;
    min-width: 200px;
    height: 36px;
    border-radius: var(--radius-md);
  }
`
