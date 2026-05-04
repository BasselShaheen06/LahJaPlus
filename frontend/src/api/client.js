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

// Point 5: Sending raw audio files to backend for time-domain summation
export async function blendDialects(fileA, fileB, alpha) {
  const formData = new FormData()
  formData.append('file_a', fileA)
  formData.append('file_b', fileB)
  formData.append('alpha', alpha)

  const { data } = await api.post('/blend', formData)
  return data
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