import { CalendarClock, Files, Layers, OctagonX, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Stepper } from '@/components/features/job/Stepper'
import { JobStatusBadge, SdkMark } from '@/components/ui/domain'
import { ConfirmDialog } from '@/components/ui/Modal'
import { Button, ButtonLink, Card, EmptyState, Skeleton } from '@/components/ui/primitives'
import { FINISHED_JOB } from '@/constants/app'
import { useCancelJob, useDeleteJob, useJob, useRetryJob } from '@/hooks/queries'
import { formatDateTime, formatDuration, elapsed } from '@/lib/format'

const STEP_BY_PATH = { '': 'run', results: 'results', compare: 'compare', report: 'report' }

export function JobLayout() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: job, isLoading, isError, error } = useJob(id, { live: true })
  const cancel = useCancelJob()
  const retry = useRetryJob()
  const remove = useDeleteJob()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    )
  }
  if (isError || !job) {
    return (
      <EmptyState
        title={error?.status === 404 ? 'Extraction not found' : 'Could not load extraction'}
        description={error?.message}
        action={<ButtonLink to="/history" variant="secondary">Back to history</ButtonLink>}
      />
    )
  }

  const segment = location.pathname.split('/')[3] ?? ''
  const current = STEP_BY_PATH[segment] ?? 'run'
  const finished = FINISHED_JOB.has(job.status)
  const hasResults = (job.run_counts?.completed ?? 0) > 0
  const failedRuns = (job.run_counts?.failed ?? 0) + (job.run_counts?.cancelled ?? 0)
  const fileCount = job.files.filter((f) => !f.container).length
  const base = `/jobs/${id}`

  const act = (mutation, message) =>
    mutation.mutate(id, { onSuccess: () => toast.success(message), onError: (e) => toast.error(e.message) })

  return (
    <>
      <Card className="mb-6 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-xl font-semibold tracking-tight text-fg md:text-2xl">{job.name}</h1>
              <JobStatusBadge status={job.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-fg-3">
              <span className="inline-flex items-center gap-1.5"><Files className="size-4" /> {fileCount} file(s)</span>
              <span className="inline-flex items-center gap-1.5"><Layers className="size-4" /> {job.runs.length} runs</span>
              <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" /> {formatDateTime(job.created_at)}</span>
              {job.started_at ? <span>Duration {formatDuration(elapsed(job.started_at, job.finished_at))}</span> : null}
              <span className="flex -space-x-1.5">{job.sdks.map((sdk) => <SdkMark key={sdk} sdk={sdk} size="xs" className="ring-2 ring-surface" />)}</span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {!finished ? (
              <Button variant="secondary" icon={OctagonX} loading={cancel.isPending} onClick={() => act(cancel, 'Cancel requested')}>
                Cancel
              </Button>
            ) : null}
            {finished && failedRuns > 0 ? (
              <Button variant="secondary" icon={RotateCcw} loading={retry.isPending} onClick={() => act(retry, 'Retry queued')}>
                Retry failed ({failedRuns})
              </Button>
            ) : null}
            {finished ? (
              <Button variant="danger-ghost" icon={Trash2} onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            ) : null}
          </div>
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <Stepper
            current={current}
            links={{ run: base, results: `${base}/results`, compare: `${base}/compare`, report: `${base}/report` }}
            disabled={hasResults ? [] : ['results', 'compare', 'report']}
          />
        </div>
      </Card>

      <Outlet context={{ job }} />

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        danger
        title="Delete this extraction?"
        description="Uploaded files, every SDK output and the event log will be removed permanently."
        confirmLabel="Delete"
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(id, {
            onSuccess: () => {
              toast.success('Extraction deleted')
              navigate('/history', { replace: true })
            },
            onError: (e) => toast.error(e.message),
          })
        }
      />
    </>
  )
}
