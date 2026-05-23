import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, HardHat, Building2, FileText, AlertTriangle, BarChart3, Settings, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Painel", icon: LayoutDashboard },
  { to: "/obras", label: "Obras", icon: HardHat },
  { to: "/municipios", label: "Municípios", icon: Building2 },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/alertas", label: "Alertas", icon: AlertTriangle },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
] as const;

export function Sidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-[color:var(--sidebar-deep)] text-[color:var(--sidebar-fg)]">
      <div className="flex h-16 items-center gap-2 border-b border-white/5 px-6">
        <Shield className="h-6 w-6 text-[color:var(--sidebar-accent-hl)]" />
        <div>
          <p className="text-lg font-bold tracking-wider text-[color:var(--sidebar-accent-hl)]">ARGUS</p>
          <p className="text-[10px] uppercase tracking-widest text-white/50">Obras Públicas</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 px-3 py-4">
        {items.map((item) => {
          const active = pathname === item.to || pathname.startsWith(item.to + "/");
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-white/70 hover:bg-white/5 hover:text-white",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/5 px-6 py-4 text-xs text-white/40">
        © {new Date().getFullYear()} Plataforma Argus
      </div>
    </aside>
  );
}