/**
 * Camada HTTP da Plataforma ARGUS.
 *
 * Organizada por domínio de serviço. Cada service é um objeto exportado
 * com métodos que encapsulam chamadas ao backend FastAPI.
 *
 * ==========================================================================
 * SERVIÇOS (por domínio):
 *   healthService       — Health check da API
 *   dashboardService    — Dashboard Executivo (summary, priority queue, riscos)
 *   analyticsService    — Analytics legado (summary, rankings, map, trends)
 *   worksService        — Obras (CRUD, recomputação, score explain)
 *   obrasService        — Adaptação legacy (obras → domínio frontend)
 *   municipiosService   — Municípios derivados de obras
 *   territoryService    — Análise territorial Macaé-RJ
 *   alertasService      — Alertas com workflow (novo + legado)
 *   contratosService    — Contratos (novo + legado)
 *   fornecedoresService — Ranking e detalhe de fornecedores
 *   etlService          — ETL e sincronização de dados
 *   geoService          — Camadas geográficas
 *   mlService           — Machine Learning
 *   exportsService      — Exportação CSV/XLSX
 * ==========================================================================
 */

import axios, { AxiosError } from "axios";
import { mockObras, mockMunicipios, mockContratos, mockAlertas, mockSummary } from "@/data/mock";
import type {
  Obra,
  Municipio,
  Contrato,
  Alerta,
  AlertaNivel,
  DashboardSummary,
  WorkRead,
  AlertRead,
  AnalyticsSummary,
  AnalyticsRankings,
  ScoreExplain,
  ScoringRules,
  SyncStatus,
  PaginatedWorks,
  DashboardExecutiveSummary,
  PriorityQueueItem,
  RiskDistributionItem,
  TerritoryOverview,
  NeighborhoodListItem,
  NeighborhoodDetail,
  HeatmapResponse,
  DataQualityReport,
  SupplierRankingItem,
  SupplierDetailRead,
  ContractItem,
  ContractDetailRead,
  AlertWorkflowItem,
  AlertStatusValue,
} from "@/types";

/* ========================================================================== */
/* Tipos auxiliares exportados                                                */
/* ========================================================================== */

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: string; coordinates: [number, number] | number[] };
    properties: {
      id: number;
      municipio: string;
      score: number | null;
      objeto: string;
      contratado: string | null;
      [key: string]: unknown;
    };
  }>;
};

export interface TrendPoint {
  month: string;
  avg_score: number;
  count: number;
  total_value: number;
}

export interface InterMunicipalData {
  municipio: string;
  total_works: number;
  avg_score: number;
  total_value: number;
  avg_delay_risk: number;
}

/* ========================================================================== */
/* Configuração HTTP                                                          */
/* ========================================================================== */

/**
 * Por padrão usamos o proxy interno (`/api/argus`) para evitar problemas
 * de CORS com o backend hospedado no Render. Caso seja necessário apontar
 * para outro backend, defina `VITE_API_BASE_URL`.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api/argus";

export const USE_MOCK = String(import.meta.env.VITE_USE_MOCK ?? "").toLowerCase() === "true";

/** Render free pode levar ~50s para acordar (cold start). */
const COLD_START_TIMEOUT_MS = 90_000;

const ROOT = API_BASE_URL.replace(/\/$/, "");
const IS_ABSOLUTE = /^https?:\/\//i.test(ROOT);

export const api = axios.create({
  baseURL: `${ROOT}/api/v1`,
  timeout: COLD_START_TIMEOUT_MS,
  headers: { Accept: "application/json" },
});

api.interceptors.response.use(
  (r) => r,
  (error: AxiosError) => {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn(
        "[Argus API]",
        error?.config?.method?.toUpperCase(),
        error?.config?.url,
        error?.message,
      );
    }
    return Promise.reject(error);
  },
);

/**
 * Executa `fn`. Quando `VITE_USE_MOCK=true`, devolve o `mockValue` em vez
 * de chamar a API. Em produção (`USE_MOCK=false`) os erros sobem para o
 * React Query — nunca substituímos silenciosamente dados reais por mocks.
 */
async function callOrMock<T>(fn: () => Promise<T>, mockValue: T): Promise<T> {
  if (USE_MOCK) return mockValue;
  return await fn();
}

/**
 * Tenta executar `newFn`. Se retornar 404 ou erro, cai para `fallbackFn`.
 * Usado para endpoints novos que ainda podem não existir no backend.
 */
async function withFallback<T>(newFn: () => Promise<T>, fallbackFn: () => Promise<T>): Promise<T> {
  try {
    return await newFn();
  } catch (err) {
    const axiosErr = err as { response?: { status?: number } };
    if (axiosErr?.response?.status === 404) {
      console.warn("[Argus API] Endpoint não encontrado, usando fallback de compatibilidade.");
      return await fallbackFn();
    }
    throw err;
  }
}

/* ========================================================================== */
/* Adaptadores: WorkRead (backend) -> Obra (domínio do frontend)              */
/* ========================================================================== */

const SEVERITY_TO_NIVEL: Record<string, AlertaNivel> = {
  info: "Baixo",
  low: "Baixo",
  warning: "Médio",
  alert: "Alto",
  high: "Alto",
  critical: "Crítico",
  danger: "Crítico",
};

