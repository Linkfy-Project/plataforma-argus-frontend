// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Code splitting: separa vendors em chunks independentes para melhor cache do browser.
  // Quando o código da app muda, apenas os chunks da app são re-baixados.
  // Usa função (não objeto) para evitar erro no SSR build onde react/recharts são externalizados.
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (id.includes("/react/") || id.includes("/react-dom/"))
              return "vendor-react";
            if (id.includes("/recharts/") || id.includes("/d3-"))
              return "vendor-recharts";
            if (id.includes("/@radix-ui/")) return "vendor-radix";
            if (id.includes("/lucide-react/")) return "vendor-icons";
            if (id.includes("/@tanstack/react-router/") || id.includes("/@tanstack/react-query/") || id.includes("/@tanstack/query-sync-storage-persister/") || id.includes("/@tanstack/react-query-persist-client/"))
              return "vendor-tanstack";
          },
        },
      },
    },
  },
});
