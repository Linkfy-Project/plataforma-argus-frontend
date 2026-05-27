/**
 * Helpers centralizados do Índice Composto de Eficiência ARGUS.
 *
 * Pilares e pesos oficiais:
 *   - Custo Paramétrico           30%
 *   - Prazo / Cronograma          25%
 *   - Qualidade Técnica/Aditivos  20%
 *   - Recorrência Territorial     15%
 *   - Impacto Socioeconômico      10%
 *
 * O multiplicador de criticidade é aplicado quando IDH < 0,600.
 */
export type RiskLevel = "Eficiente" | "Atenção" | "Alto risco" | "Crítico";

export const ARGUS_PILLARS = [
  { key: "cost", label: "Custo Paramétrico", weight: 0.30, scoreField: "cost_score" as const },
  { key: "deadline", label: "Prazo / Cronograma", weight: 0.25, scoreField: "deadline_score" as const },
  { key: "quality", label: "Qualidade Técnica e Aditivos", weight: 0.20, scoreField: "quality_score" as const },
  { key: "recurrence", label: "Recorrência Territorial", weight: 0.15, scoreField: "recurrence_score" as const },
  { key: "social", label: "Impacto Socioeconômico", weight: 0.10, scoreField: "social_impact_score" as const },
] as const;

export const IDH_CRITICAL_THRESHOLD = 0.6;

export function getRiskLevel(score: number | null | undefined): RiskLevel {
  const s = score ?? 0;
  if (s >= 80) return "Eficiente";
  if (s >= 60) return "Atenção";
  if (s >= 40) return "Alto risco";
  return "Crítico";
}

export function getScoreLabel(score: number | null | undefined): string {
  return getRiskLevel(score);
}

/** Classe Tailwind para cor de fundo/texto consistente. */
export function getScoreClasses(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 80) return "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
  if (s >= 60) return "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30";
  if (s >= 40) return "bg-orange-500/15 text-orange-600 border-orange-500/30";
  return "bg-destructive/10 text-destructive border-destructive/30";
}

/** Cor hex usada em charts / map markers. */
export function getScoreHex(score: number | null | undefined): string {
  const s = score ?? 0;
  if (s >= 80) return "#22C55E";
  if (s >= 60) return "#F59E0B";
  if (s >= 40) return "#F97316";
  return "#DC2626";
}

/** Faz o download de uma URL forçando um filename amigável. */
export async function downloadFile(url: string, filename: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

/** Converte qualquer erro Axios/fetch em mensagem amigável em PT-BR. */
export function normalizeApiError(err: unknown): string {
  const e = err as { code?: string; message?: string; response?: { status?: number } };
  if (!e) return "Erro desconhecido ao comunicar com a API ARGUS.";
  if (e.code === "ECONNABORTED" || /timeout/i.test(e.message ?? "")) {
    return "A API está inicializando no Render. Aguarde alguns segundos e tente novamente.";
  }
  if (e.response?.status && e.response.status >= 500) {
    return "A API ARGUS está temporariamente indisponível. Tente novamente em instantes.";
  }
  if (e.response?.status === 404) return "Recurso não encontrado na API ARGUS.";
  if (e.message) return e.message;
  return "Não foi possível carregar os dados da API ARGUS.";
}