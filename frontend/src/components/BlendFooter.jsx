import { useState, useRef, useCallback, useEffect } from 'react'

const DIALECTS = [
  { key: 'egyptian',  label: 'Egyptian',  labelAr: 'مصري',   color: 'var(--dialect-egyptian)' },
  { key: 'levantine', label: 'Levantine', labelAr: 'شامي',   color: 'var(--dialect-levantine)' },
  { key: 'gulf',      label: 'Gulf',      labelAr: 'خليجي',  color: 'var(--dialect-gulf)' },
  { key: 'maghrebi',  label: 'Maghrebi',  labelAr: 'مغاربي', color: 'var(--dialect-maghrebi)' },
]

// ── Compact file upload card ──────────────────────────────────────────────────
function BlendFileCard({ label, fileData, classifyResult, loading, onFileLoaded, inputId }) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)

  const processFile = (file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    onFileLoaded({ file, url, name: file.name, size: file.size })
  }

  const handleChange = (e) => processFile(e.target.files?.[0])
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    processFile(e.dataTransfer.files[0])
  }

  return (
    <div className="bfc-card">
      <div className="bfc-label">{label}</div>

      {fileData ? (
        <div className="bfc-file-info fade-in">
          <span className="bfc-file-icon">🎙️</span>
          <div className="bfc-file-details">
            <span className="bfc-file-name" title={fileData.name}>{fileData.name}</span>
            {classifyResult && (
              <span
                className={`badge badge-${classifyResult.dialect}`}
                style={{ fontSize: '0.6rem', marginTop: 2 }}
              >
                {classifyResult.dialect}
              </span>
            )}
            {loading && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                Classifying…
              </span>
            )}
          </div>
          <button className="bfc-change-btn" onClick={() => inputRef.current?.click()}>
            Change
          </button>
        </div>
      ) : (
        <div
          className={`bfc-drop ${isDragging ? 'dragging' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
        >
          {loading
            ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: '0 auto 6px' }} /><span>Classifying…</span></>
            : <><span className="bfc-drop-icon">🎵</span><span>Drop audio or click to browse</span></>
          }
        </div>
      )}

      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".wav,.mp3,.ogg,.flac,.m4a"
        onChange={handleChange}
        style={{ display: 'none' }}
      />
    </div>
  )
}

// ── Main BlendFooter ──────────────────────────────────────────────────────────
export default function BlendFooter({
  blendFileA, blendFileB,
  blendClassifyA, blendClassifyB,
  blendResult, blendedAudioUrl,
  alpha, loadingA, loadingB,
  onFileALoaded, onFileBLoaded, onBlend,
}) {
  const [localAlpha, setLocalAlpha] = useState(alpha)
  const [isBlending, setIsBlending] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef(null)

  const canBlend = blendFileA && blendFileB && !loadingA && !loadingB

  // Keep localAlpha in sync if parent resets alpha
  useEffect(() => { setLocalAlpha(alpha) }, [alpha])

  // Auto-play when a new blended audio URL arrives
  useEffect(() => {
    if (blendedAudioUrl && audioRef.current) {
      audioRef.current.load()
      audioRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [blendedAudioUrl])

  const handlePlayPause = () => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
      setIsPlaying(false)
    } else {
      audio.play().catch(() => {})
      setIsPlaying(true)
    }
  }

  const handleSave = () => {
    if (!blendedAudioUrl) return
    const a = document.createElement('a')
    a.href = blendedAudioUrl
    const aLabel = blendClassifyA?.dialect || 'A'
    const bLabel = blendClassifyB?.dialect || 'B'
    a.download = `blend_${aLabel}_${Math.round(localAlpha * 100)}-${bLabel}_${Math.round((1 - localAlpha) * 100)}.wav`
    a.click()
  }

  const handleSliderChange = (e) => {
    const val = parseFloat(e.target.value)
    setLocalAlpha(val)
  }

  const handleBlendClick = useCallback(async () => {
    if (!canBlend) return
    setIsBlending(true)
    await onBlend(localAlpha)
    setIsBlending(false)
  }, [canBlend, localAlpha, onBlend])

  const blendConfidence = blendResult?.confidence || {}
  const sortedDialects = [...DIALECTS].sort(
    (a, b) => (blendConfidence[b.key] || 0) - (blendConfidence[a.key] || 0)
  )

  const alphaLabel = Math.round(localAlpha * 100)

  return (
    <div className="blend-footer glass-card">
      <div className="section-header">
        <span className="icon">🎚️</span>
        <h2>Dialect Blending</h2>
      </div>

      {/* ── File Uploaders Row ── */}
      <div className="bf-uploaders">
        <BlendFileCard
          label="File A"
          fileData={blendFileA}
          classifyResult={blendClassifyA}
          loading={loadingA}
          onFileLoaded={onFileALoaded}
          inputId="blend-file-a-input"
        />

        <div className="bf-vs">VS</div>

        <BlendFileCard
          label="File B"
          fileData={blendFileB}
          classifyResult={blendClassifyB}
          loading={loadingB}
          onFileLoaded={onFileBLoaded}
          inputId="blend-file-b-input"
        />
      </div>

      {/* ── Slider + Blend Button ── */}
      <div className={`bf-controls ${canBlend ? '' : 'disabled'}`}>
        <div className="bf-slider-labels">
          <span>
            File A{' '}
            {blendClassifyA && (
              <span className={`badge badge-${blendClassifyA.dialect}`} style={{ fontSize: '0.55rem' }}>
                {blendClassifyA.dialect}
              </span>
            )}
          </span>
          <span className="bf-alpha-chip">{alphaLabel}% A · {100 - alphaLabel}% B</span>
          <span>
            {blendClassifyB && (
              <span className={`badge badge-${blendClassifyB.dialect}`} style={{ fontSize: '0.55rem' }}>
                {blendClassifyB.dialect}
              </span>
            )}{' '}
            File B
          </span>
        </div>

        <input
          type="range"
          min="0" max="1" step="0.01"
          value={localAlpha}
          onChange={handleSliderChange}
          disabled={!canBlend}
          className="bf-slider"
          id="blend-slider"
        />

        <button
          className="bf-blend-btn"
          onClick={handleBlendClick}
          disabled={!canBlend || isBlending}
          id="blend-run-btn"
        >
          {isBlending
            ? <><div className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Blending…</>
            : <>🔀 Blend</>
          }
        </button>
      </div>

      {/* ── Results: Audio Player + Dialect Bars ── */}
      {blendResult && (
        <div className="bf-results fade-in">
          {/* Blended audio player */}
          {blendedAudioUrl && (
            <div className="bf-player-section">
              <div className="bf-player-header">
                <span className="bf-player-icon">🔊</span>
                <span>Blended Audio</span>
                <span className={`badge badge-${blendResult.dialect}`} style={{ fontSize: '0.65rem' }}>
                  {blendResult.dialect}
                </span>
              </div>

              {/* Hidden audio element — controlled programmatically */}
              <audio
                ref={audioRef}
                src={blendedAudioUrl}
                id="blend-audio-player"
                onEnded={() => setIsPlaying(false)}
                onPause={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
                style={{ display: 'none' }}
              />

              <div className="bf-player-btns">
                <button
                  className="bf-play-btn"
                  onClick={handlePlayPause}
                  id="blend-play-pause-btn"
                  title={isPlaying ? 'Pause' : 'Play blended audio'}
                >
                  {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                <button
                  className="bf-save-btn"
                  onClick={handleSave}
                  id="blend-save-btn"
                  title="Download blended audio as WAV"
                >
                  ⬇ Save WAV
                </button>
              </div>
            </div>
          )}

          {/* Dialect confidence bars */}
          <div className="bf-dialect-bars">
            <div className="bf-bars-title">Dialect Confidence</div>
            {sortedDialects.map((d) => {
              const pct = (blendConfidence[d.key] || 0) * 100
              const isTop = d.key === blendResult.dialect
              return (
                <div key={d.key} className={`bf-bar-row ${isTop ? 'bf-bar-top' : ''}`}>
                  <div className="bf-bar-label-group">
                    <span className="bf-bar-dot" style={{ background: d.color }} />
                    <span className="bf-bar-name">{d.label}</span>
                    <span className="bf-bar-ar">{d.labelAr}</span>
                  </div>
                  <div className="bf-bar-track">
                    <div
                      className="bf-bar-fill"
                      style={{
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${d.color}88, ${d.color})`,
                        boxShadow: isTop ? `0 0 10px ${d.color}66` : 'none',
                      }}
                    />
                  </div>
                  <span className="bf-bar-pct">{pct.toFixed(1)}%</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .blend-footer { padding: var(--space-lg); }

  /* ── Uploaders ── */
  .bf-uploaders {
    display: flex;
    gap: var(--space-md);
    align-items: stretch;
    margin-bottom: var(--space-lg);
  }
  .bf-vs {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted);
    letter-spacing: 0.05em;
    flex-shrink: 0;
    padding: 0 4px;
  }
  .bfc-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  .bfc-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  .bfc-drop {
    border: 2px dashed var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    text-align: center;
    cursor: pointer;
    font-size: 0.78rem;
    color: var(--text-muted);
    transition: all var(--duration-normal) var(--ease-out);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-height: 76px;
    justify-content: center;
  }
  .bfc-drop:hover, .bfc-drop.dragging {
    border-color: var(--teal-500);
    background: var(--teal-glow);
    color: var(--teal-300);
  }
  .bfc-drop-icon { font-size: 1.3rem; }
  .bfc-file-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-card);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
    min-height: 76px;
  }
  .bfc-file-icon { font-size: 1.3rem; flex-shrink: 0; }
  .bfc-file-details { flex: 1; display: flex; flex-direction: column; gap: 3px; }
  .bfc-file-name {
    font-size: 0.78rem; font-weight: 500; color: var(--text-primary);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;
  }
  .bfc-change-btn {
    font-size: 0.7rem; color: var(--teal-400); background: none; border: none;
    cursor: pointer; font-weight: 500; flex-shrink: 0; padding: 2px 6px;
  }
  .bfc-change-btn:hover { color: var(--teal-300); }

  /* ── Controls ── */
  .bf-controls {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    margin-bottom: var(--space-lg);
  }
  .bf-controls.disabled { opacity: 0.35; pointer-events: none; }
  .bf-slider-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.72rem;
    color: var(--text-muted);
  }
  .bf-slider-labels span { display: flex; align-items: center; gap: 5px; }
  .bf-alpha-chip {
    font-family: var(--font-mono);
    font-size: 0.72rem !important;
    color: var(--text-secondary) !important;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-full);
    padding: 2px 10px;
  }
  .bf-slider {
    width: 100%; height: 6px; -webkit-appearance: none; appearance: none;
    background: linear-gradient(90deg, var(--dialect-egyptian), var(--dialect-gulf));
    border-radius: var(--radius-full); outline: none; cursor: pointer;
  }
  .bf-slider::-webkit-slider-thumb {
    -webkit-appearance: none; width: 18px; height: 18px;
    border-radius: 50%; background: var(--text-primary);
    box-shadow: 0 0 8px rgba(0,0,0,0.4); cursor: grab;
  }
  .bf-slider::-webkit-slider-thumb:active { cursor: grabbing; transform: scale(1.15); }
  .bf-blend-btn {
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 28px;
    background: linear-gradient(135deg, var(--teal-600), var(--teal-400));
    color: #fff;
    border: none;
    border-radius: var(--radius-full);
    font-size: 0.88rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) var(--ease-out);
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  }
  .bf-blend-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(0,0,0,0.3);
  }
  .bf-blend-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── Results ── */
  .bf-results {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }

  /* Audio player */
  .bf-player-section {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .bf-player-header {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  .bf-player-icon { font-size: 1.1rem; }
  .bf-player-btns {
    display: flex;
    gap: var(--space-sm);
  }
  .bf-play-btn, .bf-save-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: var(--radius-full);
    font-size: 0.83rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--duration-normal) var(--ease-out);
    border: none;
  }
  .bf-play-btn {
    background: linear-gradient(135deg, var(--teal-600), var(--teal-400));
    color: #fff;
    box-shadow: 0 3px 12px rgba(0,0,0,0.25);
  }
  .bf-play-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 5px 18px rgba(0,0,0,0.3);
  }
  .bf-save-btn {
    background: var(--bg-card);
    color: var(--text-secondary);
    border: 1px solid var(--border-default);
  }
  .bf-save-btn:hover {
    border-color: var(--teal-500);
    color: var(--teal-300);
    background: var(--teal-glow);
  }

  /* Dialect bars */
  .bf-dialect-bars {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  .bf-bars-title {
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 2px;
  }
  .bf-bar-row {
    display: grid;
    grid-template-columns: 180px 1fr 52px;
    align-items: center;
    gap: var(--space-sm);
  }
  .bf-bar-label-group {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .bf-bar-dot {
    width: 9px; height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .bf-bar-name {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .bf-bar-row.bf-bar-top .bf-bar-name {
    color: var(--text-primary);
    font-weight: 700;
  }
  .bf-bar-ar {
    font-size: 0.8rem;
    color: var(--text-muted);
    font-family: var(--font-arabic, serif);
  }
  .bf-bar-track {
    height: 7px;
    background: var(--bg-card);
    border-radius: var(--radius-full);
    overflow: hidden;
  }
  .bf-bar-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 0.5s var(--ease-out);
    min-width: 2px;
  }
  .bf-bar-pct {
    font-size: 0.78rem;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--text-muted);
    text-align: right;
  }
  .bf-bar-row.bf-bar-top .bf-bar-pct {
    color: var(--text-primary);
  }

  @media (max-width: 600px) {
    .bf-uploaders { flex-direction: column; }
    .bf-vs { flex-direction: row; padding: 0; }
    .bf-bar-row { grid-template-columns: 140px 1fr 44px; }
  }
`