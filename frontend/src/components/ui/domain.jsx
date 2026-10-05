import { FILE_KINDS, JOB_STATUS, RUN_STATUS, SDK_COLORS, SDK_NAMES } from '@/constants/app'
import { Badge, Card, cn, Progress } from './primitives'

export function SdkMark({ sdk, color, name, size = 'md', className }) {
  const label = name ?? SDK_NAMES[sdk] ?? sdk
  const initials = label.replace('Apache ', '').slice(0, 2)
  const dims = { xs: 'size-5 text-[9px] rounded-md', sm: 'size-7 text-[11px] rounded-lg', md: 'size-9 text-xs rounded-xl', lg: 'size-12 text-base rounded-2xl' }
  const tint = color ?? SDK_COLORS[sdk] ?? '#64748b'
  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center font-bold text-white shadow-sm', dims[size], className)}
      style={{ background: `linear-gradient(135deg, ${tint}, ${tint}cc)` }}
      title={label}
    >
      {initials}
    </span>
  )
}

export function KindIcon({ kind, className }) {
  const meta = FILE_KINDS[kind] ?? FILE_KINDS.other
  const Icon = meta.icon
  return <Icon className={cn('size-4 shrink-0', meta.tone, className)} />
}

export function KindBadge({ kind }) {
  return (
    <Badge tone="neutral" className="font-mono uppercase">
      <KindIcon kind={kind} className="size-3" />
      {kind ?? '…'}
    </Badge>
  )
}

export function JobStatusBadge({ status }) {
  const meta = JOB_STATUS[status] ?? JOB_STATUS.queued
  return (
    <Badge tone={meta.tone} icon={meta.icon} spin={meta.spin}>
      {meta.label}
    </Badge>
  )
}

export function RunStatusBadge({ status }) {
  const meta = RUN_STATUS[status] ?? RUN_STATUS.queued
  return (
    <Badge tone={meta.tone} icon={meta.icon} spin={meta.spin}>
      {meta.label}
    </Badge>
  )
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'primary', loading }) {
  const tones = {
    primary: 'bg-primary-soft text-primary',
    success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning',
    info: 'bg-info-soft text-info',
  }
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-fg-3">{label}</p>
          {loading ? (
            <div className="shimmer mt-2 h-8 w-20 rounded-lg" />
          ) : (
            <p className="mt-1.5 text-[28px] leading-none font-semibold tracking-tight text-fg tabular-nums">{value}</p>
          )}
          {hint ? <p className="mt-2 text-xs text-fg-3">{hint}</p> : null}
        </div>
        {Icon ? (
          <div className={cn('grid size-10 shrink-0 place-items-center rounded-xl', tones[tone])}>
            <Icon className="size-5" />
          </div>
        ) : null}
      </div>
    </Card>
  )
}

export function CapabilityBar({ label, value, color }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-fg-2">{label}</span>
        <span className="font-semibold text-fg tabular-nums">{value}%</span>
      </div>
      <Progress value={value} color={color} size="sm" />
    </div>
  )
}

export function ScorePill({ score, className }) {
  if (score == null) return <span className="text-xs text-fg-3">—</span>
  const tone = score >= 85 ? 'success' : score >= 65 ? 'primary' : score >= 45 ? 'warning' : 'danger'
  return (
    <Badge tone={tone} className={cn('font-semibold tabular-nums', className)}>
      {score.toFixed(1)}
    </Badge>
  )
}

export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <div className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? <p className="mb-1.5 text-xs font-semibold tracking-wider text-primary uppercase">{eyebrow}</p> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-[28px]">{title}</h1>
        {description ? <p className="mt-1.5 max-w-2xl text-sm text-fg-2">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function LiveDot({ active = true, className }) {
  return (
    <span className={cn('relative inline-flex size-2.5', className)}>
      {active ? <span className="absolute inset-0 animate-ping rounded-full bg-success opacity-60" /> : null}
      <span className={cn('relative inline-flex size-2.5 rounded-full', active ? 'bg-success' : 'bg-fg-3')} />
    </span>
  )
}
