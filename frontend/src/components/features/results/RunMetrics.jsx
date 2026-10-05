import { AlertTriangle, BookOpenCheck, Clock3, FileStack, Gauge, Image, Languages, Table2, Type } from 'lucide-react'
import { useState } from 'react'
import { Badge, cn } from '@/components/ui/primitives'
import { formatDuration, formatNumber, formatPercent } from '@/lib/format'

function Metric({ icon: Icon, label, value, tone }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-surface px-3 py-2">
      <Icon className={cn('size-4 shrink-0', tone ?? 'text-fg-3')} />
      <div className="min-w-0">
        <p className="truncate text-[11px] text-fg-3">{label}</p>
        <p className="text-sm font-semibold text-fg tabular-nums">{value}</p>
      </div>
    </div>
  )
}

export function RunMetrics({ run }) {
  const [showWarnings, setShowWarnings] = useState(false)
  const m = run.metrics ?? {}
  const coverageTone = m.text_coverage_pct >= 90 ? 'text-success' : m.text_coverage_pct >= 50 ? 'text-warning' : 'text-danger'
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 2xl:grid-cols-8">
        <Metric icon={FileStack} label="Pages" value={formatNumber(m.pages)} />
        <Metric icon={BookOpenCheck} label="With text" value={formatPercent(m.text_coverage_pct)} tone={coverageTone} />
        <Metric icon={Type} label="Words" value={formatNumber(m.words)} />
        <Metric icon={Table2} label="Tables" value={formatNumber(m.tables)} />
        <Metric icon={Image} label="Images" value={formatNumber(m.images)} />
        <Metric icon={Languages} label="å ä ö found" value={formatNumber(m.swedish_chars)} tone={m.encoding_errors ? 'text-danger' : undefined} />
        <Metric icon={Clock3} label="Time" value={formatDuration(m.duration_ms)} />
        <Metric icon={Gauge} label="Pages / s" value={m.pages_per_second ?? '—'} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={m.page_fidelity ? 'success' : 'warning'}>{m.page_fidelity ? 'Page numbers kept' : 'No page boundaries'}</Badge>
        {m.empty_pages?.length ? <Badge tone="warning">Empty pages: {m.empty_pages.slice(0, 12).join(', ')}{m.empty_pages.length > 12 ? '…' : ''}</Badge> : null}
        {m.encoding_errors ? <Badge tone="danger">{m.encoding_errors} broken characters</Badge> : null}
        {run.sdk_version ? <Badge tone="neutral" className="font-mono">{run.sdk_version}</Badge> : null}
        {run.warnings?.length ? (
          <button onClick={() => setShowWarnings((v) => !v)} className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning">
            <AlertTriangle className="size-3" /> {run.warnings.length} warning(s) {showWarnings ? '▴' : '▾'}
          </button>
        ) : null}
      </div>
      {showWarnings ? (
        <ul className="space-y-1 rounded-xl border border-warning/30 bg-warning-soft/60 p-3 text-xs text-fg-2">
          {run.warnings.map((w) => <li key={w}>• {w}</li>)}
        </ul>
      ) : null}
    </div>
  )
}
