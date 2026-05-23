import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar — Plataforma Argus" }] }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-[color:var(--sidebar-deep)] px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[color:var(--sidebar-bg)] p-8 shadow-2xl">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[color:var(--sidebar-accent-hl)]/15">
            <Shield className="h-6 w-6 text-[color:var(--sidebar-accent-hl)]" />
          </div>
          <h1 className="text-3xl font-bold tracking-widest text-[color:var(--sidebar-accent-hl)]">ARGUS</h1>
          <p className="text-sm text-white/60">Inteligência para Obras Públicas</p>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/dashboard" });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-white/80">E-mail</Label>
            <Input id="email" type="email" placeholder="seu.email@municipio.rj.gov.br"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="senha" className="text-white/80">Senha</Label>
            <Input id="senha" type="password" placeholder="••••••••"
              className="border-white/10 bg-white/5 text-white placeholder:text-white/40" />
          </div>
          <Button type="submit" className="w-full bg-primary hover:bg-primary/90">Entrar</Button>
          <div className="text-center">
            <a href="#" className="text-xs text-[color:var(--sidebar-accent-hl)] hover:underline">
              Esqueci minha senha
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}