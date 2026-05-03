import { useMemo } from 'react'

export default function TranscriptPanel({ words, fullText, currentTime, loading }) {
  const activeWordIndex = useMemo(() => {
    if (!words || words.length === 0) return -1
    return words.findIndex(w => currentTime >= w.start && currentTime <= w.end)
  }, [words, currentTime])

  if (loading) {
    return (
      <div className="transcript-panel glass-card">
        <div className="section-header">
          <span className="icon">📝</span>
          <h2>Transcript</h2>
        </div>
        <div className="tp-loading">
          <div className="skeleton" style={{ height: 20, width: '80%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 20, width: '70%' }} />
        </div>
        <style>{styles}</style>
      </div>
    )
  }

  if (!words || words.length === 0) {
    return (
      <div className="transcript-panel glass-card">
        <div className="section-header">
          <span className="icon">📝</span>
          <h2>Transcript</h2>
        </div>
        <div className="empty-state" style={{ padding: '24px' }}>
          <p>Transcript will appear after audio analysis</p>
        </div>
        <style>{styles}</style>
      </div>
    )
  }

  return (
    <div className="transcript-panel glass-card fade-in">
      <div className="section-header">
        <span className="icon">📝</span>
        <h2>Transcript</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {words.length} words
        </span>
      </div>

      <div className="tp-text arabic-text" dir="rtl">
        {words.map((w, i) => (
          <span
            key={i}
            className={`tp-word ${
              i < activeWordIndex ? 'done' :
              i === activeWordIndex ? 'active' :
              'pending'
            }`}
          >
            {w.word}{' '}
          </span>
        ))}
      </div>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .transcript-panel {
    padding: var(--space-lg);
  }
  .tp-loading {
    padding: var(--space-md);
  }
  .tp-text {
    font-size: 1.3rem;
    line-height: 2.2;
    padding: var(--space-md);
    background: var(--bg-card);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    max-height: 200px;
    overflow-y: auto;
  }
  .tp-word {
    display: inline;
    padding: 2px 1px;
    border-radius: 3px;
    transition: all var(--duration-fast);
    cursor: default;
  }
  .tp-word.pending {
    color: var(--text-muted);
  }
  .tp-word.done {
    color: var(--text-secondary);
  }
  .tp-word.active {
    color: var(--teal-300);
    background: var(--teal-glow);
    font-weight: 600;
    box-shadow: 0 0 8px rgba(6, 201, 167, 0.3);
  }
`
