import { motion } from 'motion/react'
import { ArrowLeft, Check, Rocket, ScanText, Table2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Stepper } from '@/components/features/job/Stepper'
import { AvailabilityBadge } from '@/components/features/sdk/SdkCard'
import { PageHeader, SdkMark } from '@/components/ui/domain'
import { Badge, Button, ButtonLink, Card, cn, Input, Progress, Skeleton, Switch } from '@/components/ui/primitives'
import { fileKindFromName, OCR_LANGUAGE_NAMES } from '@/constants/app'
import { useUploadDraft } from '@/context/UploadDraftContext'
import { useSdks } from '@/hooks/queries'
import { jobApi } from '@/lib/api/endpoints'
import { formatBytes } from '@/lib/format'

function SdkOption({ sdk, selected, onToggle, kinds }) {
  const unsupported = kinds.filter((k) => k !== 'zip' && !sdk.supported_kinds.includes(k))
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      onClick={onToggle}
      disabled={!sdk.available}
      className={cn(
        'relative flex w-full items-start gap-4 rounded-2xl border bg-surface p-4 text-left transition-all duration-150',
        selected ? 'border-primary shadow-[0_0_0_4px_var(--ring)]' : 'border-border hover:border-border-strong',
        !sdk.available && 'cursor-not-allowed opacity-50',
      )}
    >
      <SdkMark sdk={sdk.name} color={sdk.color} name={sdk.display_name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-fg">{sdk.display_name}</span>
          <AvailabilityBadge sdk={sdk} />
        </div>
        <p className="mt-1 text-sm text-fg-2">{sdk.tagline}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {sdk.output_formats.map((f) => (
            <span key={f.id} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-3">
              {f.label}
            </span>
          ))}
        </div>
        {unsupported.length ? (
          <p className="mt-2 text-xs text-warning">Skips {unsupported.map((k) => k.toUpperCase()).join(', ')} in this upload</p>
        ) : null}
      </div>
      <span className={cn('grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors', selected ? 'border-primary bg-primary text-white' : 'border-border-strong')}>
        {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
      </span>
    </motion.button>
  )
}

export default function NewJobConfigurePage() {
  const navigate = useNavigate()
  const { files, clear } = useUploadDraft()
  const { data, isLoading } = useSdks()
  const [chosen, setSelected] = useState(null) // null = default (every available SDK)
  const [ocr, setOcr] = useState(true)
  const [tables, setTables] = useState(true)
  const [languages, setLanguages] = useState(['swe', 'eng'])
  const [name, setName] = useState('')
  const [progress, setProgress] = useState(null)

  const sdks = useMemo(() => data?.items ?? [], [data])
  const installed = data?.ocr_languages ?? []
  const kinds = useMemo(() => [...new Set(files.map((f) => fileKindFromName(f.name)))], [files])
  const selected = chosen ?? sdks.filter((s) => s.available).map((s) => s.name)

  if (!files.length && progress === null) return <Navigate to="/jobs/new" replace />

  const toggle = (sdkName) => setSelected(selected.includes(sdkName) ? selected.filter((s) => s !== sdkName) : [...selected, sdkName])
  const toggleLanguage = (lang) => setLanguages((cur) => (cur.includes(lang) ? cur.filter((l) => l !== lang) : [...cur, lang]))
  const runCount = selected.length * files.length

  const start = async () => {
    setProgress(0)
    try {
      const job = await jobApi.create(
        { files, sdks: selected, ocr, tables, ocrLanguages: (languages.length ? languages : ['eng']).join('+'), name: name.trim() },
        setProgress,
      )
      toast.success('Extraction started')
      clear()
      navigate(`/jobs/${job.id}`)
    } catch (error) {
      setProgress(null)
      toast.error(error.message)
    }
  }

  return (
    <>
      <PageHeader eyebrow="New extraction" title="Choose extractors" description="Every selected SDK runs on every file, so you can compare them fairly.">
        <div className="mt-5">
          <Stepper current="configure" links={{ upload: '/jobs/new' }} />
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-3">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-sm text-fg-2">
              <span className="font-semibold text-fg">{selected.length}</span> of {sdks.length} selected
            </p>
            <div className="flex gap-2">
              <Button size="xs" variant="ghost" onClick={() => setSelected(sdks.filter((s) => s.available).map((s) => s.name))}>Select all</Button>
              <Button size="xs" variant="ghost" onClick={() => setSelected([])}>None</Button>
            </div>
          </div>
          {isLoading
            ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)
            : sdks.map((sdk) => <SdkOption key={sdk.name} sdk={sdk} kinds={kinds} selected={selected.includes(sdk.name)} onToggle={() => toggle(sdk.name)} />)}
        </div>

        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-5 p-5">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-fg">Name (optional)</span>
              <Input value={name} maxLength={200} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rivning Ödla 4 – underlag" />
            </label>
            <Switch checked={ocr} onChange={setOcr} label="OCR for scanned pages" description="Docling, Unstructured and Tika read image-only pages with Tesseract." />
            {ocr ? (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-fg-2"><ScanText className="size-3.5" /> OCR languages</p>
                <div className="flex flex-wrap gap-1.5">
                  {['swe', 'eng'].map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => toggleLanguage(lang)}
                      className={cn('rounded-lg border px-2.5 py-1 text-xs font-medium', languages.includes(lang) ? 'border-primary bg-primary-soft text-primary-text' : 'border-border text-fg-2')}
                    >
                      {OCR_LANGUAGE_NAMES[lang]}
                      {!installed.includes(lang) ? <span className="ml-1 text-warning">(not installed)</span> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            <Switch checked={tables} onChange={setTables} label="Table structure" description="Detect tables where the SDK supports it." />
          </Card>

          <Card className="p-5">
            <h3 className="text-sm font-semibold text-fg">Summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-fg-3">Files</dt><dd className="text-fg">{files.length} · {formatBytes(files.reduce((s, f) => s + f.size, 0))}</dd></div>
              <div className="flex justify-between"><dt className="text-fg-3">Extractors</dt><dd className="text-fg">{selected.length}</dd></div>
              <div className="flex justify-between"><dt className="text-fg-3">Planned runs</dt><dd className="font-semibold text-fg">{runCount}{kinds.includes('zip') ? '+' : ''}</dd></div>
            </dl>
            {kinds.includes('zip') ? <Badge tone="warning" className="mt-3">ZIP files add a run per file inside</Badge> : null}
            {progress !== null ? (
              <div className="mt-4">
                <div className="mb-1.5 flex justify-between text-xs text-fg-2"><span>{progress < 100 ? 'Uploading…' : 'Creating job…'}</span><span>{progress}%</span></div>
                <Progress value={progress} running />
              </div>
            ) : null}
            <Button className="mt-5 w-full justify-center" size="lg" icon={Rocket} disabled={!selected.length} loading={progress !== null} onClick={start}>
              Start extraction
            </Button>
            <ButtonLink to="/jobs/new" variant="ghost" size="sm" icon={ArrowLeft} className="mt-2 w-full justify-center">
              Back to files
            </ButtonLink>
          </Card>
          <p className="flex items-center gap-1.5 px-1 text-xs text-fg-3"><Table2 className="size-3.5" /> Files are processed by the worker in the background — you can leave the page.</p>
        </div>
      </div>
    </>
  )
}
