import { useRef, useEffect, useState, useCallback } from 'react'
import WaveSurfer from 'wavesurfer.js'

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

  // Overlay toggles
  const [showMfcc, setShowMfcc] = useState(true)
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

  // Animation loop for time tracking
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

  // Draw spectrogram canvas
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !spectrogramData) return

    const ctx = canvas.getContext('2d')
    const { mfcc_frames, f0_contour, duration_sec } = spectrogramData
    const W = canvas.width
    const H = canvas.height

    ctx.clearRect(0, 0, W, H)

    // ── MFCC Heatmap ──
    if (showMfcc && mfcc_frames && mfcc_frames.length > 0) {
      const nCoeffs = mfcc_frames.length     // 13
      const nFrames = mfcc_frames[0].length  // T

      // Find min/max for color mapping
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
          const norm = (mfcc_frames[c][t] - vmin) / range  // 0..1
          // Teal-dark to white gradient
          const r = Math.round(10 + norm * 245)
          const g = Math.round(15 + norm * 200)
          const b = Math.round(26 + norm * 180)
          ctx.fillStyle = `rgb(${r}, ${g}, ${b})`

          const y = H - (c + 1) * cellH  // bottom-up
          ctx.fillRect(t * cellW, y, Math.ceil(cellW), Math.ceil(cellH))
        }
      }

      // Coefficient labels
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
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 2
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

      // F₀ axis labels (right side)
      ctx.fillStyle = 'rgba(251, 191, 36, 0.6)'
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

        // Dashed vertical line
        ctx.strokeStyle = '#f472b6'
        ctx.lineWidth = 1
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H * 0.85)
        ctx.stroke()
        ctx.setLineDash([])

        // Pill label at top
        const label = marker.label || ''
        ctx.font = '600 10px Inter'
        const tw = ctx.measureText(label).width
        const px = 4, py = 2, pillH = 16
        const pillX = Math.min(x - tw / 2 - px, W - tw - px * 2 - 2)
        const pillY = 4

        ctx.fillStyle = 'rgba(244, 114, 182, 0.2)'
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
      ctx.strokeStyle = 'rgba(6, 201, 167, 0.8)'
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, H)
      ctx.stroke()
    }
  }, [spectrogramData, phonemeMarkers, showMfcc, showF0, showPhonemes, currentTime])

  // Redraw on data or toggle change
  useEffect(() => {
    drawCanvas()
  }, [drawCanvas])

  // Redraw on time update (playhead)
  useEffect(() => {
    if (isPlaying) drawCanvas()
  }, [currentTime, isPlaying, drawCanvas])

  const togglePlay = () => {
    if (wsRef.current) {
      wsRef.current.playPause()
    }
  }

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
      {/* Toggle pills */}
      <div className="spectro-controls">
        <div className="toggle-pills">
          <button className={`pill ${showMfcc ? 'active' : ''}`} onClick={() => setShowMfcc(!showMfcc)}>
            MFCC Heatmap
          </button>
          <button className={`pill ${showF0 ? 'active' : ''}`} onClick={() => setShowF0(!showF0)}>
            <span style={{ color: '#fbbf24' }}>●</span> F₀ Curve
          </button>
          <button className={`pill ${showPhonemes ? 'active' : ''}`} onClick={() => setShowPhonemes(!showPhonemes)}>
            <span style={{ color: '#f472b6' }}>●</span> Phonemes
          </button>
        </div>
        <div className="time-display">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>

      {/* Spectrogram canvas */}
      <div className="spectro-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={900}
          height={180}
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
    margin-bottom: var(--space-md);
    flex-wrap: wrap;
    gap: var(--space-sm);
  }
  .toggle-pills {
    display: flex;
    gap: 6px;
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
    color: var(--text-secondary);
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
    height: 180px;
    display: block;
    background: var(--bg-card);
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
