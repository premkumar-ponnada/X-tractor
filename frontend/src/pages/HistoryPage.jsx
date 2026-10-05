import { ChevronLeft, ChevronRight, FileStack, Plus, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { JobStatusBadge, PageHeader, SdkMark } from '@/components/ui/domain'
import { Button, ButtonLink, Card, EmptyState, Input, Progress, Segmented, Skeleton } from '@/components/ui/primitives'
import { useJobs } from '@/hooks/queries'
import { elapsed, formatDateTime, formatDuration } from '@/lib/format'

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
]
const PAGE_SIZE = 15

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export default function HistoryPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const status = params.get('status') ?? ''
  const page = Number(params.get('page') ?? 1)
  const query = useDebounced(search)
  const { data, isLoading, isFetching } = useJobs({ page, page_size: PAGE_SIZE, status, search: query })

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (query) next.set('q', query)
    else next.delete('q')
    if (query !== (params.get('q') ?? '')) next.set('page', '1')
    setParams(next, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.set('page', '1')
    setParams(next, { replace: true })
  }
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE))

  return (
    <>
      <PageHeader eyebrow="History" title="All extractions" description="Every job you have run, newest first." actions={<ButtonLink to="/jobs/new" icon={Plus}>New extraction</ButtonLink>} />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center md:justify-between">
          <div className="md:w-80"><Input icon={Search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" /></div>
          <Segmented size="sm" options={STATUS_FILTERS} value={status} onChange={(v) => set('status', v)} />
        </div>
        {isLoading ? (
          <div className="space-y-2 p-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !data?.items.length ? (
          <EmptyState icon={FileStack} title="No extractions found" description={search || status ? 'Try a different search or filter.' : 'Run your first extraction to see it here.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2/60 text-left text-xs text-fg-3">
                <tr>{['Name', 'Status', 'Progress', 'Extractors', 'Files', 'Created', 'Duration'].map((h) => <th key={h} className="px-4 py-2.5 font-medium whitespace-nowrap">{h}</th>)}</tr>
              </thead>
              <tbody className={isFetching ? 'opacity-70 transition-opacity' : ''}>
                {data.items.map((job) => {
                  const counts = job.run_counts ?? {}
                  const total = Object.values(counts).reduce((a, b) => a + b, 0)
                  const done = total - (counts.queued ?? 0) - (counts.running ?? 0)
                  return (
                    <tr key={job.id} onClick={() => navigate(`/jobs/${job.id}`)} className="cursor-pointer border-t border-border transition-colors hover:bg-surface-2/60">
                      <td className="max-w-80 px-4 py-3"><p className="truncate font-medium text-fg">{job.name}</p></td>
                      <td className="px-4 py-3"><JobStatusBadge status={job.status} /></td>
                      <td className="w-40 px-4 py-3">
                        <Progress value={total ? (100 * done) / total : 0} size="sm" running={job.status === 'running'} tone={counts.failed ? 'warning' : 'primary'} />
                        <p className="mt-1 text-[11px] text-fg-3">{done}/{total} runs{counts.failed ? ` · ${counts.failed} failed` : ''}</p>
                      </td>
                      <td className="px-4 py-3"><span className="flex -space-x-1.5">{job.sdks.map((sdk) => <SdkMark key={sdk} sdk={sdk} size="xs" className="ring-2 ring-surface" />)}</span></td>
                      <td className="px-4 py-3 tabular-nums">{job.file_count}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-fg-2">{formatDateTime(job.created_at)}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-fg-2">{job.started_at ? formatDuration(elapsed(job.started_at, job.finished_at)) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-fg-3">
          <span>{data?.total ?? 0} extraction(s)</span>
          <div className="flex items-center gap-2">
            <Button size="icon" variant="secondary" disabled={page <= 1} onClick={() => set('page', String(page - 1))} aria-label="Previous page"><ChevronLeft className="size-4" /></Button>
            <span className="tabular-nums">{page} / {pages}</span>
            <Button size="icon" variant="secondary" disabled={page >= pages} onClick={() => set('page', String(page + 1))} aria-label="Next page"><ChevronRight className="size-4" /></Button>
          </div>
        </div>
      </Card>
    </>
  )
}
