import { API_BASE, request, uploadWithProgress } from './client'

const qs = (params) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, value)
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const authApi = {
  login: (email, password) => request('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
}

export const systemApi = {
  health: () => request('/health'),
}

export const sdkApi = {
  list: () => request('/sdks'),
  get: (name) => request(`/sdks/${encodeURIComponent(name)}`),
}

export const statsApi = {
  overview: () => request('/stats/overview'),
  sdks: () => request('/stats/sdks'),
}

export const jobApi = {
  create: ({ files, sdks, ocr, tables, ocrLanguages, name }, onProgress) => {
    const form = new FormData()
    files.forEach((file) => form.append('files', file, file.name))
    form.append('sdks', sdks.join(','))
    form.append('ocr', String(ocr))
    form.append('tables', String(tables))
    form.append('ocr_languages', ocrLanguages)
    if (name) form.append('name', name)
    return uploadWithProgress('/jobs', form, onProgress)
  },
  list: (params) => request(`/jobs${qs(params)}`),
  get: (id) => request(`/jobs/${id}`),
  cancel: (id) => request(`/jobs/${id}/cancel`, { method: 'POST' }),
  retry: (id) => request(`/jobs/${id}/retry`, { method: 'POST' }),
  remove: (id) => request(`/jobs/${id}`, { method: 'DELETE' }),
  eventsUrl: (id) => `${API_BASE}/jobs/${id}/events`,
  history: (id) => request(`/jobs/${id}/events/history`),
  compare: (id, fileId) => request(`/jobs/${id}/compare${qs({ file_id: fileId })}`),
  report: (id) => request(`/jobs/${id}/report`),
}

export const runApi = {
  get: (id) => request(`/runs/${id}`),
  pages: (id, offset = 0, limit = 200) => request(`/runs/${id}/pages${qs({ offset, limit })}`),
  output: (id, format) => request(`/runs/${id}/output${qs({ format })}`),
  downloadUrl: (id, format) => `${API_BASE}/runs/${id}/download${qs({ format })}`,
}
