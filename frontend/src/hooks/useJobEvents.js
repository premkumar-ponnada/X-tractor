import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { jobApi } from '@/lib/api/endpoints'
import { keys } from './queries'

// Streams a job's events over SSE. EventSource reconnects by itself and resends
// Last-Event-ID, so no event is lost; duplicates are dropped by sequence number.
// Job queries are refreshed whenever an event changes run or job state.
const REFRESH_TYPES = /^(run\.(started|completed|failed|unsupported)|job\.|stage\.planned|container\.)/
const EMPTY = { events: [], state: 'connecting' }

export function useJobEvents(jobId) {
  const queryClient = useQueryClient()
  // State is tagged with the job it belongs to, so switching jobs needs no reset effect.
  const [store, setStore] = useState({ jobId, ...EMPTY })
  const refreshTimer = useRef(null)

  useEffect(() => {
    if (!jobId) return undefined
    const seen = new Set()
    const update = (fn) => setStore((prev) => fn(prev.jobId === jobId ? prev : { jobId, ...EMPTY }))

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => queryClient.invalidateQueries({ queryKey: keys.job(jobId) }), 250)
    }

    const source = new EventSource(jobApi.eventsUrl(jobId), { withCredentials: true })
    source.onopen = () => update((prev) => ({ ...prev, state: 'live' }))
    source.addEventListener('job_event', (message) => {
      const event = JSON.parse(message.data)
      if (seen.has(event.seq)) return
      seen.add(event.seq)
      update((prev) => ({ ...prev, events: [...prev.events, event] }))
      if (REFRESH_TYPES.test(event.type)) scheduleRefresh()
    })
    source.addEventListener('end', () => {
      update((prev) => ({ ...prev, state: 'ended' }))
      source.close()
      queryClient.invalidateQueries({ queryKey: keys.job(jobId) })
      queryClient.invalidateQueries({ queryKey: keys.report(jobId) })
      queryClient.invalidateQueries({ queryKey: ['jobs'] })
    })
    source.onerror = () => {
      const next = source.readyState === EventSource.CLOSED ? 'error' : 'connecting'
      update((prev) => ({ ...prev, state: next }))
    }
    return () => {
      clearTimeout(refreshTimer.current)
      source.close()
    }
  }, [jobId, queryClient])

  return store.jobId === jobId ? { events: store.events, state: store.state } : EMPTY
}
