import { motion } from 'motion/react'
import { Crown, Info, Medal } from 'lucide-react'
import { Link, useOutletContext } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { KindIcon, SdkMark } from '@/components/ui/domain'
import { Card, CardHeader, Skeleton } from '@/components/ui/primitives'
import { SDK_NAMES } from '@/constants/app'
import { useReport } from '@/hooks/queries'
import { formatDuration, formatNumber, formatPercent } from '@/lib/format'

function heat(score) {
  if (score == null) return 'var(--surface-2)'
  const hue = Math.round((Math.max(0, Math.min(100, score)) / 100) * 140) // red → green
  return `hsl(${hue} 70% 50% / 0.18)`
}

function Leaderboard({ sdks }) {
  const data = sdks.filter((s) => s.avg_score != null).map((s) => ({ ...s, value: s.avg_score }))
  return (
    <Card className="lg:col-span-2">
      <CardHeader icon={Crown} title="Average quality score" subtitle="Relative to the other SDKs on the same files (0–100)" />
      <div className="h-72 px-3 pt-4 pb-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, left: 24, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 12 }} />
            <YAxis type="category" dataKey="display_name" tickLine={false} axisLine={false} width={96} tick={{ fill: 'var(--text-2)', fontSize: 13 }} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 8, 8, 0]} maxBarSize={30} name="Score">
              {data.map((row) => <Cell key={row.sdk} fill={row.color} />)}
              <LabelList dataKey="value" position="right" formatter={(v) => v.toFixed(1)} style={{ fill: 'var(--text)', fontSize: 12, fontWeight: 600 }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}

function Weights({ weights }) {
  return (
    <Card className="p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-fg"><Info className="size-4 text-primary" /> How the score works</h3>
      <p className="mt-1 text-xs text-fg-3">Each run is scored against the other SDKs on the same file.</p>
      <ul className="mt-4 space-y-3">
        {weights.map((w) => (
          <li key={w.key}>
            <div className="mb-1 flex justify-between text-xs"><span className="text-fg-2">{w.label}</span><span className="font-semibold text-fg">{Math.round(w.weight * 100)}%</span></div>
            <div className="h-1.5 rounded-full bg-surface-3"><div className="h-full rounded-full bg-primary" style={{ width: `${w.weight * 100 * 3}%` }} /></div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

export default function JobReportPage() {
  const { job } = useOutletContext()
  const { data, isLoading } = useReport(job.id)

  if (isLoading || !data) return <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-80 rounded-2xl lg:col-span-2" /><Skeleton className="h-80 rounded-2xl" /></div>

  const winner = data.sdks.find((s) => s.avg_score != null)

  return (
    <div className="space-y-6">
      {winner ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="relative overflow-hidden p-6">
            <div className="absolute inset-0 opacity-10" style={{ background: `linear-gradient(110deg, ${winner.color}, transparent 60%)` }} />
            <div className="relative flex flex-wrap items-center gap-5">
              <div className="relative">
                <SdkMark sdk={winner.sdk} color={winner.color} size="lg" />
                <Crown className="absolute -top-3 -right-3 size-6 rotate-12 fill-amber-300 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold tracking-wider text-fg-3 uppercase">Best overall on this job</p>
                <p className="text-2xl font-semibold tracking-tight text-fg">{winner.display_name}</p>
                <p className="text-sm text-fg-2">
                  Score {winner.avg_score} · won {winner.wins} of {data.files.length} file(s) · {formatPercent(winner.avg_coverage)} pages with text
                </p>
              </div>
            </div>
          </Card>
        </motion.div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Leaderboard sdks={data.sdks} />
        <Weights weights={data.weights} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {data.sdks.map((s, index) => (
          <Card key={s.sdk} className="p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-semibold text-fg"><SdkMark sdk={s.sdk} color={s.color} size="xs" />{s.display_name}</span>
              {index < 3 && s.avg_score != null ? <Medal className={`size-4 ${['text-amber-500', 'text-slate-400', 'text-orange-700'][index]}`} /> : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-fg-3">Success</dt><dd className="text-right font-medium text-fg">{formatPercent(s.success_rate)}</dd>
              <dt className="text-fg-3">Wins</dt><dd className="text-right font-medium text-fg">{s.wins}</dd>
              <dt className="text-fg-3">Pages</dt><dd className="text-right font-medium text-fg">{formatNumber(s.pages)}</dd>
              <dt className="text-fg-3">Tables</dt><dd className="text-right font-medium text-fg">{formatNumber(s.tables)}</dd>
              <dt className="text-fg-3">Total time</dt><dd className="text-right font-medium text-fg">{formatDuration(s.total_ms)}</dd>
              <dt className="text-fg-3">Skipped</dt><dd className="text-right font-medium text-fg">{s.unsupported}</dd>
            </dl>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Score per file" subtitle="Click a score to open that output" className="pb-4" />
        <div className="overflow-x-auto border-t border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface-2/60 text-left text-xs text-fg-3">
              <tr>
                <th className="px-4 py-2.5 font-medium">File</th>
                {job.sdks.map((sdk) => <th key={sdk} className="px-3 py-2.5 text-center font-medium">{SDK_NAMES[sdk]}</th>)}
                <th className="px-4 py-2.5 font-medium">Winner</th>
              </tr>
            </thead>
            <tbody>
              {data.files.map((file) => (
                <tr key={file.file_id} className="border-t border-border">
                  <td className="max-w-72 px-4 py-2.5"><span className="flex items-center gap-2 truncate text-fg"><KindIcon kind={file.file_kind} />{file.file_name}</span></td>
                  {job.sdks.map((sdk) => {
                    const run = file.runs.find((r) => r.sdk === sdk)
                    const score = run?.score?.score
                    return (
                      <td key={sdk} className="px-1.5 py-1.5 text-center">
                        <Link
                          to={`/jobs/${job.id}/results?file=${file.file_id}&sdk=${sdk}`}
                          className="block rounded-lg py-1.5 text-xs font-semibold tabular-nums text-fg transition-transform hover:scale-105"
                          style={{ background: heat(score) }}
                          title={run?.error ?? ''}
                        >
                          {score != null ? score.toFixed(1) : <span className="font-normal text-fg-3">{run?.status === 'unsupported' ? 'n/a' : run?.status ?? '—'}</span>}
                        </Link>
                      </td>
                    )
                  })}
                  <td className="px-4 py-2.5">{file.winner ? <span className="flex items-center gap-1.5 font-medium text-fg"><SdkMark sdk={file.winner} size="xs" />{SDK_NAMES[file.winner]}</span> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="text-xs text-fg-3">Scores compare SDKs on identical inputs; they are a guide, not ground truth — check the outputs on the Results and Compare pages.</p>
    </div>
  )
}
