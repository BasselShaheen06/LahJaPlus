import { useRef, useEffect, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'

// Magma-like colormap (perceptually uniform, dark→bright)
// Approximation of matplotlib's "magma" — interpolates 6 anchor colors
const MAGMA_STOPS = [
  [0,   0,   4],     // near-black
  [40,  11,  84],    // deep purple
  [101, 21, 110],    // purple
  [159, 42, 99],     // magenta
  [212, 72, 66],     // red-orange
  [245, 125, 21],    // orange
  [252, 253, 191],   // pale yellow
]

function magmaColor(v) {
  // v in [0, 1]
  v = Math.max(0, Math.min(1, v))
  const scaled = v * (MAGMA_STOPS.length - 1)
  const i = Math.floor(scaled)
  const frac = scaled - i
  const c1 = MAGMA_STOPS[i]
  const c2 = MAGMA_STOPS[Math.min(i + 1, MAGMA_STOPS.length - 1)]
  const r = Math.round(c1[0] + (c2[0] - c1[0]) * frac)
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * frac)
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * frac)
  return `rgb(${r},${g},${b})`
}

export default function SpectrogramViewer({
  fileUrl, spectrogramData, phonemeMarkers,
  onTimeUpdate, onPlayingChange, onWavesurferReady
}) {
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const animRef = useRef(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  // View mode: 'mel' (true spectrogram) or 'mfcc' (cepstral heatmap)
  const [viewMode, setViewMode] = useState('mel')

  // Overlay toggles
  const [showF0, setShowF0] = useState(true)
  const [showPhonemes, setShowPhonemes] = useState(true)

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !fileUrl) return

    const ws = WaveSurfer.create({
      container: containerRef.current,
      waveColor: 'rgba(6, 201, 167, 0.4)',
      progressColor: '#06c9a7',
      cursorColor: '#06c9a7',
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      height: 64,
      normalize: true,
      backend: 'WebAudio',
    })

    ws.load(fileUrl)

    ws.on('ready', () => {
      setDuration(ws.getDuration())
      onWavesurferReady?.(ws)
    })

    ws.on('play', () => { setIsPlaying(true); onPlayingChange?.(true) })
    ws.on('pause', () => { setIsPlaying(false); onPlayingChange?.(false) })
    ws.on('finish', () => { setIsPlaying(false); onPlayingChange?.(false) })

    wsRef.current = ws

    return () => {
      cancelAnimationFrame(animRef.current)
      ws.destroy()
      wsRef.current = null
    }
  }, [fileUrl])

  // Animation loop
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return

    const tick = () => {
      if (ws.isPlaying()) {
        const t = ws.getCurrentTime()
        setCurrentTime(t)
        onTimeUpdate?.(t)
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [fileUrl, onTimeUpdate])

  // Draw canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !spectrogramData) return

    const ctx = canvas.getContext('2d')
    const { mel_spectrogram, mfcc_frames, f0_contour, duration_sec } = spectrogramData
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    // ── Mel Spectrogram (magma colormap) ──
    if (viewMode === 'mel' && mel_spectrogram && mel_spectrogram.length > 0) {
      const nMels = mel_spectrogram.length        // 80
      const nFrames = mel_spectrogram[0].length

      const cellW = W / nFrames
      const cellH = H / nMels

      // Use offscreen ImageData for speed
      const imageData = ctx.createImageData(W, H)
      const data = imageData.data

      for (let y = 0; y < H; y++) {
        // y=0 is top of canvas; we want low frequencies at bottom → invert
        const melIdx = Math.floor((1 - y / H) * nMels)
        const melRow = mel_spectrogram[Math.min(melIdx, nMels - 1)]
        for (let x = 0; x < W; x++) {
          const tIdx = Math.floor((x / W) * nFrames)
          const v = melRow[Math.min(tIdx, nFrames - 1)]
          // magma color
          const scaled = Math.max(0, Math.min(1, v)) * (MAGMA_STOPS.length - 1)
          const i = Math.floor(scaled)
          const frac = scaled - i
          const c1 = MAGMA_STOPS[i]
          const c2 = MAGMA_STOPS[Math.min(i + 1, MAGMA_STOPS.length - 1)]
          const px = (y * W + x) * 4
          data[px]     = c1[0] + (c2[0] - c1[0]) * frac
          data[px + 1] = c1[1] + (c2[1] - c1[1]) * frac
          data[px + 2] = c1[2] + (c2[2] - c1[2]) * frac
          data[px + 3] = 255
        }
      }
      ctx.putImageData(imageData, 0, 0)

      // Frequency axis labels (left side)
      ctx.fillStyle = 'rgba(255,255,255,0.6)'
      ctx.font = '10px Inter'
      ctx.textAlign = 'left'
      const freqLabels = [0, 1000, 2000, 4000, 8000]
      for (const f of freqLabels) {
        const y = H - (f / 8000) * H
        ctx.fillText(`${f >= 1000 ? (f/1000)+'k' : f}Hz`, 4, y - 2)
      }
    }

    // ── MFCC Heatmap (alternative view) ──
    if (viewMode === 'mfcc' && mfcc_frames && mfcc_frames.length > 0) {
      const nCoeffs = mfcc_frames.length
      const nFrames = mfcc_frames[0].length

      let vmin = Infinity, vmax = -Infinity
      for (let c = 0; c < nCoeffs; c++) {
        for (let t = 0; t < nFrames; t++) {
          const v = mfcc_frames[c][t]
          if (v < vmin) vmin = v
          if (v > vmax) vmax = v
        }
      }
      const range = vmax - vmin || 1

      const cellW = W / nFrames
      const cellH = H / nCoeffs

      for (let c = 0; c < nCoeffs; c++) {
        for (let t = 0; t < nFrames; t++) {
          const norm = (mfcc_frames[c][t] - vmin) / range
          ctx.fillStyle = magmaColor(norm)
          const y = H - (c + 1) * cellH
          ctx.fillRect(t * cellW, y, Math.ceil(cellW), Math.ceil(cellH))
        }
      }

      ctx.fillStyle = 'rgba(255,255,255,0.5)'
      ctx.font = '10px Inter'
      ctx.textAlign = 'left'
      for (let c = 0; c < nCoeffs; c += 3) {
        const y = H - (c + 0.5) * cellH
        ctx.fillText(`C${c + 1}`, 4, y + 3)
      }
    }

    // ── F₀ Contour ──
    if (showF0 && f0_contour && f0_contour.length > 0 && duration_sec > 0) {
      const maxF0 = 400
      ctx.strokeStyle = '#52f5d5'
      ctx.lineWidth = 2
      ctx.shadowColor = 'rgba(82, 245, 213, 0.6)'
      ctx.shadowBlur = 4
      ctx.setLineDash([])
      ctx.beginPath()
      let started = false
      for (const [t, f0] of f0_contour) {
        if (f0 <= 0) { started = false; continue }
        const x = (t / duration_sec) * W
        const y = H - (f0 / maxF0) * H
        if (!started) { ctx.moveTo(x, y); started = true }
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      // F₀ axis labels (right side)
      ctx.fillStyle = 'rgba(82, 245, 213, 0.7)'
      ctx.font = '9px Inter'
      ctx.textAlign = 'right'
      for (let f = 100; f <= 350; f += 100) {
        const y = H - (f / maxF0) * H
        ctx.fillText(`${f}Hz`, W - 4, y + 3)
      }
    }

    // ── Phoneme Markers ──
    if (showPhonemes && phonemeMarkers && phonemeMarkers.length > 0 && duration_sec > 0) {
      for (const marker of phonemeMarkers) {
        const x = (marker.time / duration_sec) * W

        ctx.strokeStyle = '#f472b6'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H * 0.85)
        ctx.stroke()
        ctx.setLineDash([])

        const label = marker.label || ''
        ctx.font = '600 10px Inter'
        const tw = ctx.measureText(label).width
        const px = 4
        const pillH = 16
        const pillX = Math.min(x - tw / 2 - px, W - tw - px * 2 - 2)
        const pillY = 4

        ctx.fillStyle = 'rgba(244, 114, 182, 0.25)'
        ctx.beginPath()
        ctx.roundRect(Math.max(2, pillX), pillY, tw + px * 2, pillH, 4)
        ctx.fill()

        ctx.fillStyle = '#f472b6'
        ctx.textAlign = 'center'
        ctx.fillText(label, Math.max(2 + px + tw / 2, x), pillY + 12)
      }
    }

    // ── Playhead ──
    if (duration_sec > 0 && currentTime > 0) {
      const x = (currentTime / duration_sec) * W
      ctx.strokeStyle = 'rgba(6, 201, 167, 0.9)'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
  }, [spectrogramData, phonemeMarkers, viewMode, showF0, showPhonemes, currentTime])

  useEffect(() => { drawCanvas() }, [drawCanvas])
  useEffect(() => { if (isPlaying) drawCanvas() }, [currentTime, isPlaying, drawCanvas])

  const togglePlay = () => { wsRef.current?.playPause() }

  const formatTime = (s) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!fileUrl) {
    return (
      <div className="spectro-viewer glass-card">
        <div className="empty-state">
          <span className="icon">📈</span>
          <p>Spectrogram will appear here</p>
        </div>
        <style>{spectroStyles}</style>
      </div>
    )
  }

  return (
    <div className="spectro-viewer glass-card fade-in">
      {/* View mode tabs */}
      <div className="spectro-controls">
        <div className="view-tabs">
          <button
            className={`tab ${viewMode === 'mel' ? 'active' : ''}`}
            onClick={() => setViewMode('mel')}
          >
            Mel Spectrogram
          </button>
          <button
            className={`tab ${viewMode === 'mfcc' ? 'active' : ''}`}
            onClick={() => setViewMode('mfcc')}
          >
            MFCC Heatmap
          </button>
        </div>
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Overlay toggles */}
      <div className="overlay-pills">
        <button className={`pill ${showF0 ? 'active' : ''}`} onClick={() => setShowF0(!showF0)}>
          <span style={{ color: '#52f5d5' }}>●</span> F₀ Curve
        </button>
        <button className={`pill ${showPhonemes ? 'active' : ''}`} onClick={() => setShowPhonemes(!showPhonemes)}>
          <span style={{ color: '#f472b6' }}>●</span> Phonemes
        </button>
        <span className="view-hint">
          {viewMode === 'mel'
            ? 'Frequency (Hz) vs Time — log-power magnitude'
            : 'MFCC coefficients (1–13) vs Time'}
        </span>
      </div>

      {/* Spectrogram canvas */}
      <div className="spectro-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={900}
          height={220}
          className="spectro-canvas"
        />
      </div>

      {/* WaveSurfer waveform */}
      <div className="waveform-wrap">
        <button className="play-btn" onClick={togglePlay} id="play-pause-btn">
          {isPlaying ? '⏸' : '▶'}
        </button>
        <div className="waveform-container" ref={containerRef}></div>
      </div>

      <style>{spectroStyles}</style>
    </div>
  )
}

