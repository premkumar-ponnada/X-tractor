import { motion } from 'motion/react'
import { BookOpen, Braces, CircleSlash, GitCompareArrows, XCircle } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { FileList } from '@/components/features/results/FileList'
import { OutputViewer } from '@/components/features/results/OutputViewer'
import { PageViewer } from '@/components/features/results/PageViewer'
import { RunMetrics } from '@/components/features/results/RunMetrics'
import { KindBadge, RunStatusBadge, SdkMark } from '@/components/ui/domain'
import { ButtonLink, Card, EmptyState, Segmented, Spinner } from '@/components/ui/primitives'
import { SDK_COLORS, SDK_NAMES, SDK_ORDER } from '@/constants/app'

export default function JobResultsPage() {
  const { job } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const files = job.files.filter((f) => !f.container && !f.error)

  const fileId = params.get('file') ?? files[0]?.id
  const fileRuns = useMemo(
    () => job.runs.filter((r) => r.file_id === fileId).sort((a, b) => SDK_ORDER.indexOf(a.sdk) - SDK_ORDER.indexOf(b.sdk)),
    [job.runs, fileId],
  )
  const preferredSdk = params.get('sdk')
  const run = fileRuns.find((r) => r.sdk === preferredSdk) ?? fileRuns.find((r) => r.status === 'completed') ?? fileRuns[0]
  const view = params.get('view') ?? 'pages'
  const page = Number(params.get('page') ?? 1)
  const file = files.find((f) => f.id === fileId)

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([key, value]) => (value == null ? next.delete(key) : next.set(key, String(value))))
    setParams(next, { replace: true })
  }

  useEffect(() => {
    if (!params.get('file') && files[0]) update({ file: files[0].id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files.length])

  if (!files.length) return <Card><EmptyState title="No extracted files" description="This job has no files that could be processed." /></Card>

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <div className="lg:sticky lg:top-6 lg:self-start">
        <FileList files={job.files} runs={job.runs} selectedId={fileId} onSelect={(id) => update({ file: id, page: 1 })} />
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <KindBadge kind={file?.kind} />
              <h2 className="truncate font-semibold text-fg">{file?.name}</h2>
            </div>
            <ButtonLink to={`/jobs/${job.id}/compare?file=${fileId}`} variant="secondary" size="sm" icon={GitCompareArrows}>
              Compare SDKs
            </ButtonLink>
          </div>
          <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1">
            {fileRuns.map((r) => {
              const active = r.id === run?.id
              return (
                <button
                  key={r.id}
                  onClick={() => update({ sdk: r.sdk })}
                  className="relative flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all"
                  style={active ? { borderColor: SDK_COLORS[r.sdk], background: `${SDK_COLORS[r.sdk]}14` } : undefined}
                >
                  <SdkMark sdk={r.sdk} size="xs" />
                  <span className={active ? 'text-fg' : 'text-fg-2'}>{SDK_NAMES[r.sdk]}</span>
                  {r.status === 'completed' ? (
                    <span className="font-mono text-[11px] text-fg-3">{r.metrics?.text_coverage_pct}%</span>
                  ) : r.status === 'running' ? (
                    <Spinner className="size-3.5" />
                  ) : r.status === 'failed' ? (
                    <XCircle className="size-3.5 text-danger" />
                  ) : r.status === 'unsupported' ? (
                    <CircleSlash className="size-3.5 text-fg-3" />
                  ) : null}
                  {active ? <motion.span layoutId="sdk-tab" className="absolute inset-x-3 -bottom-px h-0.5 rounded-full" style={{ background: SDK_COLORS[r.sdk] }} /> : null}
                </button>
              )
            })}
          </div>
        </Card>

        {!run ? null : run.status !== 'completed' ? (
          <Card>
            <EmptyState
              icon={run.status === 'failed' ? XCircle : CircleSlash}
              title={run.status === 'failed' ? `${SDK_NAMES[run.sdk]} failed on this file` : run.status === 'unsupported' ? 'Not supported' : 'Not finished yet'}
              description={run.error ?? 'Results appear here as soon as the run finishes.'}
              action={<RunStatusBadge status={run.status} />}
            />
          </Card>
        ) : (
          <motion.div key={run.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
            <RunMetrics run={run} />
            <Card className="p-4 md:p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <Segmented
                  value={view}
                  onChange={(v) => update({ view: v })}
                  options={[
                    { value: 'pages', label: 'Pages', icon: BookOpen, count: run.metrics?.pages },
                    { value: 'output', label: 'Output formats', icon: Braces, count: run.output_formats?.length },
                  ]}
                />
                <p className="text-xs text-fg-3">
                  {view === 'pages' ? 'Normalised page text (Markdown) — what an AI pipeline would receive.' : 'Native output exactly as the SDK produced it.'}
                </p>
              </div>
              {view === 'pages' ? (
                <PageViewer runId={run.id} page={page} onPageChange={(n) => update({ page: n })} />
              ) : (
                <OutputViewer run={run} format={params.get('format')} onFormatChange={(f) => update({ format: f })} />
              )}
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}
