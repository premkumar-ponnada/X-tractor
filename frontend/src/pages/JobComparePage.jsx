import { ArrowLeftRight, Trophy } from 'lucide-react'
import { useMemo } from 'react'
import { useOutletContext, useSearchParams } from 'react-router-dom'
import { PageNavigator, usePages } from '@/components/features/results/PageViewer'
import { MarkdownView } from '@/components/features/results/RenderedContent'
import { KindIcon, ScorePill, SdkMark } from '@/components/ui/domain'
import { Button, Card, cn, Progress, Skeleton } from '@/components/ui/primitives'
import { SDK_COLORS, SDK_NAMES, SDK_ORDER } from '@/constants/app'
import { useCompare } from '@/hooks/queries'
import { formatDuration, formatNumber, formatPercent } from '@/lib/format'

const words = (text) => new Set((text ?? '').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])

function similarity(a, b) {
  const left = words(a)
  const right = words(b)
  if (!left.size && !right.size) return 100
  let shared = 0
  left.forEach((w) => right.has(w) && (shared += 1))
  return Math.round((100 * shared) / (left.size + right.size - shared))
}

function SdkPicker({ runs, value, onChange, exclude }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {runs.map((run) => (
        <button
          key={run.sdk}
          disabled={run.sdk === exclude}
          onClick={() => onChange(run.sdk)}
          className={cn(
            'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all disabled:opacity-30',
            value === run.sdk ? 'border-transparent text-white' : 'border-border text-fg-2 hover:border-border-strong',
          )}
          style={value === run.sdk ? { background: SDK_COLORS[run.sdk] } : undefined}
        >
          {SDK_NAMES[run.sdk]}
        </button>
      ))}
    </div>
  )
}

function Pane({ run, page, pages, loading }) {
  const current = pages.find((p) => p.n === page)
  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3" style={{ background: `${SDK_COLORS[run.sdk]}0d` }}>
        <span className="flex items-center gap-2 font-semibold text-fg">
          <SdkMark sdk={run.sdk} size="xs" /> {SDK_NAMES[run.sdk]}
        </span>
        <span className="font-mono text-[11px] text-fg-3">
          {pages.length} page(s) · {(current?.text ?? '').length.toLocaleString()} chars
        </span>
      </div>
      <div className="max-h-[65vh] min-h-64 overflow-y-auto p-5">
        {loading ? <Skeleton className="h-64" /> : current ? <MarkdownView content={current.text} /> : <p className="py-10 text-center text-sm text-fg-3">No page {page} in this output{pages.length === 1 ? ' — this SDK returned the whole file as one page' : ''}.</p>}
      </div>
    </Card>
  )
}

export default function JobComparePage() {
  const { job } = useOutletContext()
  const [params, setParams] = useSearchParams()
  const files = job.files.filter((f) => !f.container && !f.error)
  const fileId = params.get('file') ?? files[0]?.id
  const { data, isLoading } = useCompare(job.id, fileId)

  const completed = useMemo(
    () => (data?.runs ?? []).filter((r) => r.status === 'completed').sort((a, b) => SDK_ORDER.indexOf(a.sdk) - SDK_ORDER.indexOf(b.sdk)),
    [data],
  )
  const left = completed.find((r) => r.sdk === params.get('left')) ?? completed[0]
  const right = completed.find((r) => r.sdk === params.get('right') && r.sdk !== left?.sdk) ?? completed.find((r) => r.sdk !== left?.sdk)
  const page = Number(params.get('page') ?? 1)
  const leftPages = usePages(left?.id)
  const rightPages = usePages(right?.id)
  const maxPage = Math.max(leftPages.total, rightPages.total, 1)

  const update = (patch) => {
    const next = new URLSearchParams(params)
    Object.entries(patch).forEach(([k, v]) => next.set(k, String(v)))
    setParams(next, { replace: true })
  }
  const pageText = (pages) => pages.pages.find((p) => p.n === page)?.text
  const sim = left && right && !leftPages.isLoading && !rightPages.isLoading ? similarity(pageText(leftPages), pageText(rightPages)) : null
  const ranked = [...(data?.runs ?? [])].sort((a, b) => (b.score?.score ?? -1) - (a.score?.score ?? -1))

  return (
    <div className="space-y-5">
      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(220px,320px)_1fr_auto_1fr] lg:items-end">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fg-3">File</span>
            <select
              value={fileId}
              onChange={(e) => setParams({ file: e.target.value }, { replace: true })}
              className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg"
            >
              {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </label>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-fg-3">Left</span>
            <SdkPicker runs={completed} value={left?.sdk} onChange={(sdk) => update({ left: sdk })} exclude={right?.sdk} />
          </div>
          <Button variant="ghost" size="icon" onClick={() => left && right && update({ left: right.sdk, right: left.sdk })} aria-label="Swap sides">
            <ArrowLeftRight className="size-4" />
          </Button>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-fg-3">Right</span>
            <SdkPicker runs={completed} value={right?.sdk} onChange={(sdk) => update({ right: sdk })} exclude={left?.sdk} />
          </div>
        </div>
      </Card>

      {isLoading ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : completed.length < 2 ? (
        <Card className="p-10 text-center text-sm text-fg-3">At least two SDKs must finish this file to compare them.</Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <PageNavigator page={page} total={maxPage} onChange={(n) => update({ page: n })} />
            {sim != null ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-1.5 text-sm">
                <span className="text-fg-3">Word overlap on this page</span>
                <Progress value={sim} className="w-28" tone={sim > 80 ? 'success' : sim > 50 ? 'warning' : 'danger'} size="sm" />
                <span className="font-semibold text-fg tabular-nums">{sim}%</span>
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Pane run={left} page={page} pages={leftPages.pages} loading={leftPages.isLoading} />
            <Pane run={right} page={page} pages={rightPages.pages} loading={rightPages.isLoading} />
          </div>
        </>
      )}

      <Card className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
          <Trophy className="size-4 text-warning" />
          <h3 className="text-sm font-semibold text-fg">All extractors on this file</h3>
          <KindIcon kind={files.find((f) => f.id === fileId)?.kind} className="ml-auto" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2/60 text-left text-xs text-fg-3">
              <tr>{['Extractor', 'Score', 'Pages', 'With text', 'Words', 'Tables', 'Page numbers', 'Time'].map((h) => <th key={h} className="px-4 py-2.5 font-medium">{h}</th>)}</tr>
            </thead>
            <tbody>
              {ranked.map((run, index) => {
                const m = run.metrics ?? {}
                return (
                  <tr key={run.id} className="border-t border-border">
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2 font-medium text-fg">
                        <SdkMark sdk={run.sdk} size="xs" /> {SDK_NAMES[run.sdk]}
                        {index === 0 && run.score ? <Trophy className="size-3.5 text-warning" /> : null}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">{run.status === 'completed' ? <ScorePill score={run.score?.score} /> : <span className="text-xs text-fg-3">{run.status}</span>}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatNumber(m.pages)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatPercent(m.text_coverage_pct)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatNumber(m.words)}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatNumber(m.tables)}</td>
                    <td className="px-4 py-2.5">{m.page_fidelity == null ? '—' : m.page_fidelity ? 'Yes' : 'No'}</td>
                    <td className="px-4 py-2.5 tabular-nums">{formatDuration(m.duration_ms)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
