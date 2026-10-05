// Small display helpers used across pages.

export function formatBytes(bytes) {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`
}

export function formatDuration(ms) {
  if (ms == null) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  const seconds = ms / 1000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

export function formatNumber(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en', { notation: value >= 100000 ? 'compact' : 'standard' }).format(value)
}

export function formatPercent(value, digits = 0) {
  if (value == null) return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso))
}

export function formatTime(iso) {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(iso))
}

export function timeAgo(iso) {
  if (!iso) return '—'
  const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  return days < 30 ? `${days} d ago` : formatDateTime(iso)
}

export function elapsed(fromIso, toIso) {
  if (!fromIso) return null
  return new Date(toIso || Date.now()).getTime() - new Date(fromIso).getTime()
}
