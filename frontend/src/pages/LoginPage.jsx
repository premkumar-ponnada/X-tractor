import { motion } from 'motion/react'
import { ArrowRight, FileText, Lock, Mail, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { SdkMark } from '@/components/ui/domain'
import { Button, Input } from '@/components/ui/primitives'
import { SDK_ORDER } from '@/constants/app'
import { useAuth } from '@/context/AuthContext'
import { Logo } from '@/layouts/Logo'

function BrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 p-12 text-white lg:flex lg:flex-col">
      <div className="grid-bg absolute inset-0 opacity-[0.12]" style={{ '--border': 'rgb(255 255 255 / 0.5)' }} />
      <div className="absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-3xl" />
      <div className="relative">
        <span className="inline-flex items-center gap-2.5 text-lg font-semibold">
          <span className="grid size-8 place-items-center rounded-[10px] bg-white/15 ring-1 ring-white/30">
            <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M6 5l12 14M18 5L6 19" />
            </svg>
          </span>
          X-tractor
        </span>
      </div>

      <div className="relative my-auto">
        <h2 className="max-w-md text-4xl leading-tight font-semibold tracking-tight">
          One document. Five extractors. One clear winner.
        </h2>
        <p className="mt-4 max-w-md text-blue-100">
          Run Docling, Unstructured, Apache Tika, MarkItDown and a baseline on the same files, watch every step live and
          compare page-accurate output side by side.
        </p>

        <div className="mt-10 flex items-center gap-6">
          <motion.div
            className="grid size-16 place-items-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <FileText className="size-8" />
          </motion.div>
          <div className="relative h-px w-16 bg-white/30">
            <motion.span
              className="absolute -top-1 size-2 rounded-full bg-white"
              animate={{ x: [0, 64] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="flex flex-col gap-2">
            {SDK_ORDER.map((sdk, index) => (
              <motion.div
                key={sdk}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-2.5 py-1.5 ring-1 ring-white/15"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + index * 0.12 }}
              >
                <SdkMark sdk={sdk} size="xs" />
                <motion.span
                  className="h-1.5 rounded-full bg-white/70"
                  initial={{ width: 0 }}
                  animate={{ width: [0, 70 + index * 9, 70 + index * 9] }}
                  transition={{ delay: 0.6 + index * 0.15, duration: 1.6, repeat: Infinity, repeatDelay: 1.5 }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="relative flex items-center gap-2 text-sm text-blue-100">
        <ShieldCheck className="size-4" /> Runs in your own environment — documents never leave it.
      </div>
    </div>
  )
}

export default function LoginPage() {
  const { status, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  if (status === 'signed-in') return <Navigate to={location.state?.from || '/dashboard'} replace />

  const onSubmit = async (event) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
      navigate(location.state?.from || '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <BrandPanel />
      <div className="flex items-center justify-center p-6 sm:p-12">
        <motion.div className="w-full max-w-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Logo className="mb-10 lg:hidden" />
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
          <p className="mt-1.5 text-sm text-fg-2">Sign in to run and compare extractors.</p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-fg">Email</span>
              <Input icon={Mail} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-fg">Password</span>
              <Input icon={Lock} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </label>
            {error ? (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
                {error}
              </motion.p>
            ) : null}
            <Button type="submit" size="lg" className="w-full justify-center" loading={submitting} iconRight={ArrowRight} disabled={status === 'loading'}>
              Sign in
            </Button>
          </form>
          <p className="mt-8 text-center text-xs text-fg-3">Single-account access for now · credentials are set in the backend .env</p>
        </motion.div>
      </div>
    </div>
  )
}
