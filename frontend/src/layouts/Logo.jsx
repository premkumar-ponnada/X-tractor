import { cn } from '@/components/ui/primitives'

export function Logo({ className, compact = false }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="relative grid size-8 place-items-center rounded-[10px] bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-600/25">
        <svg viewBox="0 0 24 24" className="size-[18px] text-white" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 5l12 14M18 5L6 19" />
        </svg>
      </span>
      {compact ? null : (
        <span className="text-[17px] font-semibold tracking-tight text-fg">
          X<span className="text-primary">-</span>tractor
        </span>
      )}
    </span>
  )
}
