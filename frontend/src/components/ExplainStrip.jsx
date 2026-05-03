const NPVI_RANGES = [
  { key: 'egyptian', label: 'EGY', min: 34, max: 44, color: 'var(--dialect-egyptian)' },
  { key: 'levantine', label: 'LEV', min: 40, max: 50, color: 'var(--dialect-levantine)' },
  { key: 'gulf', label: 'GLF', min: 45, max: 56, color: 'var(--dialect-gulf)' },
  { key: 'maghrebi', label: 'MAG', min: 58, max: 72, color: 'var(--dialect-maghrebi)' },
]

const NPVI_SCALE_MIN = 30
const NPVI_SCALE_MAX = 78

const QAF_MAP = {
  glottal: { ipa: 'ʔ', desc: 'Glottal stop', dialects: 'Egyptian / Levantine' },
  velar: { ipa: 'g', desc: 'Velar stop', dialects: 'Gulf / Cairene' },
  uvular: { ipa: 'q', desc: 'Uvular stop', dialects: 'Maghrebi' },
}

const JEEM_MAP = {
  velar: { ipa: 'g', desc: 'Velar stop', dialects: 'Egyptian (Cairo)' },
  affricate: { ipa: 'dʒ', desc: 'Affricate', dialects: 'Levantine / Gulf' },
  fricative: { ipa: 'ʒ', desc: 'Fricative', dialects: 'Maghrebi' },
}

export default function ExplainStrip({ features, dialect }) {
  if (!features) {
    return (
      <div className="explain-strip glass-card">
        <div className="section-header">
          <span className="icon">🔬</span>
          <h2>Acoustic Markers</h2>
        </div>
        <div className="empty-state" style={{ padding: '24px' }}>
          <p>Feature analysis will appear after classification</p>
        </div>
        <style>{styles}</style>
      </div>
    )
  }

  const npvi = features.npvi || 0
  const qafInfo = QAF_MAP[features.qaf_dominant] || QAF_MAP.glottal
  const jeemInfo = JEEM_MAP[features.jeem_dominant] || JEEM_MAP.velar

  const needlePos = ((npvi - NPVI_SCALE_MIN) / (NPVI_SCALE_MAX - NPVI_SCALE_MIN)) * 100
  const clampedPos = Math.max(0, Math.min(100, needlePos))

  const rhythmLabel = npvi < 44 ? 'syllable-timed' : npvi < 56 ? 'mixed' : 'stress-timed'

  return (
    <div className="explain-strip glass-card fade-in">
      <div className="section-header">
        <span className="icon">🔬</span>
        <h2>Acoustic Markers</h2>
      </div>

      <div className="explain-cards">
        {/* Card 1: nPVI Gauge */}
        <div className="explain-card">
          <div className="ec-header">
            <span className="ec-title">nPVI</span>
            <span className="ec-value">{npvi.toFixed(1)}</span>
          </div>
          <div className="ec-subtitle">{rhythmLabel}</div>

          {/* Gauge */}
          <div className="npvi-gauge">
            <div className="npvi-track">
              {NPVI_RANGES.map(r => {
                const left = ((r.min - NPVI_SCALE_MIN) / (NPVI_SCALE_MAX - NPVI_SCALE_MIN)) * 100
                const width = ((r.max - r.min) / (NPVI_SCALE_MAX - NPVI_SCALE_MIN)) * 100
                return (
                  <div
                    key={r.key}
                    className="npvi-segment"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      background: r.color,
                      opacity: r.key === dialect ? 0.6 : 0.2,
                    }}
                    title={`${r.label}: ${r.min}–${r.max}`}
                  />
                )
              })}
              <div className="npvi-needle" style={{ left: `${clampedPos}%` }} />
            </div>
            <div className="npvi-labels">
              {NPVI_RANGES.map(r => {
                const center = ((((r.min + r.max) / 2) - NPVI_SCALE_MIN) / (NPVI_SCALE_MAX - NPVI_SCALE_MIN)) * 100
                return (
                  <span key={r.key} className="npvi-label" style={{ left: `${center}%`, color: r.color }}>
                    {r.label}
                  </span>
                )
              })}
            </div>
          </div>
        </div>

        {/* Card 2: Qaf Realization */}
        <div className="explain-card">
          <div className="ec-header">
            <span className="ec-title">Qaf ق</span>
            <span className={`badge badge-${dialect}`}>{dialect}</span>
          </div>
          <div className="ec-phoneme">
            <span className="ec-ipa">[{qafInfo.ipa}]</span>
            <span className="ec-desc">{qafInfo.desc}</span>
          </div>
          <div className="ec-attribution">{qafInfo.dialects}</div>
        </div>

        {/* Card 3: Jeem Realization */}
        <div className="explain-card">
          <div className="ec-header">
            <span className="ec-title">Jeem ج</span>
            <span className={`badge badge-${dialect}`}>{dialect}</span>
          </div>
          <div className="ec-phoneme">
            <span className="ec-ipa">[{jeemInfo.ipa}]</span>
            <span className="ec-desc">{jeemInfo.desc}</span>
          </div>
          <div className="ec-attribution">{jeemInfo.dialects}</div>
        </div>
      </div>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .explain-strip {
    padding: var(--space-lg);
  }
  .explain-cards {
    display: grid;
    grid-template-columns: 1.4fr 1fr 1fr;
    gap: var(--space-md);
  }
  @media (max-width: 800px) {
    .explain-cards {
      grid-template-columns: 1fr;
    }
  }
  .explain-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-md);
  }
  .ec-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .ec-title {
    font-weight: 600;
    font-size: 0.9rem;
    color: var(--text-primary);
  }
  .ec-value {
    font-family: var(--font-mono);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--teal-400);
  }
  .ec-subtitle {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: var(--space-md);
  }
  /* nPVI gauge */
  .npvi-gauge {
    position: relative;
    margin-top: var(--space-sm);
  }
  .npvi-track {
    position: relative;
    height: 8px;
    background: var(--bg-secondary);
    border-radius: var(--radius-full);
    overflow: visible;
  }
  .npvi-segment {
    position: absolute;
    top: 0;
    height: 100%;
    border-radius: var(--radius-full);
  }
  .npvi-needle {
    position: absolute;
    top: -4px;
    width: 3px;
    height: 16px;
    background: var(--text-primary);
    border-radius: 2px;
    transform: translateX(-50%);
    box-shadow: 0 0 6px rgba(255,255,255,0.3);
    transition: left 0.6s var(--ease-out);
  }
  .npvi-labels {
    position: relative;
    height: 18px;
    margin-top: 4px;
  }
  .npvi-label {
    position: absolute;
    transform: translateX(-50%);
    font-size: 0.65rem;
    font-weight: 600;
  }
  /* Phoneme cards */
  .ec-phoneme {
    display: flex;
    align-items: baseline;
    gap: var(--space-sm);
    margin: var(--space-sm) 0;
  }
  .ec-ipa {
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--teal-300);
  }
  .ec-desc {
    font-size: 0.85rem;
    color: var(--text-secondary);
  }
  .ec-attribution {
    font-size: 0.75rem;
    color: var(--text-muted);
    padding-top: 6px;
    border-top: 1px solid var(--border-subtle);
  }
`
