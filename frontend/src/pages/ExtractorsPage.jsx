import { Info, Plus } from 'lucide-react'
import { SdkCard } from '@/components/features/sdk/SdkCard'
import { KindIcon, PageHeader } from '@/components/ui/domain'
import { ButtonLink, Card, Skeleton } from '@/components/ui/primitives'
import { FILE_KINDS } from '@/constants/app'
import { useSdks } from '@/hooks/queries'

function FormatMatrix({ sdks }) {
  const kinds = Object.keys(FILE_KINDS).filter((k) => !['zip', 'other'].includes(k))
  return (
    <Card className="mt-8 overflow-hidden">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-[15px] font-semibold text-fg">Format support matrix</h2>
        <p className="text-sm text-fg-3">Which extractor can open which file type. ZIP archives are unpacked by X-tractor before any SDK runs.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-2/60 text-left text-xs text-fg-3">
              <th className="sticky left-0 bg-surface-2 px-5 py-2.5 font-medium">Format</th>
              {sdks.map((sdk) => (
                <th key={sdk.name} className="px-3 py-2.5 text-center font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: sdk.color }} />
                    {sdk.display_name}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {kinds.map((kind) => (
              <tr key={kind} className="border-t border-border">
                <td className="sticky left-0 bg-surface px-5 py-2 whitespace-nowrap">
                  <span className="inline-flex items-center gap-2 text-fg-2">
                    <KindIcon kind={kind} />
                    {FILE_KINDS[kind].label} <span className="font-mono text-xs text-fg-3">.{kind}</span>
                  </span>
                </td>
                {sdks.map((sdk) => {
                  const ok = sdk.supported_kinds.includes(kind)
                  return (
                    <td key={sdk.name} className="px-3 py-2 text-center">
                      {ok ? (
                        <span className="inline-grid size-5 place-items-center rounded-full text-[11px] font-bold text-white" style={{ background: sdk.color }}>
                          ✓
                        </span>
                      ) : (
                        <span className="text-fg-3">–</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

export default function ExtractorsPage() {
  const { data, isLoading } = useSdks()
  const sdks = data?.items ?? []

  return (
    <>
      <PageHeader
        eyebrow="Extractors"
        title="Five ways to read a document"
        description="Each SDK takes a different approach — from plain text layers to AI layout models. Compare their strengths before you run them."
        actions={<ButtonLink to="/jobs/new" icon={Plus}>Test them</ButtonLink>}
      />
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-border bg-surface-2/60 px-4 py-3 text-sm text-fg-2">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          Capability percentages are editorial ratings from each SDK’s documentation and public benchmarks. The measured numbers on each
          extractor’s page come from your own runs.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {isLoading
          ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[440px] rounded-2xl" />)
          : sdks.map((sdk, index) => <SdkCard key={sdk.name} sdk={sdk} index={index} />)}
      </div>
      {sdks.length ? <FormatMatrix sdks={sdks} /> : null}
    </>
  )
}
