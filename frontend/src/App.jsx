import { useState } from 'react'
import { useLahjaState } from './hooks/useLahjaState'
import FileLoader from './components/FileLoader'
import SpectrogramViewer from './components/SpectrogramViewer'
import DialectResult from './components/DialectResult'
import ExplainStrip from './components/ExplainStrip'
import TranscriptPanel from './components/TranscriptPanel'
import SynthesisBar from './components/SynthesisBar'
import BlendFooter from './components/BlendFooter'
import './App.css'

export default function App() {
  const { state, updateState, handleLoadFileA, handleLoadFileB, handleTranslate, handleSynthesize, handleBlend } = useLahjaState()
  const [currentTime, setCurrentTime] = useState(0)

  return (
    <>
      <header className="app-header">
        <div className="app-logo">
          <div className="app-logo-icon">🗣️</div>
          <div>
            <h1>LahJa+</h1>
            <span className="subtitle">Arabic Dialect Explorer</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="area-loader">
          <FileLoader
            onFileLoaded={handleLoadFileA}
            currentFile={state.fileA}
            loading={state.loadingA}
          />
        </div>

        <div className="area-sidebar">
          <DialectResult
            result={state.classifyResultA}
            blendResult={state.blendResult}
            loading={state.loadingA}
          />
        </div>

        <div className="area-spectro">
          <SpectrogramViewer
            fileUrl={state.fileA?.url}
            spectrogramData={state.classifyResultA?.spectrogram_data}
            phonemeMarkers={state.classifyResultA?.features?.phoneme_markers}
            onTimeUpdate={setCurrentTime}
          />
        </div>

        <div className="area-explain">
          <ExplainStrip
            features={state.classifyResultA?.features}
            dialect={state.classifyResultA?.dialect}
          />
        </div>

        <div className="area-transcript">
          <TranscriptPanel
            words={state.transcriptResult?.words}
            currentTime={currentTime}
            loading={state.transcriptLoading}
          />
        </div>

        <div className="area-synthesis">
          <SynthesisBar
            detectedDialect={state.classifyResultA?.dialect}
            transcriptReady={!!state.transcriptResult}
            translateResult={state.translateResult}
            synthesisUrl={state.synthesisUrl}
            translateLoading={state.translateLoading}
            synthesisLoading={state.synthesisLoading}
            onTranslate={handleTranslate}
            onSynthesize={handleSynthesize}
          />
        </div>

        <div className="area-blend">
          <BlendFooter
            fileA={state.fileA}
            fileB={state.fileB}
            classifyResultA={state.classifyResultA}
            classifyResultB={state.classifyResultB}
            blendResult={state.blendResult}
            alpha={state.alpha}
            loadingB={state.loadingB}
            onFileBLoaded={handleLoadFileB}
            onBlend={handleBlend}
          />
        </div>
      </main>

      {state.error && (
        <div className="error-toast fade-in" onClick={() => updateState({ error: null })}>
          <span>⚠️</span> {state.error}
        </div>
      )}
    </>
  )
}