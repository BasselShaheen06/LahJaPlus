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
        <div className="section-header"><h2>🔄 Dialect Conversion</h2></div>
        <div className="empty-state"><p>Complete transcription first to enable conversion.</p></div>
      </div>
    )
  }

  return (
    <div className="synthesis-bar glass-card fade-in">
      <div className="section-header"><h2>🔄 Dialect Conversion</h2></div>

      <div className="sb-dialects" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', alignSelf: 'center' }}>Convert to:</span>
        {DIALECTS.map(d => (
          <button
            key={d.key}
            className={`btn ${d.key === detectedDialect ? 'disabled' : d.key === selectedDialect ? 'btn-primary' : ''}`}
            onClick={() => handleDialectClick(d.key)}
            disabled={d.key === detectedDialect || translateLoading}
            style={d.key === detectedDialect ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            {d.label} <span style={{ fontFamily: 'var(--font-arabic)', fontSize: '0.8rem', marginLeft: '6px' }}>{d.labelAr}</span>
          </button>
        ))}
      </div>

      {translateLoading && <div className="spinner" style={{ margin: '20px auto' }} />}

      {translateResult && !translateLoading && (
        <div className="sb-translate-preview fade-in" style={{ background: 'var(--bg-card)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>MSA (Pivot)</span>
              <p className="arabic-text" dir="rtl" style={{ fontSize: '1.1rem', marginTop: '4px' }}>{translateResult.msa_text}</p>
            </div>
            <div style={{ alignSelf: 'center', color: 'var(--teal-500)', fontSize: '1.5rem' }}>→</div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--teal-400)' }}>{selectedDialect.toUpperCase()}</span>
              <p className="arabic-text" dir="rtl" style={{ fontSize: '1.1rem', marginTop: '4px' }}>{translateResult.target_text}</p>
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={() => onSynthesize(selectedDialect)} disabled={synthesisLoading}>
              {synthesisLoading ? 'Synthesizing Voice...' : '🔊 Synthesize Speech'}
            </button>
            {synthesisUrl && <audio controls src={synthesisUrl} className="fade-in" style={{ flex: 1, height: '40px' }} />}
          </div>
        </div>
      )}
    </div>
  )
}