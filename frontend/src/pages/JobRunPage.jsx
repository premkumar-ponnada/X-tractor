import { motion } from 'motion/react'
import { ArrowRight, Boxes, Timer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { EventTimeline } from '@/components/features/job/EventTimeline'
import { SdkLane } from '@/components/features/job/SdkLane'
import { KindBadge } from '@/components/ui/domain'
import { ButtonLink, Card, Progress } from '@/components/ui/primitives'
import { FINISHED_JOB, SDK_ORDER } from '@/constants/app'
import { useJobEvents } from '@/hooks/useJobEvents'
import { elapsed, formatDuration } from '@/lib/format'

function useTicker(active) {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return undefined
    const timer = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(timer)
  }, [active])
}

function Counter({ label, value, tone }) {
  return (
    <div className="rounded-xl border border-border bg-surface-2/50 px-3.5 py-2.5">
      <p className="text-[11px] font-medium tracking-wide text-fg-3 uppercase">{label}</p>
      <motion.p key={value} initial={{ opacity: 0.4, y: -3 }} animate={{ opacity: 1, y: 0 }} className={`text-xl font-semibold tabular-nums ${tone}`}>
        {value}
      </motion.p>
    </div>
  )
}

function OverallProgress({ job }) {
  const finished = FINISHED_JOB.has(job.status)
  useTicker(!finished)
  const counts = job.run_counts ?? {}
  const total = job.runs.length
  const done = (counts.completed ?? 0) + (counts.failed ?? 0) + (counts.unsupported ?? 0) + (counts.cancelled ?? 0)
  const pct = total ? Math.round((100 * done) / total) : 0
  const preparing = job.status === 'running' && total === 0

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-5 md:flex-row md:items-center">
        <div className="md:w-64">
          <p className="text-sm text-fg-3">{job.status === 'queued' ? 'Waiting for a worker' : preparing ? 'Preparing files' : finished ? 'Finished' : 'Extracting'}</p>
          <p className="mt-0.5 text-4xl font-semibold tracking-tight text-fg tabular-nums">{preparing || job.status === 'queued' ? '—' : `${pct}%`}</p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-fg-3">
            <Timer className="size-3.5" /> {job.started_at ? formatDuration(elapsed(job.started_at, job.finished_at)) : 'not started'}
          </p>
        </div>
        <div className="flex-1 space-y-4">
          <Progress value={preparing || job.status === 'queued' ? 8 : pct} running={!finished} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Counter label="Done" value={counts.completed ?? 0} tone="text-success" />
            <Counter label="Running" value={counts.running ?? 0} tone="text-primary" />
            <Counter label="Queued" value={counts.queued ?? 0} tone="text-fg" />
            <Counter label="Failed" value={counts.failed ?? 0} tone="text-danger" />
            <Counter label="Skipped" value={counts.unsupported ?? 0} tone="text-fg-3" />
          </div>
        </div>
      </div>
    </Card>
  )
}

function FilesStrip({ files }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((file) => (
        <span key={file.id} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-fg-2" title={file.error || file.mime || ''}>
          <KindBadge kind={file.kind} />
          <span className="max-w-48 truncate">{file.name}</span>
          {file.container ? <span className="text-warning">unpacked</span> : null}
          {file.error ? <span className="text-danger">error</span> : null}
        </span>
      ))}
    </div>
  )
}

export default function JobRunPage() {
  const { job } = useOutletContext()
  const { events, state } = useJobEvents(job.id)
  const bySdk = useMemo(() => {
    const groups = {}
    job.runs.forEach((run) => {
      groups[run.sdk] = groups[run.sdk] ?? []
      groups[run.sdk].push(run)
    })
    return SDK_ORDER.filter((sdk) => groups[sdk]).map((sdk) => [sdk, groups[sdk]])
  }, [job.runs])
  const finished = FINISHED_JOB.has(job.status)
  const origins = useMemo(() => {
    const names = Object.fromEntries(job.files.filter((f) => f.container).map((f) => [f.id, f.name]))
    return Object.fromEntries(job.files.filter((f) => f.parent_id).map((f) => [f.id, names[f.parent_id]]))
  }, [job.files])

  return (
    <div className="space-y-6">
      <OverallProgress job={job} />
      {finished && (job.run_counts?.completed ?? 0) > 0 ? (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-success/30 bg-success-soft px-5 py-4 sm:flex-row sm:items-center">
          <p className="text-sm font-medium text-success">Extraction finished — outputs are ready to inspect and compare.</p>
          <div className="flex gap-2">
            <ButtonLink to={`/jobs/${job.id}/results`} size="sm" iconRight={ArrowRight}>Open results</ButtonLink>
            <ButtonLink to={`/jobs/${job.id}/report`} size="sm" variant="secondary">View report</ButtonLink>
          </div>
        </motion.div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-4">
          <FilesStrip files={job.files} />
          {bySdk.length ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {bySdk.map(([sdk, runs], index) => <SdkLane key={sdk} sdk={sdk} runs={runs} jobId={job.id} index={index} origins={origins} />)}
            </div>
          ) : (
            <Card className="grid place-items-center p-12 text-center">
              <Boxes className="mb-3 size-8 animate-pulse text-primary" />
              <p className="font-medium text-fg">Detecting file types and planning runs…</p>
              <p className="mt-1 text-sm text-fg-3">Each SDK gets a lane here as soon as the worker has planned the job.</p>
            </Card>
          )}
        </div>
        <div className="xl:sticky xl:top-6 xl:self-start">
          <EventTimeline events={events} state={state} startedAt={job.created_at} />
        </div>
      </div>
    </div>
  )
}
