import { Skeleton, Spinner } from './primitives'

export function PageFallback() {
  return (
    <div className="space-y-4" aria-busy="true">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-4 w-96 max-w-full" />
      <div className="grid gap-4 pt-4 md:grid-cols-3">
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    </div>
  )
}

export function ScreenFallback() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner className="size-6" />
    </div>
  )
}
