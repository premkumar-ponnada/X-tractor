import { ArrowLeft, CheckCircle2, ExternalLink, Gauge, MinusCircle, Package, Play, Wrench } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from 'recharts'
import { AvailabilityBadge, OverallRing } from '@/components/features/sdk/SdkCard'
import { CapabilityBar, KindBadge, SdkMark, StatCard } from '@/components/ui/domain'
import { Badge, ButtonLink, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/primitives'
import { formatDuration, formatNumber, formatPercent } from '@/lib/format'
import { useSdk, useSdkStats } from '@/hooks/queries'

function ListBlock({ title, items, icon: Icon, tone }) {
  return (
    <Card className="p-5">
      <h3 className="mb-3 text-sm font-semibold text-fg">{title}</h3>
      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-sm text-fg-2">
            <Icon className={`mt-0.5 size-4 shrink-0 ${tone}`} />
            {item}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function MeasuredStats({ stats, color }) {
  if (!stats || stats.runs === 0) {
    return (
      <Card>
        <EmptyState icon={Gauge} title="No measured runs yet" description="Run this extractor on your files to see real success rates and speed." />
      </Card>
    )
  }
  const kinds = Object.entries(stats.by_kind ?? {})
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Success rate" value={formatPercent(stats.success_rate)} hint={`${stats.completed} ok · ${stats.failed} failed`} />
        <StatCard label="Avg text coverage" value={formatPercent(stats.avg_coverage)} hint="Pages with real text" tone="success" />
        <StatCard label="Speed" value={stats.pages_per_second ? `${stats.pages_per_second}/s` : '—'} hint="Pages per second" tone="info" />
        <StatCard label="Avg run time" value={formatDuration(stats.avg_duration_ms)} hint={`${formatNumber(stats.pages)} pages total`} tone="warning" />
      </div>
      {kinds.length ? (
        <Card className="p-5">
          <h3 className="mb-4 text-sm font-semibold text-fg">Results by file type</h3>
          <div className="space-y-3">
            {kinds.map(([kind, counts]) => {
              const total = counts.completed + counts.failed
              return (
                <div key={kind} className="flex items-center gap-4">
                  <div className="w-24"><KindBadge kind={kind} /></div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-danger-soft">
                    <div className="h-full rounded-full" style={{ width: `${(100 * counts.completed) / total}%`, background: color }} />
                  </div>
                  <span className="w-20 text-right text-xs text-fg-2 tabular-nums">{counts.completed}/{total} ok</span>
                </div>
              )
            })}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

export default function ExtractorDetailPage() {
  const { sdk: name } = useParams()
  const { data: sdk, isLoading, isError } = useSdk(name)
  const { data: stats } = useSdkStats()

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />
  if (isError || !sdk) return <EmptyState title="Extractor not found" action={<ButtonLink to="/extractors" variant="secondary">Back to extractors</ButtonLink>} />

  const radar = sdk.capabilities.map((c) => ({ subject: c.label, value: c.value }))
  const measured = stats?.find((s) => s.sdk === sdk.name)

  return (
    <>
      <Link to="/extractors" className="mb-5 inline-flex items-center gap-1.5 text-sm text-fg-3 hover:text-fg">
        <ArrowLeft className="size-4" /> All extractors
      </Link>

      <Card className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.07]" style={{ background: `radial-gradient(circle at 85% 0%, ${sdk.color}, transparent 60%)` }} />
        <div className="relative flex flex-col gap-6 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <SdkMark sdk={sdk.name} color={sdk.color} name={sdk.display_name} size="lg" />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-fg">{sdk.display_name}</h1>
                <AvailabilityBadge sdk={sdk} />
              </div>
              <p className="mt-0.5 text-sm text-fg-3">{sdk.vendor} · {sdk.license} · {sdk.runtime}</p>
              <p className="mt-3 max-w-2xl text-sm text-fg-2">{sdk.description}</p>
              {!sdk.available || sdk.availability_note !== 'Ready' ? <p className="mt-2 text-xs text-warning">{sdk.availability_note}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-fg-3">Overall rating</p>
              <p className="text-xs text-fg-3">{sdk.best_for}</p>
            </div>
            <OverallRing value={sdk.overall} color={sdk.color} size={76} />
          </div>
        </div>
        <div className="relative flex flex-wrap gap-2 border-t border-border px-6 py-3">
          <ButtonLink to="/jobs/new" size="sm" icon={Play}>Run on my files</ButtonLink>
          <a href={sdk.homepage} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-fg-2 hover:bg-surface-2">
            Documentation <ExternalLink className="size-3.5" />
          </a>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader title="Capability profile" subtitle={sdk.capability_source} />
          <div className="grid gap-6 p-5 md:grid-cols-2">
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radar} outerRadius="72%">
                  <PolarGrid stroke="var(--border)" />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: 'var(--text-3)', fontSize: 10 }} />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke={sdk.color} fill={sdk.color} fillOpacity={0.22} strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3.5">
              {sdk.capabilities.map((c) => <CapabilityBar key={c.key} label={c.label} value={c.value} color={sdk.color} />)}
            </div>
          </div>
        </Card>
        <div className="grid gap-6">
          <ListBlock title="Strengths" items={sdk.strengths} icon={CheckCircle2} tone="text-success" />
          <ListBlock title="Limitations" items={sdk.limitations} icon={MinusCircle} tone="text-warning" />
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><Package className="size-4 text-primary" /> Output modes</h3>
          <div className="flex flex-wrap gap-2">
            {sdk.output_formats.map((f) => <Badge key={f.id} tone="primary" className="font-mono">{f.label}</Badge>)}
          </div>
          <h3 className="mt-5 mb-3 flex items-center gap-2 text-sm font-semibold text-fg"><Wrench className="size-4 text-primary" /> Requires</h3>
          {sdk.requires.length ? (
            <ul className="space-y-1.5 text-sm text-fg-2">{sdk.requires.map((r) => <li key={r}>• {r}</li>)}</ul>
          ) : (
            <p className="text-sm text-fg-3">Nothing beyond Python.</p>
          )}
        </Card>
        <Card className="p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-fg">Supported file types ({sdk.supported_kinds.length})</h3>
          <div className="flex flex-wrap gap-2">{sdk.supported_kinds.map((kind) => <KindBadge key={kind} kind={kind} />)}</div>
        </Card>
      </div>

      <h2 className="mt-10 mb-4 text-lg font-semibold text-fg">Measured on your files</h2>
      <MeasuredStats stats={measured} color={sdk.color} />
    </>
  )
}
