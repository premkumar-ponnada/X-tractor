import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '@/components/ui/primitives'
import { JOB_STEPS } from '@/constants/app'

// current: key of the active step. links: {stepKey: href} for steps that can be opened.
export function Stepper({ current, links = {}, disabled = [] }) {
  const currentIndex = JOB_STEPS.findIndex((s) => s.key === current)
  return (
    <nav aria-label="Progress" className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <ol className="flex min-w-max items-center gap-2">
        {JOB_STEPS.map((step, index) => {
          const done = index < currentIndex
          const active = index === currentIndex
          const href = links[step.key]
          const isDisabled = disabled.includes(step.key)
          const content = (
            <span
              className={cn(
                'flex items-center gap-2 rounded-full border py-1 pr-3.5 pl-1 text-sm font-medium transition-colors',
                active && 'border-primary/30 bg-primary-soft text-primary-text',
                done && 'border-border bg-surface text-fg-2',
                !active && !done && 'border-border bg-surface text-fg-3',
                href && !isDisabled && !active && 'hover:border-border-strong hover:text-fg',
                isDisabled && 'opacity-50',
              )}
            >
              <span
                className={cn(
                  'grid size-6 place-items-center rounded-full text-xs font-semibold',
                  active && 'bg-primary text-white',
                  done && 'bg-success text-white',
                  !active && !done && 'bg-surface-3 text-fg-3',
                )}
              >
                {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
              </span>
              {step.label}
            </span>
          )
          return (
            <li key={step.key} className="flex items-center gap-2">
              {href && !isDisabled ? <Link to={href}>{content}</Link> : content}
              {index < JOB_STEPS.length - 1 ? <span className={cn('h-px w-5', done ? 'bg-success' : 'bg-border')} /> : null}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
