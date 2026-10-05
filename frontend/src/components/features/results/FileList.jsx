import { Archive } from 'lucide-react'
import { KindIcon } from '@/components/ui/domain'
import { Card, cn } from '@/components/ui/primitives'
import { SDK_COLORS } from '@/constants/app'

const DOT = { completed: 1, failed: 0.9, running: 0.6, queued: 0.25, unsupported: 0.15, cancelled: 0.15 }

// Files of a job (unpacked zip contents grouped under their archive) with one status dot per SDK.
export function FileList({ files, runs, selectedId, onSelect }) {
  const parents = Object.fromEntries(files.filter((f) => f.container).map((f) => [f.id, f.name]))
  const items = files.filter((f) => !f.container && !f.error)
  const groups = items.reduce((acc, file) => {
    const key = file.parent_id ? parents[file.parent_id] ?? 'Archive' : ''
    ;(acc[key] = acc[key] ?? []).push(file)
    return acc
  }, {})

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Files</h3>
        <p className="text-xs text-fg-3">{items.length} extracted file(s)</p>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-1.5">
        {Object.entries(groups).map(([group, groupFiles]) => (
          <div key={group || 'root'} className="mb-1">
            {group ? (
              <p className="flex items-center gap-1.5 px-2.5 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-fg-3 uppercase">
                <Archive className="size-3" /> {group}
              </p>
            ) : null}
            {groupFiles.map((file) => {
              const fileRuns = runs.filter((r) => r.file_id === file.id)
              return (
                <button
                  key={file.id}
                  onClick={() => onSelect(file.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                    selectedId === file.id ? 'bg-primary-soft' : 'hover:bg-surface-2',
                  )}
                >
                  <KindIcon kind={file.kind} className="size-[18px]" />
                  <div className="min-w-0 flex-1">
                    <p className={cn('truncate text-sm', selectedId === file.id ? 'font-semibold text-primary-text' : 'text-fg')}>{file.name}</p>
                    <div className="mt-1 flex gap-1">
                      {fileRuns.map((run) => (
                        <span
                          key={run.id}
                          title={`${run.sdk}: ${run.status}`}
                          className={cn('h-1.5 w-4 rounded-full', run.status === 'failed' && 'ring-1 ring-danger')}
                          style={{ background: SDK_COLORS[run.sdk], opacity: DOT[run.status] ?? 0.2 }}
                        />
                      ))}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </Card>
  )
}
