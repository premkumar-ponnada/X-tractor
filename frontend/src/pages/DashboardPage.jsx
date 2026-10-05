import { motion } from 'motion/react'
import { Activity, ArrowRight, Boxes, CheckCircle2, FileStack, Plus, Server, Upload, Workflow } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { JobStatusBadge, PageHeader, SdkMark, StatCard } from '@/components/ui/domain'
import { ButtonLink, Card, CardHeader, EmptyState, Skeleton } from '@/components/ui/primitives'
import { formatNumber, formatPercent, timeAgo } from '@/lib/format'
import { useAuth } from '@/context/AuthContext'
import { useOverview } from '@/hooks/queries'

const STEPS = [
  { icon: Upload, title: 'Upload', text: 'Drop PDFs, Office files, emails or a whole zip package.' },
  { icon: Boxes, title: 'Pick extractors', text: 'Choose any of the five SDKs and OCR options.' },
  { icon: Workflow, title: 'Watch it run', text: 'Every step streams live into a timeline.' },
  { icon: CheckCircle2, title: 'Compare', text: 'Page-by-page output, scores and a winner per file.' },
]

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="font-semibold text-fg">{row.display_name}</p>
      <p className="text-fg-2">Success: {formatPercent(row.success_rate)}</p>
      <p className="text-fg-2">Avg coverage: {formatPercent(row.avg_coverage)}</p>
      <p className="text-fg-2">Pages: {formatNumber(row.pages)}</p>
    </div>
  )
}

function SdkLeaderboard({ sdks, loading }) {
  const data = (sdks ?? []).filter((s) => s.runs > 0).map((s) => ({ ...s, value: s.avg_coverage ?? 0 }))
  return (
    <Card className="lg:col-span-2">
      <CardHeader icon={Activity} title="Text coverage by extractor" subtitle="Measured across all your runs — % of pages with real text" />
      <div className="h-72 px-3 pt-4 pb-3">
        {loading ? (
          <Skeleton className="h-full" />
        ) : data.length === 0 ? (
          <EmptyState title="No runs yet" description="Results appear here after your first extraction." />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="display_name" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} unit="%" />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--surface-2)' }} />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={56}>
                {data.map((row) => (
                  <Cell key={row.sdk} fill={row.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  )
}

function RecentJobs({ jobs, loading }) {
  return (
    <Card>
      <CardHeader title="Recent extractions" actions={<Link to="/history" className="text-sm font-medium text-primary hover:underline">View all</Link>} />
      <div className="p-2 pt-3">
        {loading ? (
          <div className="space-y-2 p-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
        ) : !jobs?.length ? (
          <EmptyState icon={FileStack} title="No extractions yet" description="Upload your first files to compare extractors." />
        ) : (
          <ul>
            {jobs.map((job, index) => (
              <motion.li key={job.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
                <Link to={`/jobs/${job.id}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{job.name}</p>
                    <p className="text-xs text-fg-3">
                      {job.file_count} file(s) · {timeAgo(job.created_at)}
                    </p>
                  </div>
                  <div className="hidden -space-x-1.5 sm:flex">
                    {job.sdks.map((sdk) => <SdkMark key={sdk} sdk={sdk} size="xs" className="ring-2 ring-surface" />)}
                  </div>
                  <JobStatusBadge status={job.status} />
                </Link>
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const { data, isLoading } = useOverview()

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title={`Good to see you, ${user?.name ?? ''}`}
        description="Test document extraction SDKs on real files and find the best one per format."
        actions={
          <ButtonLink to="/jobs/new" size="lg" icon={Plus}>
            New extraction
          </ButtonLink>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Extractions" value={formatNumber(data?.jobs ?? 0)} hint={`${data?.jobs_by_status?.running ?? 0} running now`} icon={FileStack} loading={isLoading} />
        <StatCard label="Pages extracted" value={formatNumber(data?.pages ?? 0)} hint={`${formatNumber(data?.runs ?? 0)} SDK runs`} icon={Activity} tone="info" loading={isLoading} />
        <StatCard label="Run success rate" value={formatPercent(data?.success_rate)} hint="Completed vs failed runs" icon={CheckCircle2} tone="success" loading={isLoading} />
        <StatCard label="Workers online" value={data?.workers_online ?? 0} hint="Extraction processes ready" icon={Server} tone="warning" loading={isLoading} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <SdkLeaderboard sdks={data?.sdks} loading={isLoading} />
        <RecentJobs jobs={data?.recent_jobs} loading={isLoading} />
      </div>

      <Card className="mt-6 overflow-hidden">
        <div className="grid gap-px bg-border md:grid-cols-4">
          {STEPS.map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className="grid size-8 place-items-center rounded-lg bg-primary-soft text-primary">
                  <Icon className="size-4" />
                </span>
                <span className="text-xs font-semibold text-fg-3">STEP {index + 1}</span>
              </div>
              <p className="mt-3 font-semibold text-fg">{title}</p>
              <p className="mt-1 text-sm text-fg-2">{text}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between gap-4 border-t border-border bg-surface-2/50 px-5 py-3.5">
          <p className="text-sm text-fg-2">Ready to test? Start with a real tender package — zips are unpacked automatically.</p>
          <Link to="/jobs/new" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            Start <ArrowRight className="size-4" />
          </Link>
        </div>
      </Card>
    </>
  )
}
