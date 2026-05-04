import { useMemo, useEffect, useRef } from 'react'

export default function TranscriptPanel({ words, currentTime, loading }) {
  const containerRef = useRef(null)
  const activeWordRef = useRef(null)

  const activeWordIndex = useMemo(() => {
    if (!words || words.length === 0) return -1
    return words.findIndex(w => currentTime >= w.start && currentTime <= w.end)
  }, [words, currentTime])

  useEffect(() => {
    if (activeWordRef.current && containerRef.current) {
      activeWordRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      })
    }
  }, [activeWordIndex])

  if (loading) {
    return (
      <div className="transcript-panel glass-card">
        <div className="section-header"><h2>📝 Real-time Transcript</h2></div>
        <div style={{ padding: 'var(--space-md)' }}>
          <div className="skeleton" style={{ height: 20, width: '80%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 20, width: '60%', marginBottom: 12 }} />
          <div className="skeleton" style={{ height: 20, width: '90%' }} />
        </div>
      </div>
    )
  }

  if (!words || words.length === 0) {
    return (
      <div className="transcript-panel glass-card">
        <div className="section-header"><h2>📝 Real-time Transcript</h2></div>
        <div className="empty-state"><p>Transcript will appear here after analysis.</p></div>
      </div>
    )
  }

  return (
    <div className="transcript-panel glass-card fade-in">
      <div className="section-header">
        <h2>📝 Real-time Transcript</h2>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {words.length} words
        </span>
      </div>

      <div className="tp-text arabic-text" dir="rtl" ref={containerRef}>
        {words.map((w, i) => {
          const isActive = i === activeWordIndex;
          const isPast = i < activeWordIndex;
          
          return (
            <span
              key={i}
              ref={isActive ? activeWordRef : null}
              className={`tp-word ${isActive ? 'active' : isPast ? 'done' : 'pending'}`}
            >
              {w.word}{' '}
            </span>
          )
        })}
      </div>

      <style>{`
        .transcript-panel { padding: var(--space-lg); }
        .tp-text {
          font-size: 1.3rem; line-height: 2.2; padding: var(--space-md);
          background: var(--bg-card); border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle); max-height: 220px; overflow-y: auto;
        }
        .tp-word { transition: all var(--duration-fast); padding: 2px 4px; border-radius: 4px; }
        .tp-word.pending { color: var(--text-muted); }
        .tp-word.done { color: var(--text-secondary); }
        .tp-word.active {
          color: var(--teal-300); background: var(--teal-glow);
          font-weight: 600; box-shadow: 0 0 8px rgba(6, 201, 167, 0.3);
        }
      `}</style>
    </div>
  )
}