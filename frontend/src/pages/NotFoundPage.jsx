import { Compass } from 'lucide-react'
import { ButtonLink, Card, EmptyState } from '@/components/ui/primitives'

export default function NotFoundPage() {
  return (
    <Card>
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="The page you are looking for does not exist or was moved."
        action={<ButtonLink to="/dashboard">Go to dashboard</ButtonLink>}
      />
    </Card>
  )
}