function severityToNivel(s: string): AlertaNivel {
  return SEVERITY_TO_NIVEL[s?.toLowerCase()] ?? "Médio";
}

function deriveStatus(w: WorkRead): Obra["status"] {
  if (w.status) return w.status;
  if (w.finished_at) return "Concluída";
  if (w.due_at && new Date(w.due_at) < new Date()) return "Atrasada";
  if (w.signed_at) return "Em andamento";
  return "Planejada";
}

function executed(w: WorkRead): number {
  return w.paid_value ?? w.settled_value ?? w.committed_value ?? 0;
}

function percent(w: WorkRead): number {
  const v = w.contract_value ?? 0;
  if (!v) return 0;
  return Math.min(100, Math.round((executed(w) / v) * 100));
}

export function adaptObra(w: WorkRead): Obra {
  return {
    id: String(w.id),
    nome: w.object_description?.trim() || `Obra #${w.id}`,
    municipio: w.municipio ?? "—",
    status: deriveStatus(w),
    valor_contratado: w.contract_value ?? 0,
    valor_executado: executed(w),
    percentual_execucao: percent(w),
    data_inicio: w.signed_at ?? "",
    data_fim_prevista: w.due_at ?? "",
    orgao_responsavel: w.requesting_agency ?? w.managing_unit ?? "—",
    empresa_contratada: w.contractor_name ?? "—",
    descricao: w.object_description ?? "",
    eficiencia: w.efficiency_score ?? undefined,
    risco_atraso: w.risk_delay_probability ?? undefined,
    risco_custo: w.risk_cost_probability ?? undefined,
    risco_retrabalho: w.risk_rework_probability ?? undefined,
    cost_score: w.cost_score ?? undefined,
    deadline_score: w.deadline_score ?? undefined,
    quality_score: w.quality_score ?? undefined,
    recurrence_score: w.recurrence_score ?? undefined,
    social_impact_score: w.social_impact_score ?? undefined,
    numero_contrato: w.contract_number ?? undefined,
    bairro: w.neighborhood ?? undefined,
    endereco: w.address ?? undefined,
    latitude: w.latitude ?? undefined,
    longitude: w.longitude ?? undefined,
    crea_light_count: w.crea_light_count,
    crea_medium_count: w.crea_medium_count,
    crea_grave_count: w.crea_grave_count,
    territorial_overlap_ratio: w.territorial_overlap_ratio ?? undefined,
    benchmark_cost_m2: w.benchmark_cost_m2 ?? undefined,
  };
}

export function alertasFromWorks(works: WorkRead[]): Alerta[] {
  const out: Alerta[] = [];
  for (const w of works) {
    for (const a of w.alerts ?? []) {
      out.push({
        id: String(a.id),
        nivel: severityToNivel(a.severity),
        titulo: humanizeCode(a.code),
        descricao: a.message,
        obra_id: String(w.id),
        obra_nome: w.object_description?.trim() || `Obra #${w.id}`,
        municipio: w.municipio ?? "—",
        data_deteccao: a.created_at,
        acao_sugerida: suggestAction(a.code),
      });
    }
  }
  return out;
}

function humanizeCode(code: string): string {
  return code
    .replace(/^ALERT_/, "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function suggestAction(code: string): string {
  const c = code.toUpperCase();
  if (c.includes("RECORRENCIA"))
    return "Investigar histórico do contratado e considerar diversificação.";
  if (c.includes("ATRASO") || c.includes("PRAZO"))
    return "Solicitar replanejamento e revisar cronograma físico-financeiro.";
  if (c.includes("CUSTO") || c.includes("ADITIVO"))
    return "Auditar aditivos contratuais e justificativas de custo.";
  if (c.includes("QUALIDADE") || c.includes("RETRABALHO"))
    return "Reforçar fiscalização técnica em campo.";
  return "Encaminhar para análise da equipe de controle interno.";
}

export function contratosFromWorks(works: WorkRead[]): Contrato[] {
  return works
    .filter((w) => w.contract_number || w.contractor_name)
    .map((w) => ({
      id: String(w.id),
      numero: w.contract_number ?? `S/N-${w.id}`,
      obra_id: String(w.id),
      obra_nome: w.object_description?.trim() || `Obra #${w.id}`,
      municipio: w.municipio ?? "—",
      valor_contratado: w.contract_value ?? 0,
      valor_executado: executed(w),
      empresa: w.contractor_name ?? "—",
      data_assinatura: w.signed_at ?? "",
      status: w.finished_at ? "Encerrado" : "Vigente",
    }));
}

export function municipiosFromWorks(works: WorkRead[]): Municipio[] {
  const grouped = new Map<string, WorkRead[]>();
  for (const w of works) {
    const raw = w.municipio || "—";
    const k = normalizeMunicipioName(raw);
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(w);
  }
  return Array.from(grouped.entries()).map(([nome, ws]) => {
    const eff = avg(ws.map((w) => w.efficiency_score ?? 0).filter((v) => v > 0));
    return {
      id: nome.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      nome,
      total_obras: ws.length,
      obras_em_andamento: ws.filter((w) => !w.finished_at).length,
      obras_concluidas: ws.filter((w) => !!w.finished_at).length,
      obras_com_alerta: ws.filter((w) => (w.alerts ?? []).length > 0).length,
      valor_total: ws.reduce((s, w) => s + (w.contract_value ?? 0), 0),
      eficiencia: Math.round(eff),
    };
  });
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((s, v) => s + v, 0) / nums.length : 0;
}

/**
 * Normaliza o nome do município ignorando acentos e caixa alta/baixa.
 */
const CANONICAL_MUNICIPIO: Record<string, string> = {
  macae: "Macaé-RJ",
  "macaé": "Macaé-RJ",
};

export function normalizeMunicipioName(raw: string): string {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-–\s]+/g, " ")
    .trim()
    .toLowerCase();
  if (CANONICAL_MUNICIPIO[cleaned]) return CANONICAL_MUNICIPIO[cleaned];
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Agrupa e mescla dados intermunicipais normalizando nomes de municípios.
 */
