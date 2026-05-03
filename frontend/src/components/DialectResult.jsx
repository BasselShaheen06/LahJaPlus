import { useMemo } from 'react'

const DIALECTS = [
  { key: 'egyptian', label: 'Egyptian', labelAr: 'مصري', color: 'var(--dialect-egyptian)', bg: 'var(--dialect-egyptian-bg)' },
  { key: 'levantine', label: 'Levantine', labelAr: 'شامي', color: 'var(--dialect-levantine)', bg: 'var(--dialect-levantine-bg)' },
  { key: 'gulf', label: 'Gulf', labelAr: 'خليجي', color: 'var(--dialect-gulf)', bg: 'var(--dialect-gulf-bg)' },
  { key: 'maghrebi', label: 'Maghrebi', labelAr: 'مغاربي', color: 'var(--dialect-maghrebi)', bg: 'var(--dialect-maghrebi-bg)' },
]

export default function DialectResult({ result, blendResult, loading }) {
  const data = blendResult || result
  const confidence = data?.confidence || {}
  const detected = data?.dialect || null

  // Sort by confidence desc
  const sorted = useMemo(() =>
    DIALECTS.map(d => ({
      ...d,
      value: confidence[d.key] || 0,
    })).sort((a, b) => b.value - a.value),
    [confidence]
  )

  return (
    <div className="dialect-result glass-card">
      <div className="section-header">
        <span className="icon">📊</span>
        <h2>{blendResult ? 'Blend Result' : 'Classification'}</h2>
      </div>

      {loading ? (
        <div className="dr-loading">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="dr-bar-skeleton skeleton" style={{ height: 52, marginBottom: 10 }} />
          ))}
        </div>
      ) : !data ? (
        <div className="empty-state" style={{ padding: '40px 20px' }}>
          <span className="icon">🎯</span>
          <p>Upload audio to classify</p>
        </div>
      ) : (
        <div className="dr-results fade-in">
          {/* Detected dialect badge */}
          <div className="dr-detected">
            <span className={`badge badge-${detected}`}>{detected}</span>
            <span className="dr-detected-ar" style={{ fontFamily: 'var(--font-arabic)' }}>
              {DIALECTS.find(d => d.key === detected)?.labelAr}
            </span>
          </div>

          {/* Confidence bars */}
          <div className="dr-bars">
            {sorted.map((d, i) => (
              <div key={d.key} className={`dr-bar ${d.key === detected ? 'active' : ''}`} style={{ animationDelay: `${i * 80}ms` }}>
                <div className="dr-bar-header">
                  <span className="dr-bar-label">
                    <span className="dr-bar-dot" style={{ background: d.color }}></span>
                    {d.label}
                  </span>
                  <span className="dr-bar-value">{(d.value * 100).toFixed(1)}%</span>
                </div>
                <div className="dr-bar-track">
                  <div
                    className="dr-bar-fill"
                    style={{
                      width: `${d.value * 100}%`,
                      background: `linear-gradient(90deg, ${d.color}88, ${d.color})`,
                      boxShadow: d.key === detected ? `0 0 12px ${d.color}66` : 'none',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .dialect-result {
          padding: var(--space-lg);
          height: fit-content;
          position: sticky;
          top: var(--space-lg);
        }
        .dr-detected {
          display: flex;
          align-items: center;
          gap: var(--space-md);
          margin-bottom: var(--space-lg);
          padding: var(--space-md);
          background: var(--bg-card);
          border-radius: var(--radius-md);
        }
        .dr-detected .badge {
          font-size: 0.85rem;
          padding: 5px 14px;
          text-transform: capitalize;
        }
        .dr-detected-ar {
          font-size: 1.1rem;
          color: var(--text-secondary);
        }
        .dr-bars {
          display: flex;
          flex-direction: column;
          gap: var(--space-sm);
        }
        .dr-bar {
          animation: fadeIn var(--duration-slow) var(--ease-out) both;
        }
        .dr-bar-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .dr-bar-label {
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--text-secondary);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dr-bar.active .dr-bar-label {
          color: var(--text-primary);
          font-weight: 600;
        }
        .dr-bar-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dr-bar-value {
          font-size: 0.8rem;
          font-weight: 600;
          font-family: var(--font-mono);
          color: var(--text-muted);
        }
        .dr-bar.active .dr-bar-value {
          color: var(--text-primary);
        }
        .dr-bar-track {
          height: 6px;
          background: var(--bg-card);
          border-radius: var(--radius-full);
          overflow: hidden;
        }
        .dr-bar-fill {
          height: 100%;
          border-radius: var(--radius-full);
          transition: width 0.6s var(--ease-out);
          min-width: 2px;
        }
      `}</style>
    </div>
  )
}
