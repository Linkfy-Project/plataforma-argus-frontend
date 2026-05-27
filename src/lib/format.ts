export const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v ?? 0);

export const fmtBRLFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v ?? 0);

export const fmtPct = (v: number) => `${Math.round(v ?? 0)}%`;

export const fmtDate = (iso: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
};

export const fmtNumber = (v: number) =>
  new Intl.NumberFormat("pt-BR").format(v ?? 0);

/* ---------------------------- aliases públicos ---------------------------- */

export const formatCurrencyBRL = (v?: number | null): string =>
  v == null ? "Não disponível" : fmtBRL(v);

export const formatDateBR = (v?: string | null): string =>
  v == null || v === "" ? "Não disponível" : fmtDate(v);

export const formatNumber = (v?: number | null): string =>
  v == null ? "Não disponível" : fmtNumber(v);

export const formatPercent = (v?: number | null): string =>
  v == null ? "Não disponível" : `${Math.round(v)}%`;

export const formatRatio = (v?: number | null): string =>
  v == null ? "Não disponível" : `${Math.round(v * 100)}%`;