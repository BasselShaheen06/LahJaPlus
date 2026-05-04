import { useState, useCallback } from 'react'
import { classifyAudio, transcribeAudio, translateText, synthesizeSpeech, blendDialects } from '../api/client'

export function useLahjaState() {
  const [state, setState] = useState({
    fileA: null, fileB: null,
    classifyResultA: null, classifyResultB: null, blendResult: null, alpha: 0.5,
    transcriptResult: null, translateResult: null, synthesisUrl: null,
    loadingA: false, loadingB: false, transcriptLoading: false, translateLoading: false, synthesisLoading: false,
    error: null,
  })

  const updateState = (updates) => setState((prev) => ({ ...prev, ...updates }))

  const handleLoadFileA = useCallback(async (fileData) => {
    updateState({ 
      fileA: fileData, classifyResultA: null, transcriptResult: null, translateResult: null, synthesisUrl: null, blendResult: null,
      loadingA: true, error: null 
    })
    try {
      // 1. Classify
      const result = await classifyAudio(fileData.file)
      updateState({ classifyResultA: result, loadingA: false, transcriptLoading: true })
      
      // 2. Transcribe (Point 3)
      const transcript = await transcribeAudio(fileData.file, result.dialect)
      updateState({ transcriptResult: transcript, transcriptLoading: false })

    } catch (err) {
      updateState({ error: 'Processing failed: ' + err.message, loadingA: false, transcriptLoading: false })
    }
  }, [])

  const handleLoadFileB = useCallback(async (fileData) => {
    updateState({ 
      fileB: fileData, classifyResultB: null, blendResult: null, 
      loadingB: true, error: null 
    })
    try {
      const result = await classifyAudio(fileData.file)
      updateState({ classifyResultB: result, loadingB: false })
    } catch (err) {
      updateState({ error: 'Failed to classify File B', loadingB: false })
    }
  }, [])

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

  const handleBlend = useCallback(async (newAlpha) => {
    updateState({ alpha: newAlpha })
    if (!state.fileA?.file || !state.fileB?.file) return

    try {
      const result = await blendDialects(state.fileA.file, state.fileB.file, newAlpha)
      updateState({ blendResult: result })
    } catch (err) {
      updateState({ error: 'Failed to blend files' })
    }
  }, [state.fileA, state.fileB])

  return { state, updateState, handleLoadFileA, handleLoadFileB, handleTranslate, handleSynthesize, handleBlend }
}