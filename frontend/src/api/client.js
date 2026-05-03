/**
 * api/client.js — API client for all backend endpoints
 *
 * All requests go through /api prefix (Vite proxy strips it and forwards to FastAPI).
 */

import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API error:', error.response?.data || error.message)
    return Promise.reject(error)
  }
)

/**
 * POST /classify — Upload audio, get dialect classification
 */
export async function classifyAudio(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/classify', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data
}

/**
 * POST /transcribe — Upload audio + dialect, get word-level transcript
 */
export async function transcribeAudio(file, dialect) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('dialect', dialect)
  const { data } = await api.post('/transcribe', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 60000,
  })
  return data
}

/**
 * POST /translate — Dialect text → MSA → target dialect
 */
export async function translateText(text, sourceDialect, targetDialect) {
  const { data } = await api.post('/translate', {
    text,
    source_dialect: sourceDialect,
    target_dialect: targetDialect,
  })
  return data
}

/**
 * POST /synthesize — Text + voice ref → synthesized audio
 */
export async function synthesizeSpeech(text, targetDialect, voiceRefFile) {
  const formData = new FormData()
  formData.append('text', text)
  formData.append('target_dialect', targetDialect)
  formData.append('voice_ref', voiceRefFile)

  const response = await api.post('/synthesize', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
    timeout: 60000,
  })

  // Check if response is JSON (error) or audio blob
  if (response.headers['content-type']?.includes('application/json')) {
    const text = await response.data.text()
    const json = JSON.parse(text)
    if (json.error) throw new Error(json.message || json.error)
    return null
  }

  return URL.createObjectURL(response.data)
}

/**
 * POST /blend — Interpolate two I-vectors
 */
export async function blendDialects(ivectorA, ivectorB, alpha) {
  const { data } = await api.post('/blend', {
    ivector_a: ivectorA,
    ivector_b: ivectorB,
    alpha,
  })
  return data
}

export default api