export function mergeInterMunicipalData(list: InterMunicipalData[]): InterMunicipalData[] {
  const map = new Map<string, InterMunicipalData>();
  for (const item of list) {
    const canonical = normalizeMunicipioName(item.municipio);
    const existing = map.get(canonical);
    if (existing) {
      const totalWorks = existing.total_works + item.total_works;
      existing.total_works = totalWorks;
      existing.total_value += item.total_value;
      existing.avg_score =
        (existing.avg_score * existing.total_works + item.avg_score * item.total_works) / totalWorks;
      existing.avg_delay_risk =
        (existing.avg_delay_risk * existing.total_works + item.avg_delay_risk * item.total_works) /
        totalWorks;
    } else {
      map.set(canonical, { ...item, municipio: canonical });
    }
  }
  return Array.from(map.values());
}

function summaryFromAnalytics(s: AnalyticsSummary, works?: WorkRead[]): DashboardSummary {
  const totalContratado = works ? works.reduce((acc, w) => acc + (w.contract_value ?? 0), 0) : 0;
  const municipios = works ? new Set(works.map((w) => w.municipio)).size : 0;
  const concluidas = works ? works.filter((w) => !!w.finished_at).length : 0;
  const paralisadas = works
    ? works.filter((w) => (w.status ?? "").toLowerCase().includes("paralis")).length
    : 0;
  return {
    total_obras: s.total_works,
    obras_em_andamento: Math.max(0, s.total_works - concluidas - paralisadas),
    obras_concluidas: concluidas,
    obras_paralisadas: paralisadas,
    valor_total_contratado: totalContratado,
    municipios_monitorados: municipios,
    alertas_criticos: s.critical_alerts,
    percentual_medio_execucao: Math.round(s.average_efficiency_score),
    eficiencia_media: Math.round(s.average_efficiency_score * 100) / 100,
  };
}

/* ========================================================================== */
/* Utilitários internos para Works                                            */
/* ========================================================================== */

export interface WorksListParams {
  municipio?: string;
  min_score?: number;
  max_score?: number;
  status?: string;
  search?: string;
  min_value?: number;
  max_value?: number;
  has_score?: boolean;
  page?: number;
  per_page?: number;
}

const normalizeMunicipio = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s*-\s*rj$/, "")
    .trim();

const matchesMunicipio = (work: WorkRead, municipio?: string) => {
  if (!municipio) return true;
  const actual = normalizeMunicipio(work.municipio ?? "");
  const expected = normalizeMunicipio(municipio);
  return actual === expected || actual.includes(expected) || expected.includes(actual);
};

const toTotalPages = (total: number, perPage: number) => Math.max(1, Math.ceil(total / perPage));

function buildWorksParams(params: Omit<WorksListParams, "municipio">) {
  return {
    ...(params.min_score != null ? { min_score: params.min_score } : {}),
    ...(params.max_score != null ? { max_score: params.max_score } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.search ? { search: params.search } : {}),
    ...(params.min_value != null ? { min_value: params.min_value } : {}),
    ...(params.max_value != null ? { max_value: params.max_value } : {}),
    ...(params.has_score != null ? { has_score: params.has_score } : {}),
    page: params.page ?? 1,
    per_page: params.per_page ?? 25,
  };
}

async function fetchWorksPage(params: Omit<WorksListParams, "municipio"> = {}) {
  const { data } = await api.get<PaginatedWorks>("/works", { params: buildWorksParams(params) });
  return data;
}

async function fetchAllWorksPages(
  params: Omit<WorksListParams, "municipio" | "page" | "per_page"> = {},
) {
  const out: WorkRead[] = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const resp = await fetchWorksPage({ ...params, page, per_page: perPage });
    out.push(...resp.items);
    if (out.length >= resp.total || resp.items.length < perPage) break;
    page++;
  }
  return out;
}

