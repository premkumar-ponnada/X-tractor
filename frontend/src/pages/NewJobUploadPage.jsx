import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Archive, CloudUpload, Trash2, X } from 'lucide-react'
import { useMemo } from 'react'
import { useDropzone } from 'react-dropzone'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Stepper } from '@/components/features/job/Stepper'
import { KindIcon, PageHeader } from '@/components/ui/domain'
import { Badge, Button, Card, cn } from '@/components/ui/primitives'
import { FILE_KINDS, fileKindFromName } from '@/constants/app'
import { useUploadDraft } from '@/context/UploadDraftContext'
import { formatBytes } from '@/lib/format'

const MAX_FILES = 50
const MAX_FILE_BYTES = 100 * 1024 * 1024
const HIGHLIGHT_KINDS = ['pdf', 'docx', 'doc', 'xlsx', 'xls', 'pptx', 'eml', 'msg', 'rtf', 'html', 'csv', 'image', 'zip']

export default function NewJobUploadPage() {
  const navigate = useNavigate()
  const { files, addFiles, removeFile, clear, fileKey } = useUploadDraft()

  const onDrop = (accepted, rejected) => {
    const room = MAX_FILES - files.length
    if (accepted.length > room) toast.warning(`Only ${MAX_FILES} files per extraction — ${accepted.length - room} skipped`)
    addFiles(accepted.slice(0, Math.max(room, 0)))
    rejected.forEach(({ file, errors }) => toast.error(`${file.name}: ${errors[0]?.message ?? 'rejected'}`))
  }
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({ onDrop, maxSize: MAX_FILE_BYTES, noClick: true })

  const summary = useMemo(() => {
    const byKind = {}
    files.forEach((f) => {
      const kind = fileKindFromName(f.name)
      byKind[kind] = (byKind[kind] ?? 0) + 1
    })
    return { byKind, size: files.reduce((sum, f) => sum + f.size, 0) }
  }, [files])

  return (
    <>
      <PageHeader eyebrow="New extraction" title="Upload your files" description="Drop a tender package or any mix of documents. ZIP archives are unpacked and every file inside is tested.">
        <div className="mt-5">
          <Stepper current="upload" />
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div
          {...getRootProps()}
          className={cn(
            'relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200',
            isDragActive ? 'scale-[1.01] border-primary bg-primary-soft' : 'border-border-strong bg-surface hover:border-primary/50',
          )}
        >
          <input {...getInputProps()} />
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(circle,black,transparent_70%)]" />
          <motion.div
            className="relative grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/30"
            animate={isDragActive ? { scale: 1.12, rotate: -4 } : { scale: 1, rotate: 0, y: [0, -5, 0] }}
            transition={isDragActive ? { type: 'spring' } : { duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <CloudUpload className="size-8" />
          </motion.div>
          <h2 className="relative mt-5 text-lg font-semibold text-fg">{isDragActive ? 'Release to add files' : 'Drag & drop files here'}</h2>
          <p className="relative mt-1 text-sm text-fg-2">
            or{' '}
            <button type="button" onClick={open} className="font-semibold text-primary hover:underline">
              browse your computer
            </button>{' '}
            · up to {MAX_FILES} files, {formatBytes(MAX_FILE_BYTES)} each
          </p>
          <div className="relative mt-6 flex max-w-lg flex-wrap justify-center gap-1.5">
            {HIGHLIGHT_KINDS.map((kind) => (
              <span key={kind} className="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-xs text-fg-2">
                <KindIcon kind={kind} className="size-3.5" />
                {FILE_KINDS[kind].label}
              </span>
            ))}
          </div>
        </div>

        <Card className="flex max-h-[560px] flex-col">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-fg">Selected files</h3>
              <p className="text-xs text-fg-3">
                {files.length} file(s) · {formatBytes(summary.size)}
              </p>
            </div>
            {files.length ? (
              <Button variant="danger-ghost" size="xs" icon={Trash2} onClick={clear}>
                Clear
              </Button>
            ) : null}
          </div>
          {files.length ? (
            <div className="flex flex-wrap gap-1.5 border-b border-border px-5 py-3">
              {Object.entries(summary.byKind).map(([kind, count]) => (
                <Badge key={kind} tone={kind === 'zip' ? 'warning' : 'neutral'}>
                  <KindIcon kind={kind} className="size-3" /> {count} {FILE_KINDS[kind]?.label}
                </Badge>
              ))}
            </div>
          ) : null}
          <ul className="flex-1 space-y-1 overflow-y-auto p-2">
            <AnimatePresence initial={false}>
              {files.map((file) => (
                <motion.li
                  key={fileKey(file)}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12, height: 0 }}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2 hover:bg-surface-2"
                >
                  <KindIcon kind={fileKindFromName(file.name)} className="size-5" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{file.name}</p>
                    <p className="text-xs text-fg-3">{formatBytes(file.size)}</p>
                  </div>
                  <button onClick={() => removeFile(file)} className="rounded-md p-1 text-fg-3 opacity-0 group-hover:opacity-100 hover:bg-surface-3 hover:text-danger" aria-label={`Remove ${file.name}`}>
                    <X className="size-4" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
            {!files.length ? (
              <li className="flex flex-col items-center px-4 py-10 text-center text-sm text-fg-3">
                <Archive className="mb-2 size-6" /> Nothing selected yet
              </li>
            ) : null}
          </ul>
          <div className="border-t border-border p-4">
            <Button className="w-full justify-center" size="lg" iconRight={ArrowRight} disabled={!files.length} onClick={() => navigate('/jobs/new/configure')}>
              Continue to extractors
            </Button>
          </div>
        </Card>
      </div>
    </>
  )
}
