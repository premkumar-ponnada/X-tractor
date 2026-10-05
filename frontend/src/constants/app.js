import {
  Archive,
  CheckCircle2,
  CircleDashed,
  CircleSlash,
  Clock3,
  File,
  FileCode2,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType2,
  Loader2,
  Mail,
  Presentation,
  XCircle,
} from 'lucide-react'

export const APP_NAME = 'X-tractor'

// Fallback SDK colours (the API also sends them) — keeps skeletons and charts consistent.
export const SDK_COLORS = {
  docling: '#2563eb',
  unstructured: '#7c3aed',
  tika: '#ea580c',
  markitdown: '#0891b2',
  baseline: '#64748b',
}
export const SDK_NAMES = {
  docling: 'Docling',
  unstructured: 'Unstructured',
  tika: 'Apache Tika',
  markitdown: 'MarkItDown',
  baseline: 'Baseline',
}
export const SDK_ORDER = ['docling', 'unstructured', 'tika', 'markitdown', 'baseline']

export const FILE_KINDS = {
  pdf: { label: 'PDF', icon: FileText, tone: 'text-rose-500' },
  docx: { label: 'Word', icon: FileType2, tone: 'text-blue-600' },
  doc: { label: 'Word 97', icon: FileType2, tone: 'text-blue-500' },
  xlsx: { label: 'Excel', icon: FileSpreadsheet, tone: 'text-emerald-600' },
  xls: { label: 'Excel 97', icon: FileSpreadsheet, tone: 'text-emerald-500' },
  csv: { label: 'CSV', icon: FileSpreadsheet, tone: 'text-emerald-500' },
  pptx: { label: 'PowerPoint', icon: Presentation, tone: 'text-orange-500' },
  ppt: { label: 'PowerPoint 97', icon: Presentation, tone: 'text-orange-500' },
  rtf: { label: 'RTF', icon: FileText, tone: 'text-slate-500' },
  odt: { label: 'ODT', icon: FileType2, tone: 'text-sky-600' },
  ods: { label: 'ODS', icon: FileSpreadsheet, tone: 'text-sky-600' },
  odp: { label: 'ODP', icon: Presentation, tone: 'text-sky-600' },
  txt: { label: 'Text', icon: FileText, tone: 'text-slate-500' },
  md: { label: 'Markdown', icon: FileCode2, tone: 'text-slate-600' },
  html: { label: 'HTML', icon: FileCode2, tone: 'text-amber-600' },
  xml: { label: 'XML', icon: FileCode2, tone: 'text-amber-600' },
  eml: { label: 'Email', icon: Mail, tone: 'text-indigo-500' },
  msg: { label: 'Outlook', icon: Mail, tone: 'text-indigo-500' },
  epub: { label: 'EPUB', icon: FileText, tone: 'text-teal-600' },
  image: { label: 'Image', icon: FileImage, tone: 'text-pink-500' },
  zip: { label: 'ZIP', icon: Archive, tone: 'text-yellow-600' },
  other: { label: 'Other', icon: File, tone: 'text-slate-400' },
}

export function fileKindFromName(name = '') {
  const ext = name.split('.').pop()?.toLowerCase()
  const map = {
    pdf: 'pdf', docx: 'docx', docm: 'docx', doc: 'doc', xlsx: 'xlsx', xlsm: 'xlsx', xls: 'xls', csv: 'csv',
    pptx: 'pptx', ppt: 'ppt', rtf: 'rtf', odt: 'odt', ods: 'ods', odp: 'odp', txt: 'txt', md: 'md',
    html: 'html', htm: 'html', xml: 'xml', eml: 'eml', msg: 'msg', epub: 'epub', zip: 'zip',
    png: 'image', jpg: 'image', jpeg: 'image', tif: 'image', tiff: 'image', bmp: 'image', gif: 'image', webp: 'image',
  }
  return map[ext] ?? 'other'
}

export const JOB_STATUS = {
  queued: { label: 'Queued', tone: 'neutral', icon: Clock3 },
  running: { label: 'Running', tone: 'primary', icon: Loader2, spin: true },
  completed: { label: 'Completed', tone: 'success', icon: CheckCircle2 },
  partial: { label: 'Partial', tone: 'warning', icon: CircleDashed },
  failed: { label: 'Failed', tone: 'danger', icon: XCircle },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: CircleSlash },
}

export const RUN_STATUS = {
  queued: { label: 'Queued', tone: 'neutral', icon: Clock3 },
  running: { label: 'Running', tone: 'primary', icon: Loader2, spin: true },
  completed: { label: 'Done', tone: 'success', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'danger', icon: XCircle },
  unsupported: { label: 'Not supported', tone: 'neutral', icon: CircleSlash },
  cancelled: { label: 'Cancelled', tone: 'neutral', icon: CircleSlash },
}

export const FINISHED_JOB = new Set(['completed', 'partial', 'failed', 'cancelled'])

export const OCR_LANGUAGE_NAMES = { swe: 'Swedish', eng: 'English', nor: 'Norwegian', dan: 'Danish', fin: 'Finnish', deu: 'German' }

// The six steps a job goes through — drives the stepper on every job page.
export const JOB_STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'configure', label: 'Configure' },
  { key: 'run', label: 'Extract' },
  { key: 'results', label: 'Results' },
  { key: 'compare', label: 'Compare' },
  { key: 'report', label: 'Report' },
]

// Output formats an SDK can return (ids match the backend's OutputFormat).
export const OUTPUT_FORMATS = {
  markdown: { label: 'Markdown', ext: 'md' },
  json: { label: 'JSON', ext: 'json' },
  html: { label: 'HTML', ext: 'html' },
  text: { label: 'Plain text', ext: 'txt' },
  doctags: { label: 'DocTags', ext: 'doctags' },
  xhtml: { label: 'XHTML', ext: 'xhtml' },
  metadata: { label: 'Metadata JSON', ext: 'meta.json' },
}
