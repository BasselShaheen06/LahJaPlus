import { useState, useCallback } from 'react'
import './App.css'
import FileLoader from './components/FileLoader'
import SpectrogramViewer from './components/SpectrogramViewer'
import DialectResult from './components/DialectResult'
import ExplainStrip from './components/ExplainStrip'
import TranscriptPanel from './components/TranscriptPanel'
import SynthesisBar from './components/SynthesisBar'
import BlendFooter from './components/BlendFooter'
import { classifyAudio, transcribeAudio, translateText, synthesizeSpeech, blendDialects } from './api/client'

function App() {
  // ── File state ──
  const [fileA, setFileA] = useState(null)
  const [fileB, setFileB] = useState(null)

  // ── Classification state ──
  const [classifyResult, setClassifyResult] = useState(null)
  const [classifyResultB, setClassifyResultB] = useState(null)
  const [classifyLoading, setClassifyLoading] = useState(false)
  const [classifyLoadingB, setClassifyLoadingB] = useState(false)

  // ── Transcript state ──
  const [transcriptResult, setTranscriptResult] = useState(null)
  const [transcriptLoading, setTranscriptLoading] = useState(false)

  // ── Translation state ──
  const [translateResult, setTranslateResult] = useState(null)
  const [translateLoading, setTranslateLoading] = useState(false)

  // ── Synthesis state ──
  const [synthesisUrl, setSynthesisUrl] = useState(null)
  const [synthesisLoading, setSynthesisLoading] = useState(false)

  // ── Blend state ──
  const [blendResult, setBlendResult] = useState(null)
  const [alpha, setAlpha] = useState(0.5)

  // ── Playback state ──
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [wavesurferRef, setWavesurferRef] = useState(null)

  // ── Target dialect ──
  const [targetDialect, setTargetDialect] = useState(null)

  // ── Error state ──
  const [error, setError] = useState(null)

  // ── File A loaded → classify + transcribe ──
  const handleFileALoaded = useCallback(async (fileData) => {
    setFileA(fileData)
    setClassifyResult(null)
    setTranscriptResult(null)
    setTranslateResult(null)
    setSynthesisUrl(null)
    setBlendResult(null)
    setError(null)

    // Classify
    setClassifyLoading(true)
    try {
      const result = await classifyAudio(fileData.file)
      setClassifyResult(result)

      // Auto-transcribe after classification
      setTranscriptLoading(true)
      try {
        const transcript = await transcribeAudio(fileData.file, result.dialect)
        setTranscriptResult(transcript)
      } catch (e) {
        console.error('Transcription failed:', e)
      } finally {
        setTranscriptLoading(false)
      }
    } catch (e) {
      setError('Classification failed: ' + e.message)
      console.error('Classification failed:', e)
    } finally {
      setClassifyLoading(false)
    }
  }, [])

  // ── File B loaded → classify for blend ──
  const handleFileBLoaded = useCallback(async (fileData) => {
    setFileB(fileData)
    setClassifyResultB(null)
    setBlendResult(null)

    setClassifyLoadingB(true)
    try {
      const result = await classifyAudio(fileData.file)
      setClassifyResultB(result)
    } catch (e) {
      console.error('File B classification failed:', e)
    } finally {
      setClassifyLoadingB(false)
    }
  }, [])

  // ── Translation ──
  const handleTranslate = useCallback(async (tgtDialect) => {
    if (!transcriptResult || !classifyResult) return
    setTargetDialect(tgtDialect)
    setTranslateResult(null)
    setSynthesisUrl(null)
    setTranslateLoading(true)

    try {
      const result = await translateText(
        transcriptResult.full_text,
        classifyResult.dialect,
        tgtDialect
      )
      setTranslateResult(result)
    } catch (e) {
      console.error('Translation failed:', e)
    } finally {
      setTranslateLoading(false)
    }
  }, [transcriptResult, classifyResult])

  // ── Synthesis ──
  const handleSynthesize = useCallback(async () => {
    if (!translateResult || !fileA || !targetDialect) return
    setSynthesisLoading(true)
    setSynthesisUrl(null)

    try {
      const audioUrl = await synthesizeSpeech(
        translateResult.target_text,
        targetDialect,
        fileA.file
      )
      setSynthesisUrl(audioUrl)
    } catch (e) {
      console.error('Synthesis failed:', e)
    } finally {
      setSynthesisLoading(false)
    }
  }, [translateResult, fileA, targetDialect])

  // ── Blend ──
  const handleBlend = useCallback(async (newAlpha) => {
    setAlpha(newAlpha)
    if (!classifyResult?.ivector || !classifyResultB?.ivector) return

    try {
      const result = await blendDialects(
        classifyResult.ivector,
        classifyResultB.ivector,
        newAlpha
      )
      setBlendResult(result)
    } catch (e) {
      console.error('Blend failed:', e)
    }
  }, [classifyResult, classifyResultB])

  return (
    <>
      {/* Header */}
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🗣️</div>
          <div>
            <h1>LahJa+</h1>
            <span className="subtitle">Arabic Dialect Explorer</span>
          </div>
        </div>
        <div className="app-status">
          <span className="status-dot"></span>
          <span>{classifyResult ? `Detected: ${classifyResult.dialect}` : 'Ready'}</span>
        </div>
      </header>

      {/* Main content grid */}
      <main className="app-main">
        {/* File Loader */}
        <div className="area-loader">
          <FileLoader
            onFileLoaded={handleFileALoaded}
            currentFile={fileA}
            loading={classifyLoading}
          />
        </div>

        {/* Sidebar: Dialect Result */}
        <div className="area-sidebar">
          <DialectResult
            result={classifyResult}
            blendResult={blendResult}
            loading={classifyLoading}
          />
        </div>

        {/* Spectrogram Viewer */}
        <div className="area-spectro">
          <SpectrogramViewer
            fileUrl={fileA?.url}
            spectrogramData={classifyResult?.spectrogram_data}
            phonemeMarkers={classifyResult?.features?.phoneme_markers}
            onTimeUpdate={setCurrentTime}
            onPlayingChange={setIsPlaying}
            onWavesurferReady={setWavesurferRef}
          />
        </div>

        {/* Explainability Strip */}
        <div className="area-explain">
          <ExplainStrip
            features={classifyResult?.features}
            dialect={classifyResult?.dialect}
          />
        </div>

        {/* Transcript Panel */}
        <div className="area-transcript">
          <TranscriptPanel
            words={transcriptResult?.words}
            fullText={transcriptResult?.full_text}
            currentTime={currentTime}
            loading={transcriptLoading}
          />
        </div>

        {/* Synthesis Bar */}
        <div className="area-synthesis">
          <SynthesisBar
            detectedDialect={classifyResult?.dialect}
            transcriptReady={!!transcriptResult}
            translateResult={translateResult}
            synthesisUrl={synthesisUrl}
            translateLoading={translateLoading}
            synthesisLoading={synthesisLoading}
            onTranslate={handleTranslate}
            onSynthesize={handleSynthesize}
          />
        </div>

        {/* Blend Footer */}
        <div className="area-blend">
          <BlendFooter
            fileA={fileA}
            fileB={fileB}
            classifyResultA={classifyResult}
            classifyResultB={classifyResultB}
            blendResult={blendResult}
            alpha={alpha}
            loadingB={classifyLoadingB}
            onFileBLoaded={handleFileBLoaded}
            onBlend={handleBlend}
          />
        </div>
      </main>

      {/* Error toast */}
      {error && (
        <div className="error-toast fade-in" onClick={() => setError(null)}>
          <span>⚠️</span> {error}
        </div>
      )}
    </>
  )
}

export default App
