import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { routeTree } from "./routeTree.gen";

// Persister que salva o cache do React Query no localStorage do navegador.
// Isso permite que o usuário veja os dados instantaneamente ao voltar ao site,
// enquanto o React Query atualiza em background (stale-while-revalidate).
export const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "argus-query-cache",
});

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Retry 2 vezes com delay exponencial (backend mantido acordado pelo UptimeRobot)
        retry: 2,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10_000),
        // Dados ficam "frescos" por 60s (não refetch)
        staleTime: 60_000,
        // Dados persistem no cache por 24 horas (gcTime substitui cacheTime no v5)
        gcTime: 24 * 60 * 60 * 1000,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Preload de rotas no hover considera dados "frescos" por 30s (evita refetch desnecessário)
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
