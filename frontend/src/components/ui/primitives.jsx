import clsx from 'clsx'
import { Loader2 } from 'lucide-react'
import { forwardRef } from 'react'
import { Link } from 'react-router-dom'

export const cn = (...args) => clsx(...args)

const BUTTON_VARIANTS = {
  primary: 'bg-primary text-white hover:bg-primary-hover shadow-sm shadow-primary/20',
  secondary: 'bg-surface text-fg border border-border hover:border-border-strong hover:bg-surface-2 shadow-card',
  ghost: 'text-fg-2 hover:text-fg hover:bg-surface-2',
  soft: 'bg-primary-soft text-primary-text hover:brightness-95',
  danger: 'bg-danger text-white hover:brightness-110',
  'danger-ghost': 'text-danger hover:bg-danger-soft',
}
const BUTTON_SIZES = {
  xs: 'h-7 px-2.5 text-xs gap-1.5 rounded-md',
  sm: 'h-8 px-3 text-sm gap-1.5 rounded-lg',
  md: 'h-9 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-11 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-8 w-8 rounded-lg justify-center',
}

export function buttonClasses(variant = 'primary', size = 'md', className) {
  return cn(
    'inline-flex items-center font-medium whitespace-nowrap transition-all duration-150 select-none',
    'disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98]',
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  )
}

export function ButtonLink({ to, variant, size, icon: Icon, iconRight: IconRight, className, children, ...props }) {
  return (
    <Link to={to} className={buttonClasses(variant, size, className)} {...props}>
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      {children}
      {IconRight ? <IconRight className="size-4 shrink-0" /> : null}
    </Link>
  )
}

export const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, iconRight: IconRight, className, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={buttonClasses(variant, size, className)}
      {...props}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4 shrink-0" /> : null}
      {children}
      {IconRight && !loading ? <IconRight className="size-4 shrink-0" /> : null}
    </button>
  )
})

export function Card({ className, children, interactive = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-border bg-surface shadow-card',
        interactive && 'transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-pop',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, icon: Icon, actions, className }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-5 pt-5', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <Icon className="size-[18px]" />
          </div>
        ) : null}
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
          {subtitle ? <p className="mt-0.5 text-sm text-fg-3">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  )
}

const BADGE_TONES = {
  neutral: 'bg-surface-2 text-fg-2 border-border',
  primary: 'bg-primary-soft text-primary-text border-transparent',
  success: 'bg-success-soft text-success border-transparent',
  warning: 'bg-warning-soft text-warning border-transparent',
  danger: 'bg-danger-soft text-danger border-transparent',
  info: 'bg-info-soft text-info border-transparent',
}

export function Badge({ tone = 'neutral', icon: Icon, spin = false, className, children, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        BADGE_TONES[tone],
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className={cn('size-3', spin && 'animate-spin')} /> : null}
      {children}
    </span>
  )
}

const BAR_TONES = { primary: 'bg-primary', success: 'bg-success', warning: 'bg-warning', danger: 'bg-danger', neutral: 'bg-fg-3' }

export function Progress({ value = 0, tone = 'primary', color, running = false, size = 'md', className }) {
  const clamped = Math.max(0, Math.min(100, value || 0))
  return (
    <div className={cn('overflow-hidden rounded-full bg-surface-3', size === 'sm' ? 'h-1.5' : 'h-2', className)}>
      <div
        className={cn('relative h-full rounded-full transition-[width] duration-700 ease-out', !color && BAR_TONES[tone])}
        style={{ width: `${clamped}%`, backgroundColor: color }}
      >
        {running ? <div className="running-stripe absolute inset-0 rounded-full" /> : null}
      </div>
    </div>
  )
}

export function Skeleton({ className }) {
  return <div className={cn('shimmer rounded-lg', className)} />
}

export function Spinner({ className }) {
  return <Loader2 className={cn('size-4 animate-spin text-primary', className)} />
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon ? (
        <div className="mb-4 grid size-12 place-items-center rounded-2xl border border-border bg-surface-2 text-fg-3">
          <Icon className="size-6" />
        </div>
      ) : null}
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-fg-3">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function Segmented({ options, value, onChange, size = 'md', className }) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-xl border border-border bg-surface-2 p-0.5', className)}>
      {options.map((option) => {
        const active = option.value === value
        const Icon = option.icon
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[10px] font-medium transition-all duration-150 disabled:opacity-40',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-sm',
              active ? 'bg-surface text-fg shadow-card' : 'text-fg-3 hover:text-fg-2',
            )}
          >
            {option.color ? <span className="size-2 rounded-full" style={{ backgroundColor: option.color }} /> : null}
            {Icon ? <Icon className="size-3.5" /> : null}
            {option.label}
            {option.count != null ? <span className="text-fg-3">{option.count}</span> : null}
          </button>
        )
      })}
    </div>
  )
}

export function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4', disabled && 'cursor-not-allowed opacity-50')}>
      <span>
        <span className="block text-sm font-medium text-fg">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-fg-3">{description}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          checked ? 'bg-primary' : 'bg-surface-3 ring-1 ring-border-strong ring-inset',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform duration-200',
            checked && 'translate-x-4',
          )}
        />
      </button>
    </label>
  )
}

export const Input = forwardRef(function Input({ className, icon: Icon, ...props }, ref) {
  return (
    <div className="relative">
      {Icon ? <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-3" /> : null}
      <input
        ref={ref}
        className={cn(
          'h-10 w-full rounded-xl border border-border bg-surface px-3 text-sm text-fg placeholder:text-fg-3',
          'transition-shadow outline-none focus:border-primary focus:ring-4 focus:ring-[var(--ring)]',
          Icon && 'pl-9',
          className,
        )}
        {...props}
      />
    </div>
  )
})

export function Kbd({ children }) {
  return <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-3">{children}</kbd>
}