function calculateSummary(works: WorkRead[]): AnalyticsSummary {
  const scores = works.map((w) => w.efficiency_score).filter((score): score is number => score != null);
  const today = new Date();
  return {
    total_works: works.length,
    average_efficiency_score: scores.length
      ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2))
      : 0,
    delayed_works: works.filter((w) => {
      if (w.status?.toLowerCase().includes("atras")) return true;
      if (!w.due_at || w.finished_at) return false;
      return new Date(w.due_at) < today;
    }).length,
    critical_alerts: works.reduce(
      (sum, w) =>
        sum +
        (w.alerts ?? []).filter((alert) =>
          ["critical", "critico", "crítico", "danger"].includes(alert.severity?.toLowerCase()),
        ).length,
      0,
    ),
  };
}

function calculateTrends(works: WorkRead[]): TrendPoint[] {
  const groups = new Map<string, { scoreSum: number; scoreCount: number; count: number; totalValue: number }>();

  for (const work of works) {
    const date = work.signed_at ?? work.created_at;
    if (!date) continue;
    const month = date.slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(month)) continue;
    const group = groups.get(month) ?? { scoreSum: 0, scoreCount: 0, count: 0, totalValue: 0 };
    group.count += 1;
    group.totalValue += work.contract_value ?? 0;
    if (work.efficiency_score != null) {
      group.scoreSum += work.efficiency_score;
      group.scoreCount += 1;
    }
    groups.set(month, group);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => ({
      month,
      avg_score: group.scoreCount ? Number((group.scoreSum / group.scoreCount).toFixed(2)) : 0,
      count: group.count,
      total_value: Number(group.totalValue.toFixed(2)),
    }));
}

/* ========================================================================== */
/* 1. healthService                                                           */
/* ========================================================================== */

export const healthService = {
  health: async (): Promise<{ status: string } | Record<string, unknown>> =>
    (
      await axios.get(IS_ABSOLUTE ? `${ROOT}/health` : `${ROOT}/health`, {
        timeout: COLD_START_TIMEOUT_MS,
      })
    ).data,
};

/* ========================================================================== */
/* 2. dashboardService — Dashboard Executivo                                  */
/* ========================================================================== */

export const dashboardService = {
  /**
   * Resumo executivo com todos os KPIs do painel.
   * Endpoint novo: GET /dashboard/summary?municipio=
   */
  executiveSummary: (municipio = "Macae") =>
    callOrMock<DashboardExecutiveSummary>(
      async () => (await api.get<DashboardExecutiveSummary>("/dashboard/summary", { params: { municipio } })).data,
      {
        municipio: "Macaé-RJ",
        ultima_atualizacao: new Date().toISOString(),
        obras_monitoradas: 0,
        valor_total_contratado: 0,
        valor_total_pago: 0,
        valor_potencial_em_risco: 0,
        obras_criticas: 0,
        obras_alto_risco: 0,
        obras_em_atencao: 0,
        obras_eficientes: 0,
        obras_atrasadas: 0,
        obras_sem_geolocalizacao: 0,
        contratos_com_aditivos_altos: 0,
        alertas_criticos: 0,
        alertas_totais: 0,
        fornecedores_monitorados: 0,
        bairros_monitorados: 0,
        score_medio: 0,
        data_quality_score: 0,
      },
    ),

  /**
   * Fila priorizada de obras que o gestor deve avaliar primeiro.
   * Endpoint novo: GET /dashboard/priority-queue?municipio=&limit=
   */
  priorityQueue: (municipio = "Macae", limit = 10) =>
    callOrMock<PriorityQueueItem[]>(
      async () =>
        (await api.get<PriorityQueueItem[]>("/dashboard/priority-queue", { params: { municipio, limit } })).data,
      [],
    ),

  /**
   * Distribuição de obras por faixa de risco.
   * Endpoint novo: GET /dashboard/risk-distribution?municipio=
   */
  riskDistribution: (municipio = "Macae") =>
    callOrMock<RiskDistributionItem[]>(
      async () =>
        (await api.get<RiskDistributionItem[]>("/dashboard/risk-distribution", { params: { municipio } })).data,
      [],
    ),

  /**
   * Ranking de bairros com maior risco.
   * Endpoint novo: GET /dashboard/top-neighborhoods-risk?municipio=&limit=
   */
  topNeighborhoodsRisk: (municipio = "Macae", limit = 10) =>
    callOrMock(
      async () =>
        (await api.get("/dashboard/top-neighborhoods-risk", { params: { municipio, limit } })).data,
      [],
    ),

  /**
   * Ranking de fornecedores com maior risco.
   * Endpoint novo: GET /dashboard/top-suppliers-risk?municipio=&limit=
   */
  topSuppliersRisk: (municipio = "Macae", limit = 10) =>
    callOrMock(
      async () =>
        (await api.get("/dashboard/top-suppliers-risk", { params: { municipio, limit } })).data,
      [],
    ),

  /**
   * Summary legado — mantém compatibilidade com páginas existentes.
   * Tenta o endpoint novo primeiro, fallback para analytics.
   */
  getSummary: async (): Promise<DashboardSummary> => {
    try {
      const [s, works] = await Promise.all([analyticsService.summary(), worksService.listAll({})]);
      return summaryFromAnalytics(s, works);
    } catch {
      return mockSummary;
    }
  },
};

/* ========================================================================== */
/* 3. analyticsService — Analytics legado                                     */
/* ========================================================================== */

