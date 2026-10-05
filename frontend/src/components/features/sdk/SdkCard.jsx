import { motion } from 'motion/react'
import { ArrowUpRight, CheckCircle2, CircleAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import { CapabilityBar, SdkMark } from '@/components/ui/domain'
import { Badge, Card } from '@/components/ui/primitives'

export function AvailabilityBadge({ sdk }) {
  return sdk.available ? (
    <Badge tone="success" icon={CheckCircle2} title={sdk.availability_note}>
      {sdk.version ?? 'Ready'}
    </Badge>
  ) : (
    <Badge tone="danger" icon={CircleAlert} title={sdk.availability_note}>
      Unavailable
    </Badge>
  )
}

export function OverallRing({ value, color, size = 56 }) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--surface-3)" strokeWidth="6" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
          transition={{ duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-sm font-semibold text-fg tabular-nums">{value}</span>
    </div>
  )
}

export function SdkCard({ sdk, index = 0 }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <Card interactive className="group relative flex h-full flex-col overflow-hidden">
        <div className="h-1 w-full" style={{ background: sdk.color }} />
        <Link to={`/extractors/${sdk.name}`} className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <SdkMark sdk={sdk.name} color={sdk.color} name={sdk.display_name} size="lg" />
              <div>
                <h3 className="flex items-center gap-1.5 text-base font-semibold text-fg">
                  {sdk.display_name}
                  <ArrowUpRight className="size-4 text-fg-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </h3>
                <p className="text-xs text-fg-3">{sdk.vendor}</p>
              </div>
            </div>
            <OverallRing value={sdk.overall} color={sdk.color} />
          </div>
          <p className="mt-4 text-sm text-fg-2">{sdk.tagline}</p>

          <div className="mt-5 space-y-3">
            {sdk.capabilities.map((capability) => (
              <CapabilityBar key={capability.key} label={capability.label} value={capability.value} color={sdk.color} />
            ))}
          </div>

          <div className="mt-5 flex flex-wrap gap-1.5">
            {sdk.output_formats.map((format) => (
              <Badge key={format.id} tone="neutral" className="font-mono">
                {format.label}
              </Badge>
            ))}
          </div>

          <div className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-4 mt-5 text-xs">
            <span className="text-fg-3">
              {sdk.license} · {sdk.supported_kinds.length} formats
            </span>
            <AvailabilityBadge sdk={sdk} />
          </div>
        </Link>
      </Card>
    </motion.div>
  )
}
