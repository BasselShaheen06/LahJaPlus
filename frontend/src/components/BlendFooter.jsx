import { useState, useRef, useCallback, useMemo, useEffect } from 'react'

const DIALECTS = [
  { key: 'egyptian', label: 'EGY', color: 'var(--dialect-egyptian)' },
  { key: 'levantine', label: 'LEV', color: 'var(--dialect-levantine)' },
  { key: 'gulf', label: 'GLF', color: 'var(--dialect-gulf)' },
  { key: 'maghrebi', label: 'MAG', color: 'var(--dialect-maghrebi)' },
]

export default function BlendFooter({
  fileA, fileB, classifyResultA, classifyResultB,
  blendResult, alpha, loadingB, onFileBLoaded, onBlend
}) {
  const inputRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const debounceRef = useRef(null)

  const handleFileBSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      onFileBLoaded({ file, url, name: file.name, size: file.size })
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      onFileBLoaded({ file, url, name: file.name, size: file.size })
    }
  }

  // Debounced blend
  const handleSliderChange = useCallback((e) => {
    const newAlpha = parseFloat(e.target.value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onBlend(newAlpha)
    }, 200)
  }, [onBlend])

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  const blendConfidence = blendResult?.confidence || {}
  const canBlend = classifyResultA?.ivector && classifyResultB?.ivector

  return (
    <div className="blend-footer glass-card">
      <div className="section-header">
        <span className="icon">🎚️</span>
        <h2>Dialect Blending</h2>
      </div>

      <div className="bf-layout">
        {/* File B picker */}
        <div className="bf-fileb">
          {fileB ? (
            <div className="bf-fileb-info fade-in">
              <span className="bf-fileb-icon">🎙️</span>
              <div className="bf-fileb-details">
                <span className="bf-fileb-name">{fileB.name}</span>
                {classifyResultB && (
                  <span className={`badge badge-${classifyResultB.dialect}`} style={{ fontSize: '0.65rem' }}>
                    {classifyResultB.dialect}
                  </span>
                )}
              </div>
              <button className="bf-change-btn" onClick={() => inputRef.current?.click()}>Change</button>
            </div>
          ) : (
            <div
              className={`bf-fileb-drop ${isDragging ? 'dragging' : ''}`}
              onClick={() => inputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
            >
              <span>+ Add File B for blending</span>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".wav,.mp3,.ogg,.flac"
            onChange={handleFileBSelect}
            style={{ display: 'none' }}
            id="file-b-input"
          />
          {loadingB && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Classifying File B...</span>
            </div>
          )}
        </div>

        {/* Slider + confidence */}
        <div className={`bf-slider-section ${canBlend ? '' : 'disabled'}`}>
          <div className="bf-slider-labels">
            <span>File A {classifyResultA && <span className={`badge badge-${classifyResultA.dialect}`} style={{ fontSize: '0.6rem' }}>{classifyResultA.dialect}</span>}</span>
            <span>{classifyResultB && <span className={`badge badge-${classifyResultB.dialect}`} style={{ fontSize: '0.6rem' }}>{classifyResultB.dialect}</span>} File B</span>
          </div>

          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            defaultValue={alpha}
            onChange={handleSliderChange}
            disabled={!canBlend}
            className="bf-slider"
            id="blend-slider"
          />

          <div className="bf-alpha-value">
            α = {(blendResult?.alpha ?? alpha).toFixed(2)}
          </div>

          {/* Mini confidence bars */}
          {blendResult && (
            <div className="bf-mini-bars fade-in">
              {DIALECTS.map(d => (
                <div key={d.key} className="bf-mini-bar">
                  <div className="bf-mini-bar-track">
                    <div
                      className="bf-mini-bar-fill"
                      style={{
                        width: `${(blendConfidence[d.key] || 0) * 100}%`,
                        background: d.color,
                      }}
                    />
                  </div>
                  <span className="bf-mini-label">{d.label} {((blendConfidence[d.key] || 0) * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{styles}</style>
    </div>
  )
}

const styles = `
  .blend-footer {
    padding: var(--space-lg);
  }
  .bf-layout {
    display: flex;
    gap: var(--space-xl);
    align-items: flex-start;
  }
  @media (max-width: 800px) {
    .bf-layout {
      flex-direction: column;
    }
  }
  .bf-fileb {
    flex: 0 0 240px;
  }
  .bf-fileb-drop {
    border: 2px dashed var(--border-default);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
    text-align: center;
    cursor: pointer;
    font-size: 0.85rem;
    color: var(--text-muted);
    transition: all var(--duration-normal) var(--ease-out);
  }
  .bf-fileb-drop:hover, .bf-fileb-drop.dragging {
    border-color: var(--teal-500);
    background: var(--teal-glow);
    color: var(--teal-300);
  }
  .bf-fileb-info {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    background: var(--bg-card);
    border-radius: var(--radius-md);
    border: 1px solid var(--border-subtle);
  }
  .bf-fileb-icon { font-size: 1.2rem; }
  .bf-fileb-details {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bf-fileb-name {
    font-size: 0.8rem;
    font-weight: 500;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 140px;
  }
  .bf-change-btn {
    font-size: 0.75rem;
    color: var(--teal-400);
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 500;
  }
  /* Slider section */
  .bf-slider-section {
    flex: 1;
  }
  .bf-slider-section.disabled {
    opacity: 0.3;
    pointer-events: none;
  }
  .bf-slider-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 6px;
  }
  .bf-slider-labels span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .bf-slider {
    width: 100%;
    height: 6px;
    -webkit-appearance: none;
    appearance: none;
    background: linear-gradient(90deg, var(--dialect-egyptian), var(--dialect-gulf));
    border-radius: var(--radius-full);
    outline: none;
    cursor: pointer;
  }
  .bf-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--text-primary);
    box-shadow: 0 0 8px rgba(0,0,0,0.3);
    cursor: grab;
  }
  .bf-slider::-webkit-slider-thumb:active {
    cursor: grabbing;
    transform: scale(1.1);
  }
  .bf-alpha-value {
    text-align: center;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-muted);
    margin-top: 4px;
  }
  /* Mini bars */
  .bf-mini-bars {
    display: flex;
    gap: var(--space-sm);
    margin-top: var(--space-md);
  }
  .bf-mini-bar {
    flex: 1;
  }
  .bf-mini-bar-track {
    height: 4px;
    background: var(--bg-card);
    border-radius: var(--radius-full);
    overflow: hidden;
    margin-bottom: 3px;
  }
  .bf-mini-bar-fill {
    height: 100%;
    border-radius: var(--radius-full);
    transition: width 0.3s var(--ease-out);
  }
  .bf-mini-label {
    font-size: 0.65rem;
    color: var(--text-muted);
    font-family: var(--font-mono);
  }
`