export const analyticsService = {
  summary: (params: { municipio?: string } = {}) =>
    callOrMock<AnalyticsSummary>(
      async () => {
        if (!params.municipio) return (await api.get<AnalyticsSummary>("/analytics/summary")).data;
        const works = (await fetchAllWorksPages()).filter((work) =>
          matchesMunicipio(work, params.municipio),
        );
        return calculateSummary(works);
      },
      {
        total_works: mockSummary.total_obras,
        average_efficiency_score: mockSummary.percentual_medio_execucao,
        delayed_works: 0,
        critical_alerts: mockSummary.alertas_criticos,
      },
    ),
  rankings: (limit = 10) =>
    callOrMock<AnalyticsRankings>(
      async () =>
        (await api.get<AnalyticsRankings>("/analytics/rankings", { params: { limit } })).data,
      { best: [], worst: [] },
    ),
  mapGeoJson: () =>
    callOrMock<GeoFeatureCollection>(
      async () => (await api.get<GeoFeatureCollection>("/analytics/map/geojson")).data,
      { type: "FeatureCollection", features: [] },
    ),
  trends: (params: { municipio?: string } = {}) =>
    callOrMock<TrendPoint[]>(
      async () => {
        if (!params.municipio) return (await api.get<TrendPoint[]>("/analytics/trends")).data;
        const works = (await fetchAllWorksPages()).filter((work) =>
          matchesMunicipio(work, params.municipio),
        );
        return calculateTrends(works);
      },
      [],
    ),
  interMunicipal: () =>
    callOrMock<InterMunicipalData[]>(
      async () => {
        const raw = (await api.get<InterMunicipalData[]>("/analytics/inter-municipal")).data;
        return mergeInterMunicipalData(raw);
      },
      [],
    ),
};

/* ========================================================================== */
/* 4. worksService — Obras (backend raw)                                      */
/* ========================================================================== */

export const worksService = {
  /** Busca página única — retorna resposta paginada completa. */
  list: (params: WorksListParams = {}) =>
    callOrMock<PaginatedWorks>(
      async () => {
        const { municipio, page = 1, per_page = 25, ...rest } = params;
        if (!municipio) return fetchWorksPage({ ...rest, page, per_page });

        // O backend atual retorna 500 quando recebe `municipio`; buscamos sem
        // esse parâmetro e aplicamos o recorte localmente para manter a tela estável.
        const filtered = (await fetchAllWorksPages(rest)).filter((work) =>
          matchesMunicipio(work, municipio),
        );
        const start = (page - 1) * per_page;
        return {
          items: filtered.slice(start, start + per_page),
          total: filtered.length,
          page,
          per_page,
          total_pages: toTotalPages(filtered.length, per_page),
        };
      },
      { items: [], total: 0, page: 1, per_page: 25, total_pages: 0 },
    ),

  /** Busca TODAS as páginas iterando automaticamente (para agregações). */
  listAll: async (params: Omit<WorksListParams, "page" | "per_page"> = {}): Promise<WorkRead[]> => {
    const { municipio, ...rest } = params;
    const works = await fetchAllWorksPages(rest);
    return municipio ? works.filter((work) => matchesMunicipio(work, municipio)) : works;
  },
  get: (id: string | number) =>
    callOrMock<WorkRead | null>(async () => (await api.get<WorkRead>(`/works/${id}`)).data, null),
  create: async (payload: Partial<WorkRead>): Promise<WorkRead> =>
    (await api.post<WorkRead>("/works", payload)).data,
  recompute: async (id: string | number): Promise<WorkRead> =>
    (await api.post<WorkRead>(`/works/${id}/recompute`)).data,
  recomputeAll: async (): Promise<unknown> => (await api.post("/works/recompute-all")).data,
  scoreExplain: (id: string | number) =>
    callOrMock<ScoreExplain | null>(
      async () => (await api.get<ScoreExplain>(`/works/${id}/score-explain`)).data,
      null,
    ),
  scoringRules: () =>
    callOrMock<ScoringRules | null>(
      async () => (await api.get<ScoringRules>("/works/scoring/rules")).data,
      null,
    ),
};

/* ========================================================================== */
/* 5. obrasService — Adaptação legacy (obras → domínio frontend)              */
/* ========================================================================== */

export interface ObrasListParams {
  municipio?: string;
  status?: string;
  q?: string;
  page?: number;
  per_page?: number;
  min_score?: number;
  max_score?: number;
  min_value?: number;
  max_value?: number;
  has_score?: boolean;
}

