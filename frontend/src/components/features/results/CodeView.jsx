import { useMemo, useState } from 'react'
import { cn } from '@/components/ui/primitives'

const MAX_LINES = 4000

// Plain, fast code view with line numbers. Big outputs are capped for the browser's sake.
export function CodeView({ content, className, wrap: initialWrap = true }) {
  const [wrap, setWrap] = useState(initialWrap)
  const { lines, hidden } = useMemo(() => {
    const all = (content ?? '').split('\n')
    return { lines: all.slice(0, MAX_LINES), hidden: Math.max(0, all.length - MAX_LINES) }
  }, [content])

  return (
    <div className={cn('relative overflow-hidden rounded-xl border border-border bg-surface-2/60', className)}>
      <button
        onClick={() => setWrap((w) => !w)}
        className="absolute top-2 right-2 z-10 rounded-md border border-border bg-surface px-2 py-0.5 text-[11px] text-fg-3 hover:text-fg"
      >
        {wrap ? 'No wrap' : 'Wrap'}
      </button>
      <div className="max-h-[70vh] overflow-auto">
        <table className="w-full font-mono text-[12.5px] leading-relaxed">
          <tbody>
            {lines.map((line, index) => (
              <tr key={index} className="hover:bg-surface-3/50">
                <td className="sticky left-0 w-12 border-r border-border bg-surface-2 px-3 text-right align-top text-fg-3 select-none">
                  {index + 1}
                </td>
                <td className={cn('px-4 text-fg', wrap ? 'break-all whitespace-pre-wrap' : 'whitespace-pre')}>{line || ' '}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {hidden ? <p className="border-t border-border px-4 py-2 text-xs text-fg-3">… {hidden.toLocaleString()} more lines — download to see everything</p> : null}
      </div>
    </div>
  )
}
