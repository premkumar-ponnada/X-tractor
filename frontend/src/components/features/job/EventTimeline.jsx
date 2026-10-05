import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  CircleSlash,
  Cog,
  FileSearch,
  FileUp,
  Flag,
  Layers,
  Play,
  Radio,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { LiveDot, SdkMark } from '@/components/ui/domain'
import { Card, cn, Segmented } from '@/components/ui/primitives'
import { formatTime } from '@/lib/format'

function eventVisual(event) {
  const { type, level } = event
  if (type === 'run.completed') return { icon: CheckCircle2, tone: 'text-success bg-success-soft' }
  if (type === 'run.failed' || level === 'error') return { icon: XCircle, tone: 'text-danger bg-danger-soft' }
  if (type === 'run.unsupported') return { icon: CircleSlash, tone: 'text-fg-3 bg-surface-2' }
  if (level === 'warning') return { icon: AlertTriangle, tone: 'text-warning bg-warning-soft' }
  if (type === 'run.started') return { icon: Play, tone: 'text-primary bg-primary-soft' }
  if (type.startsWith('run.')) return { icon: Cog, tone: 'text-info bg-info-soft' }
  if (type.startsWith('container.')) return { icon: Archive, tone: 'text-warning bg-warning-soft' }
  if (type === 'file.received') return { icon: FileUp, tone: 'text-fg-2 bg-surface-2' }
  if (type === 'file.detected') return { icon: FileSearch, tone: 'text-fg-2 bg-surface-2' }
  if (type.startsWith('stage.')) return { icon: Layers, tone: 'text-primary bg-primary-soft' }
  if (type === 'job.completed') return { icon: Flag, tone: level === 'success' ? 'text-success bg-success-soft' : 'text-warning bg-warning-soft' }
  return { icon: Radio, tone: 'text-primary bg-primary-soft' }
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'runs', label: 'Runs' },
  { value: 'issues', label: 'Issues' },
]

export function EventTimeline({ events, state, startedAt }) {
  const [filter, setFilter] = useState('all')
  const [follow, setFollow] = useState(true)
  const scroller = useRef(null)

  const visible = useMemo(() => {
    if (filter === 'runs') return events.filter((e) => ['run.started', 'run.completed', 'run.failed'].includes(e.type))
    if (filter === 'issues') return events.filter((e) => e.level === 'warning' || e.level === 'error')
    return events
  }, [events, filter])

  // Instant scroll: a smooth scroll fires intermediate scroll events that would switch "follow" off.
  useEffect(() => {
    if (follow && scroller.current) scroller.current.scrollTop = scroller.current.scrollHeight
  }, [visible.length, follow])

  const origin = startedAt ? new Date(startedAt).getTime() : events[0] ? new Date(events[0].ts).getTime() : null
  const issues = events.filter((e) => e.level === 'warning' || e.level === 'error').length

  return (
    <Card className="flex h-full max-h-[calc(100vh-120px)] min-h-[420px] flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-fg">
            Event timeline
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg-2">
              <LiveDot active={state === 'live'} className="scale-75" />
              {state === 'live' ? 'Live' : state === 'ended' ? 'Finished' : state === 'error' ? 'Disconnected' : 'Connecting'}
            </span>
          </h3>
          <p className="text-xs text-fg-3">{events.length} events{issues ? ` · ${issues} issue(s)` : ''}</p>
        </div>
        <Segmented size="sm" options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 40)
        }}
        className="relative flex-1 overflow-y-auto px-5 py-4"
      >
        <ol className="relative">
          <span className="absolute top-2 bottom-2 left-[15px] w-px bg-border" aria-hidden />
          <AnimatePresence initial={false}>
            {visible.map((event) => {
              const { icon: Icon, tone } = eventVisual(event)
              const offset = origin ? (new Date(event.ts).getTime() - origin) / 1000 : null
              return (
                <motion.li
                  key={event.seq}
                  layout="position"
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className="relative flex gap-3 pb-4"
                >
                  <span className={cn('relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-surface', tone)}>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1 pt-1">
                    <p className="text-sm leading-snug text-fg">{event.message}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-fg-3">
                      <span className="font-mono">{formatTime(event.ts)}</span>
                      {offset != null && offset >= 0 ? <span className="font-mono">+{offset.toFixed(1)}s</span> : null}
                      <span className="rounded bg-surface-2 px-1.5 py-px font-mono">{event.type}</span>
                      {event.sdk ? <SdkMark sdk={event.sdk} size="xs" className="!size-4 !text-[7px]" /> : null}
                    </div>
                  </div>
                </motion.li>
              )
            })}
          </AnimatePresence>
          {state !== 'ended' && state !== 'error' ? (
            <li className="relative flex items-center gap-3">
              <span className="relative z-10 grid size-8 place-items-center rounded-full bg-surface-2 ring-4 ring-surface">
                <span className="size-2 animate-pulse rounded-full bg-primary" />
              </span>
              <span className="shimmer h-3 w-40 rounded" />
            </li>
          ) : null}
        </ol>
      </div>
      {!follow ? (
        <button
          onClick={() => setFollow(true)}
          className="mx-5 mb-4 rounded-xl border border-border bg-surface-2 py-1.5 text-xs font-medium text-fg-2 hover:text-fg"
        >
          Jump to latest
        </button>
      ) : null}
    </Card>
  )
}
