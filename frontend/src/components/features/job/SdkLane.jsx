import { motion } from 'motion/react'
import { CheckCircle2, CircleSlash, Clock3, Loader2, XCircle } from 'lucide-react'
import { Link } from 'react-router-dom'
import { KindIcon, SdkMark } from '@/components/ui/domain'
import { Card, cn, Progress } from '@/components/ui/primitives'
import { SDK_COLORS, SDK_NAMES } from '@/constants/app'
import { formatDuration, formatPercent } from '@/lib/format'

const STATUS_ICON = {
  queued: { icon: Clock3, tone: 'text-fg-3' },
  running: { icon: Loader2, tone: 'text-primary animate-spin' },
  completed: { icon: CheckCircle2, tone: 'text-success' },
  failed: { icon: XCircle, tone: 'text-danger' },
  unsupported: { icon: CircleSlash, tone: 'text-fg-3' },
  cancelled: { icon: CircleSlash, tone: 'text-fg-3' },
}

export function SdkLane({ sdk, runs, jobId, index, origins = {} }) {
  const color = SDK_COLORS[sdk]
  const done = runs.filter((r) => ['completed', 'failed', 'unsupported', 'cancelled'].includes(r.status)).length
  const running = runs.some((r) => r.status === 'running')
  const failed = runs.filter((r) => r.status === 'failed').length
  const pct = runs.length ? (100 * done) / runs.length : 0

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
      <Card className={cn('overflow-hidden transition-shadow', running && 'shadow-pop ring-1 ring-primary/20')}>
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <div className={cn('rounded-xl', running && 'animate-pulse-ring')}>
            <SdkMark sdk={sdk} size="sm" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-fg">{SDK_NAMES[sdk]}</p>
              <p className="text-xs text-fg-3 tabular-nums">
                {done}/{runs.length}
                {failed ? <span className="ml-1.5 text-danger">{failed} failed</span> : null}
              </p>
            </div>
            <Progress value={pct} color={color} running={running} size="sm" className="mt-2" />
          </div>
        </div>
        <ul className="border-t border-border">
          {runs.map((run) => {
            const visual = STATUS_ICON[run.status] ?? STATUS_ICON.queued
            const Icon = visual.icon
            const m = run.metrics ?? {}
            const row = (
              <div className={cn('flex items-center gap-3 px-4 py-2 text-sm', run.status === 'running' && 'shimmer')}>
                <Icon className={cn('size-4 shrink-0', visual.tone)} />
                <KindIcon kind={run.file_kind} />
                <span className="min-w-0 flex-1 truncate" title={run.error || run.file_name}>
                  <span className={run.status === 'unsupported' ? 'text-fg-3' : 'text-fg'}>{run.file_name}</span>
                  {origins[run.file_id] ? <span className="ml-1.5 text-[11px] text-fg-3">from {origins[run.file_id]}</span> : null}
                </span>
                {run.status === 'completed' ? (
                  <span className="shrink-0 font-mono text-[11px] text-fg-3">
                    {m.pages}p · {formatPercent(m.text_coverage_pct)} · {formatDuration(m.duration_ms)}
                  </span>
                ) : run.status === 'failed' ? (
                  <span className="max-w-[45%] shrink truncate text-[11px] text-danger" title={run.error}>{run.error}</span>
                ) : run.status === 'running' ? (
                  <span className="shrink-0 text-[11px] font-medium text-primary">extracting…</span>
                ) : run.status === 'unsupported' ? (
                  <span className="shrink-0 text-[11px] text-fg-3">not supported</span>
                ) : null}
              </div>
            )
            return (
              <li key={run.id} className="border-b border-border last:border-0">
                {run.status === 'completed' ? (
                  <Link to={`/jobs/${jobId}/results?file=${run.file_id}&sdk=${sdk}`} className="block transition-colors hover:bg-surface-2">
                    {row}
                  </Link>
                ) : (
                  row
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </motion.div>
  )
}
