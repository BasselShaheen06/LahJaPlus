import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 60000,
})

export async function classifyAudio(file) {
  const formData = new FormData()
  formData.append('file', file)
  const { data } = await api.post('/classify', formData)
  return data
}

// Point 5: Send raw audio files for time-domain blend; decode returned base64 WAV into a playable URL
export async function blendDialects(fileA, fileB, alpha) {
  const formData = new FormData()
  formData.append('file_a', fileA)
  formData.append('file_b', fileB)
  formData.append('alpha', alpha.toString())

  const { data } = await api.post('/blend', formData)

  // Convert base64-encoded WAV to an object URL the browser can play
  let blendedAudioUrl = null
  if (data.blended_audio_b64) {
    const binary = atob(data.blended_audio_b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    const blob = new Blob([bytes], { type: 'audio/wav' })
    blendedAudioUrl = URL.createObjectURL(blob)
  }

  return { ...data, blendedAudioUrl }
}

// Point 3
export async function transcribeAudio(file, dialect) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('dialect', dialect)
  const { data } = await api.post('/transcribe', formData)
  return data
}

// Point 4
export async function translateText(text, sourceDialect, targetDialect) {
  const { data } = await api.post('/translate', {
    text,
    source_dialect: sourceDialect,
    target_dialect: targetDialect,
  })
  return data
}

// Point 4
export async function synthesizeSpeech(text, targetDialect, voiceRefFile) {
  const formData = new FormData()
  formData.append('text', text)
  formData.append('target_dialect', targetDialect)
  formData.append('voice_ref', voiceRefFile)

  const response = await api.post('/synthesize', formData, {
    responseType: 'blob'
  })

  // Check if response is JSON (error) or audio blob
  if (response.headers['content-type']?.includes('application/json')) {
    const textData = await response.data.text()
    const json = JSON.parse(textData)
    if (json.error) throw new Error(json.message || json.error)
    return null
  }

  return URL.createObjectURL(response.data)
}

export default api