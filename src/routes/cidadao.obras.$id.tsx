import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cidadao/obras/$id')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/cidadao/obras/$id"!</div>
}
