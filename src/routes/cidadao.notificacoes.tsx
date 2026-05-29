import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/cidadao/notificacoes')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/cidadao/notificacoes"!</div>
}
