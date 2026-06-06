/**
 * Helpers centralizados do Índice Composto de Eficiência ARGUS.
 *
 * Pilares e pesos oficiais (v2 — com ML Risk Score):
 *   - Custo Paramétrico           25%
 *   - Prazo / Cronograma          25%
 *   - Qualidade Técnica/Aditivos  20%
 *   - Recorrência Territorial     10%
 *   - Impacto Socioeconômico       5%
 *   - ML Risk Score               15%
 *
 * O multiplicador de criticidade é aplicado quando IDH < 0,600.
 */
export type RiskLevel =
  | "Baixo"
  | "Atenção"
  | "Alto"
  | "Crítico"
  | "Indefinido";

export const ARGUS_PILLARS = [
  { key: "cost", label: "Custo Paramétrico", weight: 0.25, scoreField: "cost_score" as const },
  { key: "deadline", label: "Prazo / Cronograma", weight: 0.25, scoreField: "deadline_score" as const },
  { key: "quality", label: "Qualidade Técnica e Aditivos", weight: 0.20, scoreField: "quality_score" as const },
  { key: "recurrence", label: "Recorrência Territorial", weight: 0.10, scoreField: "recurrence_score" as const },
  { key: "social", label: "Impacto Socioeconômico", weight: 0.05, scoreField: "social_impact_score" as const },
  { key: "ml_risk", label: "ML Risk Score", weight: 0.15, scoreField: "risk_delay_probability" as const },
] as const;

export const IDH_CRITICAL_THRESHOLD = 0.6;

/** Faixa textual de risco — ver Metodologia ARGUS. */
export function getRiskLevel(score: number | null | undefined): RiskLevel {
  if (score == null || Number.isNaN(score)) return "Indefinido";
  if (score >= 80) return "Baixo";
  if (score >= 60) return "Atenção";
  if (score >= 40) return "Alto";
  return "Crítico";
}

export function getScoreLabel(score: number | null | undefined): string {
  return getRiskLevel(score);
}

export function getRiskDescription(score: number | null | undefined): string {
  switch (getRiskLevel(score)) {
    case "Baixo":
      return "Obra eficiente — indicadores dentro dos parâmetros esperados.";
    case "Atenção":
      return "Obra requer monitoramento ativo — risco moderado detectado.";
    case "Alto":
      return "Obra com sinais relevantes de risco — necessita revisão.";
    case "Crítico":
      return "Obra em situação crítica — recomendada auditoria imediata.";
    default:
      return "Score ainda não calculado para esta obra.";
  }
}

/** Classe Tailwind para cor de fundo/texto consistente. */
export function getScoreClasses(score: number | null | undefined): string {
  switch (getRiskLevel(score)) {
    case "Baixo":
      return "bg-[color:var(--success)]/15 text-[color:var(--success)] border-[color:var(--success)]/30";
    case "Atenção":
      return "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30";
    case "Alto":
      return "bg-orange-500/15 text-orange-600 border-orange-500/30";
    case "Crítico":
      return "bg-destructive/10 text-destructive border-destructive/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export const getScoreColorClass = getScoreClasses;

/** Cor hex usada em charts / map markers. */
export function getScoreHex(score: number | null | undefined): string {
  switch (getRiskLevel(score)) {
    case "Baixo": return "#22C55E";
    case "Atenção": return "#F59E0B";
    case "Alto": return "#F97316";
    case "Crítico": return "#DC2626";
    default: return "#94A3B8";
  }
}

/* --------------------------- Severidade de alertas ------------------------- */

export type SeverityKey = "critical" | "alert" | "warning" | "info";

export function getSeverityKey(severity: string): SeverityKey {
  const s = (severity ?? "").toLowerCase();
  if (s === "critical" || s === "danger" || s === "crítico") return "critical";
  if (s === "alert" || s === "high" || s === "alto") return "alert";
  if (s === "warning" || s === "warn" || s === "atenção" || s === "medium") return "warning";
  return "info";
}

export function getSeverityLabel(severity: string): string {
  switch (getSeverityKey(severity)) {
    case "critical": return "Crítico";
    case "alert": return "Alerta";
    case "warning": return "Atenção";
    default: return "Informativo";
  }
}

export function getSeverityColorClass(severity: string): string {
  switch (getSeverityKey(severity)) {
    case "critical":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "alert":
      return "bg-orange-500/15 text-orange-600 border-orange-500/30";
    case "warning":
      return "bg-[color:var(--warning)]/15 text-[color:var(--warning)] border-[color:var(--warning)]/30";
    default:
      return "bg-primary/10 text-primary border-primary/30";
  }
}

export function formatSeverityMultiplier(multiplier: number): string {
  if (!multiplier || multiplier === 1) return "1.0×";
  return `${multiplier.toFixed(1)}×`;
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