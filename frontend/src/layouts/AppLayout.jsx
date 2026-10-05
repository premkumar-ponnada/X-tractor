import { AnimatePresence, motion } from 'motion/react'
import {
  Boxes,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Plus,
  Sun,
  X,
} from 'lucide-react'
import { Suspense, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LiveDot } from '@/components/ui/domain'
import { PageFallback } from '@/components/ui/PageFallback'
import { Button, cn } from '@/components/ui/primitives'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { useHealth } from '@/hooks/queries'
import { Logo } from './Logo'

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/jobs/new', label: 'New extraction', icon: Plus },
  { to: '/extractors', label: 'Extractors', icon: Boxes },
  { to: '/history', label: 'History', icon: History },
]

function ServiceStatus() {
  const { data, isError } = useHealth()
  const checks = data?.checks ?? {}
  const rows = [
    { key: 'database', label: 'Database' },
    { key: 'worker', label: 'Worker' },
    { key: 'tika', label: 'Tika server' },
  ]
  return (
    <div className="rounded-xl border border-border bg-surface-2/60 p-3">
      <p className="mb-2 text-[11px] font-semibold tracking-wider text-fg-3 uppercase">Services</p>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const ok = !isError && checks[row.key]
          return (
            <li key={row.key} className="flex items-center justify-between text-xs">
              <span className="text-fg-2">{row.label}</span>
              <span className={cn('flex items-center gap-1.5 font-medium', ok ? 'text-success' : 'text-fg-3')}>
                <LiveDot active={!!ok} className="scale-75" />
                {data ? (ok ? 'Online' : 'Offline') : '…'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <div className="flex items-center justify-between px-2 pt-1">
        <Logo />
      </div>
      <nav className="space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'bg-primary-soft text-primary-text' : 'text-fg-2 hover:bg-surface-2 hover:text-fg',
              )
            }
          >
            <Icon className="size-[18px]" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-3">
        <ServiceStatus />
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
          <div className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white dark:from-slate-500 dark:to-slate-700">
            {user?.name?.[0] ?? '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{user?.name}</p>
            <p className="truncate text-xs text-fg-3">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
            {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
        <SidebarContent />
      </aside>

      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border bg-surface/85 px-4 backdrop-blur lg:hidden">
        <Logo />
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </header>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div className="fixed inset-0 z-40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
            <motion.aside
              className="absolute inset-y-0 left-0 w-72 border-r border-border bg-surface"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
            >
              <button className="absolute top-4 right-3 rounded-lg p-1.5 text-fg-3 hover:bg-surface-2" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <X className="size-4" />
              </button>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <main className="lg:pl-64">
        <motion.div
          key={location.pathname.split('/').slice(0, 3).join('/')}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9"
        >
          <Suspense fallback={<PageFallback />}>
            <Outlet />
          </Suspense>
        </motion.div>
      </main>
    </div>
  )
}
