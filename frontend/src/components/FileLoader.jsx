import { useState, useRef, useCallback } from 'react'

const ACCEPTED_TYPES = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/ogg', 'audio/flac', 'audio/x-wav']
const ACCEPTED_EXT = ['.wav', '.mp3', '.ogg', '.flac', '.m4a']

export default function FileLoader({ onFileLoaded, currentFile, loading }) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const processFile = useCallback((file) => {
    if (!file) return
    const url = URL.createObjectURL(file)
    onFileLoaded({ file, url, name: file.name, size: file.size })
  }, [onFileLoaded])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragging(false), [])

  const handleClick = () => inputRef.current?.click()

  const handleChange = (e) => {
    const file = e.target.files[0]
    if (file) processFile(file)
  }

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <div className="file-loader glass-card" style={{ position: 'relative' }}>
      {loading && (
        <div className="loading-overlay">
          <div style={{ textAlign: 'center' }}>
            <div className="spinner"></div>
            <p style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Analyzing dialect...
            </p>
          </div>
        </div>
      )}

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''} ${currentFile ? 'has-file' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXT.join(',')}
          onChange={handleChange}
          style={{ display: 'none' }}
          id="file-loader-input"
        />

        {currentFile ? (
          <div className="file-info fade-in">
            <div className="file-icon">🎙️</div>
            <div className="file-details">
              <span className="file-name">{currentFile.name}</span>
              <span className="file-meta">{formatSize(currentFile.size)}</span>
            </div>
            <span className="file-change">Change file</span>
          </div>
        ) : (
          <div className="upload-prompt">
            <div className="upload-icon">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <p className="upload-title">Drop Arabic audio here</p>
            <p className="upload-subtitle">WAV or MP3 · 25–35 seconds</p>
          </div>
        )}
      </div>

      <style>{`
        .file-loader {
          padding: var(--space-md);
          overflow: hidden;
        }
        .drop-zone {
          border: 2px dashed var(--border-default);
          border-radius: var(--radius-md);
          padding: var(--space-xl) var(--space-lg);
          cursor: pointer;
          transition: all var(--duration-normal) var(--ease-out);
          text-align: center;
        }
        .drop-zone:hover, .drop-zone.dragging {
          border-color: var(--teal-500);
          background: var(--teal-glow);
        }
        .drop-zone.dragging {
          transform: scale(1.01);
          box-shadow: var(--shadow-glow-strong);
        }
        .drop-zone.has-file {
          border-style: solid;
          border-color: var(--border-subtle);
          padding: var(--space-md) var(--space-lg);
        }
        .drop-zone.has-file:hover {
          border-color: var(--teal-500);
        }
        .upload-prompt {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-sm);
        }
        .upload-icon {
          color: var(--teal-400);
          opacity: 0.7;
          margin-bottom: var(--space-sm);
        }
        .upload-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--text-primary);
        }
        .upload-subtitle {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .file-info {
          display: flex;
          align-items: center;
          gap: var(--space-md);
        }
        .file-icon {
          font-size: 1.8rem;
        }
        .file-details {
          display: flex;
          flex-direction: column;
          text-align: left;
          flex: 1;
        }
        .file-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: var(--text-primary);
        }
        .file-meta {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .file-change {
          font-size: 0.8rem;
          color: var(--teal-400);
          font-weight: 500;
        }
      `}</style>
    </div>
  )
}
