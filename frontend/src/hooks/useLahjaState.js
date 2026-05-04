import { useState, useCallback } from 'react'
import { classifyAudio, transcribeAudio, translateText, synthesizeSpeech, blendDialects } from '../api/client'

export function useLahjaState() {
  const [state, setState] = useState({
    // Point 1 — main file (used for spectrogram, transcript, synthesis)
    fileA: null,
    classifyResultA: null,
    transcriptResult: null,
    translateResult: null,
    synthesisUrl: null,
    loadingA: false,
    transcriptLoading: false,
    translateLoading: false,
    synthesisLoading: false,

    // Point 5 — blend section has its OWN independent File A and File B
    blendFileA: null,
    blendFileB: null,
    blendClassifyA: null,   // classification result for blend File A
    blendClassifyB: null,   // classification result for blend File B
    blendLoadingA: false,
    blendLoadingB: false,
    blendResult: null,
    blendedAudioUrl: null,
    alpha: 0.5,

    error: null,
  })

  const updateState = (updates) => setState((prev) => ({ ...prev, ...updates }))

  // ── Point 1: Main file (spectrogram + transcript + synthesis) ──────────────
  const handleLoadFileA = useCallback(async (fileData) => {
    updateState({
      fileA: fileData,
      classifyResultA: null,
      transcriptResult: null,
      translateResult: null,
      synthesisUrl: null,
      loadingA: true,
      error: null,
    })
    try {
      const result = await classifyAudio(fileData.file)
      updateState({ classifyResultA: result, loadingA: false, transcriptLoading: true })

      const transcript = await transcribeAudio(fileData.file, result.dialect)
      updateState({ transcriptResult: transcript, transcriptLoading: false })
    } catch (err) {
      updateState({ error: 'Processing failed: ' + err.message, loadingA: false, transcriptLoading: false })
    }
  }, [])

  // ── Point 4: Translate + Synthesize ───────────────────────────────────────
  const handleTranslate = useCallback(async (targetDialect) => {
    if (!state.transcriptResult || !state.classifyResultA) return
    updateState({ translateLoading: true, translateResult: null, synthesisUrl: null })
    try {
      const result = await translateText(state.transcriptResult.full_text, state.classifyResultA.dialect, targetDialect)
      updateState({ translateResult: result, translateLoading: false })
    } catch (err) {
      updateState({ error: 'Translation failed', translateLoading: false })
    }
  }, [state.transcriptResult, state.classifyResultA])

  const handleSynthesize = useCallback(async (targetDialect) => {
    if (!state.translateResult || !state.fileA) return
    updateState({ synthesisLoading: true, synthesisUrl: null })
    try {
      const audioUrl = await synthesizeSpeech(state.translateResult.target_text, targetDialect, state.fileA.file)
      updateState({ synthesisUrl: audioUrl, synthesisLoading: false })
    } catch (err) {
      updateState({ error: 'Synthesis failed', synthesisLoading: false })
    }
  }, [state.translateResult, state.fileA])

  // ── Point 5: Blend section — independent File A ───────────────────────────
  const handleLoadBlendFileA = useCallback(async (fileData) => {
    updateState({
      blendFileA: fileData,
      blendClassifyA: null,
      blendResult: null,
      blendedAudioUrl: null,
      blendLoadingA: true,
      error: null,
    })
    try {
      const result = await classifyAudio(fileData.file)
      updateState({ blendClassifyA: result, blendLoadingA: false })
    } catch (err) {
      updateState({ error: 'Failed to classify Blend File A', blendLoadingA: false })
    }
  }, [])

  // ── Point 5: Blend section — independent File B ───────────────────────────
  const handleLoadBlendFileB = useCallback(async (fileData) => {
    updateState({
      blendFileB: fileData,
      blendClassifyB: null,
      blendResult: null,
      blendedAudioUrl: null,
      blendLoadingB: true,
      error: null,
    })
    try {
      const result = await classifyAudio(fileData.file)
      updateState({ blendClassifyB: result, blendLoadingB: false })
    } catch (err) {
      updateState({ error: 'Failed to classify Blend File B', blendLoadingB: false })
    }
  }, [])

  // ── Point 5: Run the blend ─────────────────────────────────────────────────
  const handleBlend = useCallback(async (newAlpha) => {
    updateState({ alpha: newAlpha })
    if (!state.blendFileA?.file || !state.blendFileB?.file) return

    try {
      // Revoke previous blended audio URL to avoid memory leaks
      if (state.blendedAudioUrl) URL.revokeObjectURL(state.blendedAudioUrl)

      const result = await blendDialects(state.blendFileA.file, state.blendFileB.file, newAlpha)
      updateState({
        blendResult: result,
        blendedAudioUrl: result.blendedAudioUrl || null,
      })
    } catch (err) {
      updateState({ error: 'Failed to blend files: ' + err.message })
    }
  }, [state.blendFileA, state.blendFileB, state.blendedAudioUrl])

  return {
    state,
    updateState,
    handleLoadFileA,
    handleTranslate,
    handleSynthesize,
    handleLoadBlendFileA,
    handleLoadBlendFileB,
    handleBlend,
  }
}