const spectroStyles = `
  .spectro-viewer {
    padding: var(--space-md);
  }
  .spectro-controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-sm);
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .view-tabs {
    display: flex;
    background: var(--bg-card);
    border-radius: var(--radius-md);
    padding: 3px;
    border: 1px solid var(--border-subtle);
  }
  .tab {
    padding: 6px 14px;
    border: none;
    background: transparent;
    color: var(--text-muted);
    font-size: 0.8rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: var(--radius-sm);
    transition: all var(--duration-fast);
    font-family: var(--font-sans);
  }
  .tab.active {
    background: var(--teal-glow);
    color: var(--teal-300);
  }
  .tab:hover:not(.active) {
    color: var(--text-secondary);
  }
  .overlay-pills {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
  }
  .pill {
    padding: 4px 12px;
    border-radius: var(--radius-full);
    border: 1px solid var(--border-default);
    background: transparent;
    color: var(--text-muted);
    font-size: 0.75rem;
    font-family: var(--font-sans);
    font-weight: 500;
    cursor: pointer;
    transition: all var(--duration-fast);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .pill.active {
    background: var(--teal-glow);
    border-color: var(--teal-600);
    color: var(--teal-300);
  }
  .pill:hover {
    border-color: var(--border-strong);
  }
  .view-hint {
    margin-left: auto;
    font-size: 0.7rem;
    color: var(--text-muted);
    font-style: italic;
  }
  .time-display {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--text-muted);
  }
  .spectro-canvas-wrap {
    border-radius: var(--radius-md);
    overflow: hidden;
    margin-bottom: var(--space-md);
    border: 1px solid var(--border-subtle);
  }
  .spectro-canvas {
    width: 100%;
    height: 220px;
    display: block;
    background: #000;
  }
  .waveform-wrap {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  .play-btn {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: 2px solid var(--teal-500);
    background: var(--teal-glow);
    color: var(--teal-300);
    font-size: 1rem;
    cursor: pointer;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--duration-fast);
  }
  .play-btn:hover {
    background: var(--teal-glow-strong);
    box-shadow: var(--shadow-glow);
    transform: scale(1.05);
  }
  .waveform-container {
    flex: 1;
    min-height: 64px;
  }
`