export type ObrasPaginatedResult = {
  items: Obra[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
};

export const obrasService = {
  list: async (params: ObrasListParams = {}): Promise<ObrasPaginatedResult> => {
    const resp = await worksService.list({
      municipio: params.municipio,
      status: params.status,
      search: params.q,
      page: params.page ?? 1,
      per_page: params.per_page ?? 25,
      ...(params.min_score != null ? { min_score: params.min_score } : {}),
      ...(params.max_score != null ? { max_score: params.max_score } : {}),
      ...(params.min_value != null ? { min_value: params.min_value } : {}),
      ...(params.max_value != null ? { max_value: params.max_value } : {}),
      ...(params.has_score != null ? { has_score: params.has_score } : {}),
    });
    if (USE_MOCK && resp.items.length === 0) {
      return {
        items: mockObras,
        total: mockObras.length,
        page: 1,
        per_page: mockObras.length,
        total_pages: 1,
      };
    }
    return {
      items: resp.items.map(adaptObra),
      total: resp.total,
      page: resp.page,
      per_page: resp.per_page,
      total_pages: resp.total_pages,
    };
  },
  get: async (id: string): Promise<Obra | undefined> => {
    const w = await worksService.get(id);
    if (w) return adaptObra(w);
    return USE_MOCK ? mockObras.find((o) => o.id === id) : undefined;
  },
};

/* ========================================================================== */
/* 6. municipiosService                                                       */
/* ========================================================================== */

export const municipiosService = {
  list: async (): Promise<Municipio[]> => {
    const works = await worksService.listAll({});
    if (USE_MOCK && works.length === 0) return mockMunicipios;
    return municipiosFromWorks(works);
  },
};

/* ========================================================================== */
/* 7. territoryService — Análise territorial Macaé-RJ                         */
/* ========================================================================== */

export const territoryService = {
  /** Visão geral territorial. */
  macaeOverview: () =>
    callOrMock<TerritoryOverview>(
      async () => (await api.get<TerritoryOverview>("/territory/macae/overview")).data,
      {
        municipio: "Macaé-RJ",
        bairros_monitorados: 0,
        obras_monitoradas: 0,
        valor_total_contratado: 0,
        score_medio: 0,
        bairros_criticos: 0,
        obras_sem_bairro: 0,
        obras_sem_geolocalizacao: 0,
        bairro_mais_critico: "",
        bairro_maior_valor: "",
        bairro_mais_atrasos: "",
        recomendacoes: [],
      },
    ),

  /** Lista de bairros com indicadores de risco. */
  macaeNeighborhoods: () =>
    callOrMock<NeighborhoodListItem[]>(
      async () => (await api.get<NeighborhoodListItem[]>("/territory/macae/neighborhoods")).data,
      [],
    ),

  /** Detalhe de um bairro específico. */
  macaeNeighborhoodDetail: (bairro: string) =>
    callOrMock<NeighborhoodDetail | null>(
      async () =>
        (await api.get<NeighborhoodDetail>(`/territory/macae/neighborhoods/${encodeURIComponent(bairro)}`)).data,
      null,
    ),

  /** Heatmap territorial GeoJSON. */
  macaeHeatmap: () =>
    callOrMock<HeatmapResponse>(
      async () => (await api.get<HeatmapResponse>("/territory/macae/heatmap")).data,
      { type: "FeatureCollection", features: [] },
    ),

  /** Relatório de qualidade dos dados territoriais. */
  macaeDataQuality: () =>
    callOrMock<DataQualityReport>(
      async () => (await api.get<DataQualityReport>("/territory/macae/data-quality")).data,
      {
        total_obras: 0,
        obras_sem_bairro: 0,
        obras_sem_geolocalizacao: 0,
        obras_sem_valor: 0,
        obras_sem_fornecedor: 0,
        obras_sem_prazo: 0,
        data_quality_score: 0,
        obras_para_saneamento: [],
      },
    ),
};

/* ========================================================================== */
/* 8. alertasService — Alertas com workflow (novo + legado)                   */
/* ========================================================================== */

export interface AlertasListFilters {
  municipio?: string;
  severity?: string;
  status?: string;
  tipo?: string;
  bairro?: string;
  fornecedor?: string;
  obra_id?: number;
  search?: string;
}

export const alertasService = {
  /**
   * Lista alertas — retorna Alerta[] (tipo legado) para compatibilidade
   * com páginas existentes (_app.alertas, cidadao.notificacoes, etc).
   */
  list: async (_params: { nivel?: string } = {}): Promise<Alerta[]> => {
    const works = await worksService.listAll({});
    if (USE_MOCK && works.length === 0) return mockAlertas;
    return alertasFromWorks(works);
  },

  /**
   * Lista alertas do endpoint novo com filtros ricos (workflow).
   * Retorna AlertWorkflowItem[] com dados enriquecidos (status, motivo, ação sugerida).
   * Fallback: endpoint legado que deriva de worksService.listAll.
   */
  listWorkflow: async (filters: AlertasListFilters = {}): Promise<AlertWorkflowItem[]> => {
    return withFallback(
      async () => {
        const params: Record<string, unknown> = {};
        if (filters.municipio) params.municipio = filters.municipio;
        if (filters.severity) params.severity = filters.severity;
        if (filters.status) params.status = filters.status;
        if (filters.tipo) params.tipo = filters.tipo;
        if (filters.bairro) params.bairro = filters.bairro;
        if (filters.fornecedor) params.fornecedor = filters.fornecedor;
        if (filters.obra_id != null) params.obra_id = filters.obra_id;
        if (filters.search) params.search = filters.search;
        return (await api.get<AlertWorkflowItem[]>("/alerts", { params })).data;
      },
      async () => {
        const works = await worksService.listAll({});
        const alerts: AlertWorkflowItem[] = [];
        for (const w of works) {
          for (const a of w.alerts ?? []) {
            alerts.push({
              id: a.id,
              work_id: w.id,
              tipo: humanizeCode(a.code),
              code: a.code,
              severity: a.severity,
              nivel: severityToNivel(a.severity),
              status: "Novo",
              obra_nome: w.object_description?.trim() || `Obra #${w.id}`,
              municipio: w.municipio ?? null,
              bairro: w.neighborhood ?? null,
              fornecedor: w.contractor_name ?? null,
              descricao: a.message,
              motivo: null,
              acao_sugerida: suggestAction(a.code),
              data_deteccao: a.created_at,
              score_argus: w.efficiency_score ?? null,
              valor_contratado: w.contract_value ?? null,
            });
          }
        }
        return alerts.filter((a) => {
          if (filters.municipio && a.municipio !== filters.municipio) return false;
          if (filters.severity && a.severity !== filters.severity) return false;
          if (filters.status && a.status !== filters.status) return false;
          if (filters.obra_id != null && a.work_id !== filters.obra_id) return false;
          if (filters.search) {
            const k = filters.search.toLowerCase();
            const match = [a.descricao, a.code, a.obra_nome, a.municipio, a.fornecedor]
              .filter(Boolean)
              .some((v) => v!.toLowerCase().includes(k));
            if (!match) return false;
          }
          return true;
        });
      },
    );
  },

  /**
   * Atualiza status de um alerta.
   * Endpoint novo: PATCH /alerts/{id}/status
   */
  updateStatus: async (id: number, status: AlertStatusValue): Promise<AlertWorkflowItem> => {
    return (await api.patch<AlertWorkflowItem>(`/alerts/${id}/status`, { status })).data;
  },
};

/* ========================================================================== */
/* 9. contratosService — Contratos (novo + legado)                            */
/* ========================================================================== */

export interface ContratosListFilters {
  municipio?: string;
  fornecedor?: string;
  secretaria?: string;
  bairro?: string;
  status?: string;
  risco?: string;
  com_aditivo?: boolean;
  vencendo?: boolean;
  vencido?: boolean;
  search?: string;
}

export const contratosService = {
  /**
   * Lista contratos do endpoint novo com filtros ricos.
   * Fallback: endpoint legado que deriva de worksService.listAll.
   */
  list: async (filters: ContratosListFilters = {}): Promise<Contrato[]> => {
    return withFallback(
      async () => {
        const params: Record<string, unknown> = {};
        if (filters.municipio) params.municipio = filters.municipio;
        if (filters.fornecedor) params.fornecedor = filters.fornecedor;
        if (filters.secretaria) params.secretaria = filters.secretaria;
        if (filters.bairro) params.bairro = filters.bairro;
        if (filters.status) params.status = filters.status;
        if (filters.risco) params.risco = filters.risco;
        if (filters.com_aditivo != null) params.com_aditivo = filters.com_aditivo;
        if (filters.vencendo != null) params.vencendo = filters.vencendo;
        if (filters.vencido != null) params.vencido = filters.vencido;
        if (filters.search) params.search = filters.search;
        const items = (await api.get<ContractItem[]>("/contracts", { params })).data;
        // Adaptar ContractItem → Contrato (legado) para manter compatibilidade
        return items.map((c) => ({
          id: c.id,
          numero: c.numero_contrato ?? `S/N-${c.work_id}`,
          obra_id: String(c.work_id),
          obra_nome: c.obra_nome ?? c.objeto ?? `Obra #${c.work_id}`,
          municipio: c.municipio ?? "—",
          valor_contratado: c.valor_original ?? c.valor_atual ?? 0,
          valor_executado: c.valor_pago ?? 0,
          empresa: c.fornecedor ?? "—",
          data_assinatura: c.data_inicio ?? "",
          status: c.status ?? "Vigente",
        }));
      },
      // Fallback de compatibilidade
      async () => {
        const works = await worksService.listAll({});
        if (USE_MOCK && works.length === 0) return mockContratos;
        return contratosFromWorks(works);
      },
    );
  },

  /** Busca detalhe de um contrato. */
  get: async (id: string): Promise<ContractDetailRead | null> => {
    return withFallback(
      async () => (await api.get<ContractDetailRead>(`/contracts/${id}`)).data,
      async () => null,
    );
  },

  /** Lista legada (mantida para compatibilidade). */
  listLegacy: async (_params: { q?: string } = {}): Promise<Contrato[]> => {
    const works = await worksService.listAll({});
    if (USE_MOCK && works.length === 0) return mockContratos;
    return contratosFromWorks(works);
  },
};

/* ========================================================================== */
/* 10. fornecedoresService — Ranking e detalhe de fornecedores                */
/* ========================================================================== */

export interface FornecedoresRankingFilters {
  municipio?: string;
  bairro?: string;
  risco?: string;
  limit?: number;
}

export const fornecedoresService = {
  /**
   * Ranking de fornecedores ordenado por score médio (pior primeiro).
   * Endpoint novo: GET /suppliers/ranking
   */
  ranking: (filters: FornecedoresRankingFilters = {}): Promise<SupplierRankingItem[]> =>
    callOrMock<SupplierRankingItem[]>(
      async () => {
        const params: Record<string, unknown> = {};
        if (filters.municipio) params.municipio = filters.municipio;
        if (filters.bairro) params.bairro = filters.bairro;
        if (filters.risco) params.risco = filters.risco;
        if (filters.limit) params.limit = filters.limit;
        return (await api.get<SupplierRankingItem[]>("/suppliers/ranking", { params })).data;
      },
      [],
    ),

  /**
   * Detalhe completo de um fornecedor.
   * Endpoint novo: GET /suppliers/{cnpj_or_name}
   */
  get: (cnpjOrName: string): Promise<SupplierDetailRead | null> =>
    callOrMock<SupplierDetailRead | null>(
      async () =>
        (await api.get<SupplierDetailRead>(`/suppliers/${encodeURIComponent(cnpjOrName)}`)).data,
      null,
    ),
};

/* ========================================================================== */
/* 11. etlService                                                             */
/* ========================================================================== */

export const etlService = {
  syncStatus: () =>
    callOrMock<SyncStatus>(async () => (await api.get<SyncStatus>("/etl/sync-status")).data, {}),
  syncPublicData: async (params: { municipio?: string; ano?: number } = {}) =>
    (
      await api.post("/etl/sync-public-data", null, {
        params: {
          municipio: params.municipio ?? "Macae",
          ...(params.ano ? { ano: params.ano } : {}),
        },
      })
    ).data,
  runTcerj: async (params: { municipio?: string; ano?: number } = {}) =>
    (
      await api.post("/etl/tcerj/run", null, {
        params: {
          municipio: params.municipio ?? "Macae",
          ...(params.ano ? { ano: params.ano } : {}),
        },
      })
    ).data,
  runMacaePortal: async () => (await api.post("/etl/macae-portal/run")).data,
  importCsv: async (params: { path: string; municipio?: string }) =>
    (
      await api.post("/etl/import-csv", null, {
        params: { path: params.path, municipio: params.municipio ?? "Macae" },
      })
    ).data,
  sinapiBenchmarks: async () => (await api.get("/etl/sinapi/benchmarks")).data,
  ipcaIndex: async () => (await api.get("/etl/inflation/ipca")).data,
  testInflation: async (params: { value?: number; source_date?: string }) =>
    (await api.get("/etl/inflation/test-correction", { params })).data,
};

/* ========================================================================== */
/* 12. geoService                                                             */
/* ========================================================================== */

export const geoService = {
  layer: (layerType: "municipality" | "census_tract" | "road") =>
    callOrMock<GeoFeatureCollection>(
      async () => (await api.get<GeoFeatureCollection>(`/geo-layers/${layerType}`)).data,
      { type: "FeatureCollection", features: [] },
    ),
};

/* ========================================================================== */
/* 13. mlService                                                              */
/* ========================================================================== */

export const mlService = {
  predict: async (payload: Record<string, unknown>) =>
    (await api.post("/ml/predict", payload)).data,
  trainBaseline: async () => (await api.post("/ml/train-baseline")).data,
  retrainReal: async () => (await api.post("/ml/retrain-real")).data,
};

/* ========================================================================== */
/* 14. exportsService                                                         */
/* ========================================================================== */

/** Cria um object URL temporário e dispara o download via link programático. */
function triggerDownload(blob: Blob, filename: string, _mime: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
}

export const exportsService = {
  worksCsvUrl: () => `${ROOT}/api/v1/exports/works.csv`,
  worksXlsxUrl: () => `${ROOT}/api/v1/exports/works.xlsx`,

  downloadCsv: async (filename = "argus-obras.csv"): Promise<void> => {
    const url = exportsService.worksCsvUrl();
    const res = await fetch(url, { signal: AbortSignal.timeout(COLD_START_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Falha ao exportar CSV (HTTP ${res.status}). Verifique se o backend está disponível.`);
    }
    const blob = await res.blob();
    triggerDownload(blob, filename, "text/csv");
  },

  downloadXlsx: async (filename = "argus-obras.xlsx"): Promise<void> => {
    const url = exportsService.worksXlsxUrl();
    const res = await fetch(url, { signal: AbortSignal.timeout(COLD_START_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Falha ao exportar XLSX (HTTP ${res.status}). Verifique se o backend está disponível.`);
    }
    const blob = await res.blob();
    triggerDownload(blob, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  },

  exportClientCsv: (rows: Record<string, unknown>[], filename = "argus-relatorio.csv"): void => {
    if (!rows.length) throw new Error("Nenhum dado disponível para exportação.");
    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(";"),
      ...rows.map((r) =>
        headers
          .map((h) => {
            const v = r[h];
            if (v == null) return "";
            const s = String(v);
            return s.includes(";") || s.includes('"') || s.includes("\n")
              ? `"${s.replace(/"/g, '""')}"` 
              : s;
          })
          .join(";"),
      ),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    triggerDownload(blob, filename, "text/csv");
  },
};

/* ========================================================================== */
/* Re-exports de tipos para compatibilidade                                   */
/* ========================================================================== */

export type { AlertRead };
