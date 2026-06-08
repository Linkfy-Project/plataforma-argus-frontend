import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

/* Layout principal da plataforma com sidebar fixa */
function AppLayout() {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Sidebar fixa - não rola com o conteúdo */}
      <Sidebar />
      {/* Coluna principal com scroll independente */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar />
        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
