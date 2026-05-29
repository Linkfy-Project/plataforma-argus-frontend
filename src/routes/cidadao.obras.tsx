import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cidadao/obras')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/cidadao/obras"!</div>
}
