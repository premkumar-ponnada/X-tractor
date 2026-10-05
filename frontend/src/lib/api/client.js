// Thin fetch wrapper: same-origin /api, cookie session, one error type for the whole app.

export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') + '/api'

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

// Fired on any 401 so the auth layer can send the user back to /login.
export const UNAUTHORIZED_EVENT = 'xt:unauthorized'

async function parseError(response) {
  try {
    const body = await response.json()
    const error = body?.error ?? {}
    return new ApiError(response.status, error.code ?? 'http_error', error.message ?? response.statusText, error.details)
  } catch {
    return new ApiError(response.status, 'http_error', response.statusText || 'Request failed')
  }
}

export async function request(path, { method = 'GET', body, form, signal, raw = false } = {}) {
  const init = { method, credentials: 'include', signal, headers: {} }
  if (form) {
    init.body = form
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, init)
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new ApiError(0, 'network_error', 'Cannot reach the X-tractor API. Is the backend running?')
  }

  if (!response.ok) {
    const error = await parseError(response)
    if (response.status === 401 && !path.startsWith('/auth/login')) {
      window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
    }
    throw error
  }
  if (raw) return response
  if (response.status === 204) return null
  return response.json()
}

// Upload with real progress events (fetch has no upload progress).
export function uploadWithProgress(path, form, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}${path}`)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      let body = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        body = null
      }
      if (xhr.status >= 200 && xhr.status < 300) return resolve(body)
      if (xhr.status === 401) window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT))
      const error = body?.error ?? {}
      reject(new ApiError(xhr.status, error.code ?? 'http_error', error.message ?? 'Upload failed', error.details))
    }
    xhr.onerror = () => reject(new ApiError(0, 'network_error', 'Upload failed — check your connection'))
    xhr.send(form)
  })
}
