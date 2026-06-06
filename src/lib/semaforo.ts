/**
 * Helper de semáforo compartilhado para o Portal do Cidadão.
 * Mapeia o score de eficiência (0–100) em cores e rótulos amigáveis.
 */

export interface SemaforoInfo {
  label: string;
  color: string;
  bg: string;
  emoji: string;
}

/**
 * Retorna informações visuais do semáforo baseado no score de eficiência.
 * @param score - Score de eficiência (0–100), pode ser null/undefined
 * @returns Objeto com label, classe de cor, classe de background e emoji
 */
export function getSemaforo(score: number | null | undefined): SemaforoInfo {
  if (score == null)
    return {
      label: "Sem dados",
      color: "text-muted-foreground",
      bg: "bg-muted",
      emoji: "⚪",
    };
  if (score >= 60)
    return {
      label: "Em dia",
      color: "text-green-700",
      bg: "bg-green-100 border-green-300",
      emoji: "🟢",
    };
  if (score >= 40)
    return {
      label: "Atenção",
      color: "text-yellow-700",
      bg: "bg-yellow-100 border-yellow-300",
      emoji: "🟡",
    };
  return {
    label: "Problema",
    color: "text-red-700",
    bg: "bg-red-100 border-red-300",
    emoji: "🔴",
  };
}

/**
 * Formata uma data ISO em "Mês Ano" amigável em português.
 * Ex: "Dezembro 2026"
 */
export function fmtMonthYear(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/**
 * Mensagem descritiva da situação da obra baseada no status.
 */
export function getSituacaoMensagem(status: string | null | undefined): {
  mensagem: string;
  icone: string;
  cor: string;
} {
  const s = (status ?? "").toLowerCase();
  if (s.includes("andamento"))
    return { mensagem: "Esta obra está em andamento.", icone: "🚧", cor: "text-blue-700" };
  if (s.includes("paralisad"))
    return {
      mensagem: "⚠️ Esta obra está paralisada. Acompanhe as atualizações.",
      icone: "⚠️",
      cor: "text-orange-700",
    };
  if (s.includes("concluíd") || s.includes("concluid"))
    return {
      mensagem: "✅ Esta obra foi concluída com sucesso.",
      icone: "✅",
      cor: "text-green-700",
    };
  if (s.includes("atrasad"))
    return {
      mensagem: "⚠️ Esta obra está com atraso em relação ao prazo original.",
      icone: "⚠️",
      cor: "text-red-700",
    };
  if (s.includes("planejad"))
    return {
      mensagem: "Esta obra está na fase de planejamento.",
      icone: "📋",
      cor: "text-gray-600",
    };
  return { mensagem: "Situação não informada.", icone: "❓", cor: "text-muted-foreground" };
}
