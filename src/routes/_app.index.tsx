/**
 * Rota raiz do layout _app.
 * Redireciona automaticamente "/" para "/dashboard" (Painel Executivo).
 */
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
});
