/**
 * Utilitários de formatação centralizados da Plataforma ARGUS.
 *
 * Todas as formatações seguem o locale pt-BR:
 * - Moeda: R$ 1.234.567 (BRL, sem casas decimais por padrão)
 * - Datas: DD/MM/AAAA
 * - Percentuais: 85,3% (vírgula como separador decimal)
 * - Scores: "52/100"
 * - Números: 1.234.567 (ponto como separador de milhar)
 */

/* ------------------------------ Moeda BRL --------------------------------- */

/** Formata valor como moeda BRL sem casas decimais: R$ 1.234.567 */
export const fmtBRL = (v: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(v ?? 0);

/** Formata valor como moeda BRL com 2 casas decimais: R$ 1.234.567,89 */
export const fmtBRLFull = (v: number): string =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(v ?? 0);

/** Formata valor como moeda BRL compacta: R$ 1,2 mi */
export const fmtBRLCompact = (v: number): string => {
  if (v >= 1_000_000_000) {
    return `R$ ${(v / 1_000_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  }
  if (v >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (v >= 1_000) {
    return `R$ ${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return fmtBRL(v);
};

/* ----------------------------- Percentuais -------------------------------- */

/** Formata percentual com vírgula: 85% */
export const fmtPct = (v: number): string => `${Math.round(v ?? 0)}%`;

/** Formata percentual com 1 casa decimal e vírgula: 85,3% */
export const fmtPctDec = (v: number): string =>
  `${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

/* -------------------------------- Datas ----------------------------------- */

/** Formata data ISO para pt-BR: 07/06/2026 */
export const fmtDate = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

/** Formata data e hora ISO para pt-BR: 07/06/2026 04:30 */
export const fmtDateTime = (iso: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return (
    d.toLocaleDateString("pt-BR") +
    " " +
    d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
  );
};

/* -------------------------------- Números --------------------------------- */

/** Formata número inteiro com separador de milhar: 1.234.567 */
export const fmtNumber = (v: number): string => new Intl.NumberFormat("pt-BR").format(v ?? 0);

/* -------------------------------- Scores ---------------------------------- */

/** Formata score como fração de 100: "52/100" */
export const fmtScore = (v: number | null | undefined): string => {
  if (v == null || Number.isNaN(v)) return "—/100";
  return `${Math.round(v)}/100`;
};

/* ---------------------------- Aliases públicos ----------------------------- */

/** Alias com tratamento de null — retorna "Não disponível" se nulo. */
export const formatCurrencyBRL = (v?: number | null): string =>
  v == null ? "Não disponível" : fmtBRL(v);

/** Alias com tratamento de null — retorna "Não disponível" se nulo/vazio. */
export const formatDateBR = (v?: string | null): string =>
  v == null || v === "" ? "Não disponível" : fmtDate(v);

/** Alias com tratamento de null — retorna "Não disponível" se nulo. */
export const formatNumber = (v?: number | null): string =>
  v == null ? "Não disponível" : fmtNumber(v);

/** Alias com tratamento de null — retorna "Não disponível" se nulo. */
export const formatPercent = (v?: number | null): string =>
  v == null ? "Não disponível" : `${Math.round(v)}%`;

/** Formata ratio (0-1) como percentual: 0.85 → "85%" */
export const formatRatio = (v?: number | null): string =>
  v == null ? "Não disponível" : `${Math.round(v * 100)}%`;

/** Alias com tratamento de null para score — retorna "—/100" se nulo. */
export const formatScore = (v?: number | null): string => fmtScore(v ?? null);

/* ----------------------- Truncamento inteligente --------------------------- */

/**
 * Trunca texto longo para um título resumido (~60 caracteres).
 * - Se o texto for <= 60 caracteres, retorna como está.
 * - Caso contrário, corta na última palavra inteira antes do limite e adiciona "...".
 * @param text Texto original (pode ser null/undefined)
 * @returns Título resumido
 */
export const truncateToTitle = (text: string | null | undefined, maxLen = 60): string => {
  if (!text) return "—";
  const trimmed = text.trim();
  if (trimmed.length <= maxLen) return trimmed;
  // Corta no limite e encontra o último espaço para não partir palavras
  const truncated = trimmed.substring(0, maxLen - 3);
  const lastSpace = truncated.lastIndexOf(" ");
  // Se encontrou um espaço razoável (não muito curto), corta nele
  if (lastSpace > 20) {
    return truncated.substring(0, lastSpace) + "...";
  }
  return truncated + "...";
};
