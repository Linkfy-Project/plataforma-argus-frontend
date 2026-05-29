import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cidadao/transparencia')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/cidadao/transparencia"!</div>
}
