import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function MarkdownView({ content }) {
  if (!content?.trim()) return <p className="py-10 text-center text-sm text-fg-3 italic">This page has no text.</p>
  return (
    <article className="prose prose-sm max-w-none prose-slate dark:prose-invert prose-headings:font-semibold prose-table:text-xs prose-th:bg-surface-2 prose-td:border prose-td:border-border prose-th:border prose-th:border-border prose-th:px-2 prose-td:px-2">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </article>
  )
}

// HTML from SDKs is untrusted: render it in a sandboxed iframe with scripts disabled.
export function HtmlView({ content }) {
  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{font:14px/1.6 Inter,system-ui,sans-serif;color:#0f172a;padding:20px;margin:0}
    table{border-collapse:collapse;margin:12px 0}td,th{border:1px solid #e3e7ee;padding:4px 8px;font-size:12px}
    img{max-width:100%}div.page{border-bottom:2px dashed #cfd6e1;padding-bottom:16px;margin-bottom:16px}
  </style></head><body>${content}</body></html>`
  return <iframe title="Rendered HTML" sandbox="" srcDoc={doc} className="h-[70vh] w-full rounded-xl border border-border bg-white" />
}

export function prettyJson(content) {
  try {
    return JSON.stringify(JSON.parse(content), null, 2)
  } catch {
    return content
  }
}
