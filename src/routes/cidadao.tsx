import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { alertasService } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/cidadao")({
  component: CidadaoLayout,
});

const NAV_ITEMS = [
  { href: "/cidadao", label: "Mapa", exact: true },
  { href: "/cidadao/obras", label: "Obras", exact: false },
  { href: "/cidadao/transparencia", label: "Como funciona", exact: false },
  { href: "/cidadao/notificacoes", label: "Alertas", exact: false },
];

function CidadaoLayout() {
  const location = useLocation();
  const queryClient = useQueryClient();

  // Count unread alerts for the badge
  const { data: alertas } = useQuery({
    queryKey: ["cidadao-alertas-count"],
    queryFn: () => alertasService.list(),
    staleTime: 5 * 60_000,
  });
  const alertCount = alertas?.length ?? 0;
  const criticalCount = alertas?.filter((a) => a.nivel === "Crítico" || a.nivel === "Alto").length ?? 0;

  const isActive = (href: string, exact: boolean) => {
    if (exact) return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["cidadao"] });
    queryClient.invalidateQueries({ queryKey: ["cidadao-obras"] });
    queryClient.invalidateQueries({ queryKey: ["cidadao-notificacoes"] });
    queryClient.invalidateQueries({ queryKey: ["cidadao-alertas-count"] });
    queryClient.invalidateQueries({ queryKey: ["transparencia"] });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header público */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur supports-backdrop-blur:bg-card/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/cidadao" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-sm">
              A
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">ARGUS</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Portal do Cidadão</p>
            </div>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href as any}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive(item.href, item.exact)
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ))}
            <div className="ml-1 h-5 w-px bg-border" />
            <Link
              to="/cidadao/notificacoes"
              className="relative ml-1 rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title="Notificações"
            >
              <Bell className="h-4 w-4" />
              {criticalCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                  {criticalCount > 9 ? "9+" : criticalCount}
                </span>
              )}
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="rounded-md p-2 text-muted-foreground"
              title="Atualizar dados"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="ml-1 h-5 w-px bg-border" />
            <Link
              to="/login"
              className="ml-1 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Acesso Gestor
            </Link>
          </nav>
        </div>
      </header>

      {/* Conteúdo */}
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                  A
                </div>
                <span className="text-sm font-bold text-foreground">ARGUS</span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                Plataforma de Monitoramento de Obras Públicas. Transparência e
                eficiência na gestão de recursos públicos.
              </p>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Navegação
              </h4>
              <ul className="space-y-2">
                <li>
                  <Link to="/cidadao" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Mapa
                  </Link>
                </li>
                <li>
                  <Link to="/cidadao/obras" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Obras públicas
                  </Link>
                </li>
                <li>
                  <Link to="/cidadao/transparencia" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Como funciona
                  </Link>
                </li>
                <li>
                  <Link to="/cidadao/notificacoes" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Alertas
                  </Link>
                </li>
                <li>
                  <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    Painel do gestor
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                Sobre
              </h4>
              <ul className="space-y-2">
                <li className="text-sm text-muted-foreground">Hackathon Duopen 2026</li>
                <li className="text-sm text-muted-foreground">Dados: TCE-RJ · CREA-RJ · IBGE</li>
                <li className="text-sm text-muted-foreground">v1.0 — Argus Platform</li>
              </ul>
            </div>
          </div>
          <div className="mt-6 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            <p>ARGUS — Plataforma de Monitoramento de Obras Públicas</p>
            <p className="mt-0.5">Transparência e eficiência na gestão de obras públicas</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
