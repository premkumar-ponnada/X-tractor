import { ChevronLeft, ChevronRight, Code2, Eye } from 'lucide-react'
import { useState } from 'react'
import { Button, cn, Segmented, Skeleton } from '@/components/ui/primitives'
import { useRunPages } from '@/hooks/queries'
import { CodeView } from './CodeView'
import { MarkdownView } from './RenderedContent'

export function PageNavigator({ page, total, onChange }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button size="icon" variant="secondary" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </Button>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          const value = new FormData(e.currentTarget).get('page')
          onChange(Math.min(Math.max(1, Number(value) || 1), total))
        }}
        className="flex items-center gap-1.5 text-sm text-fg-2"
      >
        Page
        <input key={page} name="page" defaultValue={page} className="h-8 w-12 rounded-lg border border-border bg-surface text-center text-sm text-fg tabular-nums" aria-label="Page number" />
        of {total}
      </form>
      <Button size="icon" variant="secondary" disabled={page >= total} onClick={() => onChange(page + 1)} aria-label="Next page">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

export function usePages(runId) {
  const { data, isLoading } = useRunPages(runId)
  return { pages: data?.items ?? [], total: data?.total ?? 0, isLoading }
}

export function PageViewer({ runId, page, onPageChange }) {
  const { pages, total, isLoading } = usePages(runId)
  const [mode, setMode] = useState('rendered')
  const current = pages.find((p) => p.n === page) ?? pages[0]

  if (isLoading) return <Skeleton className="h-96 rounded-xl" />
  if (!pages.length) return <p className="py-10 text-center text-sm text-fg-3">No pages were extracted.</p>

  return (
    <div className="grid gap-4 lg:grid-cols-[180px_1fr]">
      <ol className="hidden max-h-[70vh] space-y-1 overflow-y-auto pr-1 lg:block">
        {pages.map((p) => {
          const empty = (p.text ?? '').trim().length < 25
          return (
            <li key={p.n}>
              <button
                onClick={() => onPageChange(p.n)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors',
                  current?.n === p.n ? 'bg-primary-soft font-semibold text-primary-text' : 'text-fg-2 hover:bg-surface-2',
                )}
              >
                <span>Page {p.n}</span>
                <span className="flex items-center gap-1">
                  {p.tables ? <span className="rounded bg-surface-3 px-1 text-[10px] text-fg-3">{p.tables}T</span> : null}
                  <span className={cn('size-1.5 rounded-full', empty ? 'bg-warning' : 'bg-success')} />
                </span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <PageNavigator page={current?.n ?? 1} total={Math.max(total, pages.at(-1)?.n ?? 1)} onChange={onPageChange} />
          <Segmented
            size="sm"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'rendered', label: 'Rendered', icon: Eye },
              { value: 'source', label: 'Source', icon: Code2 },
            ]}
          />
        </div>
        <div className="rounded-xl border border-border bg-surface p-5">
          {mode === 'rendered' ? <MarkdownView content={current?.text} /> : <CodeView content={current?.text} className="-m-5 rounded-none border-0" />}
        </div>
        <p className="mt-2 text-xs text-fg-3">
          {(current?.text ?? '').length.toLocaleString()} characters · {current?.tables ?? 0} table(s) · {current?.images ?? 0} image(s) on this page
        </p>
      </div>
    </div>
  )
}
