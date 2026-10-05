import { Check, Code2, Copy, Download, Eye } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, cn, Segmented, Skeleton } from '@/components/ui/primitives'
import { OUTPUT_FORMATS } from '@/constants/app'
import { useRunOutput } from '@/hooks/queries'
import { runApi } from '@/lib/api/endpoints'
import { formatBytes } from '@/lib/format'
import { CodeView } from './CodeView'
import { HtmlView, MarkdownView, prettyJson } from './RenderedContent'

const RENDERABLE = new Set(['markdown', 'html', 'xhtml'])

export function OutputViewer({ run, format, onFormatChange }) {
  const formats = (run.output_formats ?? []).map((id) => ({ id, ...(OUTPUT_FORMATS[id] ?? { label: id, ext: id }) }))
  const active = formats.find((f) => f.id === format) ? format : formats[0]?.id
  const { data, isLoading, isError, error } = useRunOutput(run.id, active)
  const [mode, setMode] = useState('rendered')
  const [copied, setCopied] = useState(false)

  const canRender = RENDERABLE.has(active)
  const showRendered = canRender && mode === 'rendered'
  const content = data ? (active === 'json' || active === 'metadata' ? prettyJson(data.content) : data.content) : ''

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(data?.content ?? '')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {formats.map((f) => (
            <button
              key={f.id}
              onClick={() => onFormatChange(f.id)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
                active === f.id ? 'border-primary bg-primary-soft text-primary-text' : 'border-border bg-surface text-fg-2 hover:border-border-strong',
              )}
            >
              {f.label}
              <span className="ml-1.5 font-mono text-[10px] text-fg-3">.{f.ext}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {canRender ? (
            <Segmented size="sm" value={mode} onChange={setMode} options={[{ value: 'rendered', label: 'Rendered', icon: Eye }, { value: 'source', label: 'Source', icon: Code2 }]} />
          ) : null}
          <Button size="sm" variant="secondary" icon={copied ? Check : Copy} onClick={copy} disabled={!data}>
            {copied ? 'Copied' : 'Copy'}
          </Button>
          <a
            href={active ? runApi.downloadUrl(run.id, active) : undefined}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-sm font-medium text-white hover:bg-primary-hover"
          >
            <Download className="size-4" /> Download
          </a>
        </div>
      </div>

      {data ? (
        <div className="mb-2 flex items-center gap-2 text-xs text-fg-3">
          <Badge tone="neutral" className="font-mono">{data.mime}</Badge>
          {formatBytes(data.size)}
          {data.truncated ? <Badge tone="warning">Preview truncated — download for the full file</Badge> : null}
        </div>
      ) : null}

      {isLoading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : isError ? (
        <p className="rounded-xl bg-danger-soft p-4 text-sm text-danger">{error.message}</p>
      ) : showRendered ? (
        active === 'markdown' ? (
          <div className="max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface p-6">
            <MarkdownView content={content} />
          </div>
        ) : (
          <HtmlView content={content} />
        )
      ) : (
        <CodeView content={content} />
      )}
    </div>
  )
}
