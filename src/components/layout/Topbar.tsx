import { useState } from "react";
import { Bell, Menu, RefreshCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/Sidebar";

const titleMap: Record<string, string> = {
  "/dashboard": "Painel Geral",
  "/obras": "Obras Públicas",
  "/municipios": "Municípios",
  "/contratos": "Contratos",
  "/alertas": "Alertas e Riscos",
  "/relatorios": "Relatórios",
  "/configuracoes": "Configurações",
};

export function Topbar() {
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const baseKey = "/" + (pathname.split("/")[1] ?? "");
  const title = titleMap[baseKey] ?? "Plataforma Argus";
  const [openMobile, setOpenMobile] = useState(false);

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-[color:var(--sidebar-bg)] px-4 text-white md:px-6">
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetTrigger asChild>
          <button
            className="rounded-md p-2 text-white/80 hover:bg-white/10 md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-0 bg-[color:var(--sidebar-deep)] p-0 text-white">
          <SheetTitle className="sr-only">Menu de navegação</SheetTitle>
          <SidebarNav onNavigate={() => setOpenMobile(false)} />
        </SheetContent>
      </Sheet>
      <h2 className="text-base font-semibold truncate">{title}</h2>
      <div className="relative ml-auto hidden w-full max-w-md md:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
        <Input
          placeholder="Buscar obras, municípios ou contratos..."
          className="h-9 border-white/10 bg-white/10 pl-9 text-sm text-white placeholder:text-white/50 focus-visible:ring-[color:var(--sidebar-accent-hl)]"
        />
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="hidden text-white hover:bg-white/10 sm:inline-flex md:ml-0"
        onClick={() => qc.invalidateQueries()}
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        <span className="hidden lg:inline">Atualizar</span>
      </Button>
      <button
        className="relative ml-auto rounded-md p-2 text-white/80 hover:bg-white/10 sm:ml-0"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[color:var(--sidebar-accent-hl)]" />
      </button>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--sidebar-accent-hl)] text-sm font-semibold text-[color:var(--sidebar-deep)]">
        AD
      </div>
    </header>
  );
}