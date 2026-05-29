import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cidadao/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/cidadao/"!</div>
}
