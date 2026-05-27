import axios, { AxiosError } from "axios";
import {
  mockObras,
  mockMunicipios,
  mockContratos,
  mockAlertas,
  mockSummary,
} from "@/data/mock";
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
} from "@/types";

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

/**
 * Camada HTTP da Plataforma Argus.
 *
 * Backend: FastAPI (Render). Endpoints reais conforme `/openapi.json`:
 *   GET  /health
 *   GET  /api/v1/works                ?municipio=&min_score=&max_score=&limit=&offset=
 *   GET  /api/v1/works/{work_id}
 *   POST /api/v1/works/{work_id}/recompute
 *   POST /api/v1/works/recompute-all
 *   GET  /api/v1/analytics/summary    ?municipio=
 *   GET  /api/v1/analytics/rankings   ?limit=
 *   GET  /api/v1/analytics/map/geojson
 *   POST /api/v1/ml/predict
 *   GET  /api/v1/exports/works.csv
 *   GET  /api/v1/exports/works.xlsx
 *   GET  /api/v1/etl/sync-status
 *
 * Mocks (`src/data/mock`) só são usados como fallback de
 * desenvolvimento quando a API estiver indisponível, ou quando
 * `VITE_USE_MOCK=true` for explicitamente definido.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "https://argus-backend-5bio.onrender.com";

export const USE_MOCK =
  String(import.meta.env.VITE_USE_MOCK ?? "").toLowerCase() === "true";

/** Render free pode levar ~50s para acordar (cold start). */
const COLD_START_TIMEOUT_MS = 90_000;

const ROOT = API_BASE_URL.replace(/\/$/, "");

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
 * React Query — nunca substituímos silenciosamente dados reais por mocks,
 * inclusive quando a API responde com lista vazia.
 */
async function callOrMock<T>(fn: () => Promise<T>, mockValue: T): Promise<T> {
  if (USE_MOCK) return mockValue;
  return await fn();
}

/* -------------------------------------------------------------------------- */
/* Adaptadores: WorkRead (backend) -> Obra (domínio do frontend)              */
/* -------------------------------------------------------------------------- */

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
    numero_contrato: w.contract_number ?? undefined,
    bairro: w.neighborhood ?? undefined,
    endereco: w.address ?? undefined,
    latitude: w.latitude ?? undefined,
    longitude: w.longitude ?? undefined,
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
    const k = w.municipio || "—";
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(w);
  }
  return Array.from(grouped.entries()).map(([nome, ws]) => {
    const eff = avg(ws.map((w) => w.efficiency_score ?? 0).filter((v) => v > 0));
    return {
      id: nome.toLowerCase().replace(/\s+/g, "-"),
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

function summaryFromAnalytics(s: AnalyticsSummary, works?: WorkRead[]): DashboardSummary {
  const totalContratado = works
    ? works.reduce((acc, w) => acc + (w.contract_value ?? 0), 0)
    : 0;
  const municipios = works
    ? new Set(works.map((w) => w.municipio)).size
    : 0;
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

/* -------------------------------------------------------------------------- */
/* Services                                                                   */
/* -------------------------------------------------------------------------- */

export interface WorksListParams {
  municipio?: string;
  min_score?: number;
  max_score?: number;
  limit?: number;
  offset?: number;
}

export const healthService = {
  health: async (): Promise<{ status: string } | Record<string, unknown>> =>
    (await axios.get(`${ROOT}/health`, { timeout: COLD_START_TIMEOUT_MS })).data,
};

export const worksService = {
  list: (params: WorksListParams = {}) =>
    callOrMock<WorkRead[]>(
      async () => (await api.get<WorkRead[]>("/works", { params })).data,
      [],
    ),
  get: (id: string | number) =>
    callOrMock<WorkRead | null>(
      async () => (await api.get<WorkRead>(`/works/${id}`)).data,
      null,
    ),
  create: async (payload: Partial<WorkRead>): Promise<WorkRead> =>
    (await api.post<WorkRead>("/works", payload)).data,
  recompute: async (id: string | number): Promise<WorkRead> =>
    (await api.post<WorkRead>(`/works/${id}/recompute`)).data,
  recomputeAll: async (): Promise<unknown> =>
    (await api.post("/works/recompute-all")).data,
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

export const analyticsService = {
  summary: (params: { municipio?: string } = {}) =>
    callOrMock<AnalyticsSummary>(
      async () =>
        (
          await api.get<AnalyticsSummary>("/analytics/summary", {
            params: params.municipio ? { municipio: params.municipio } : undefined,
          })
        ).data,
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
};

export const etlService = {
  syncStatus: () =>
    callOrMock<SyncStatus>(
      async () => (await api.get<SyncStatus>("/etl/sync-status")).data,
      {},
    ),
  syncPublicData: async (params: { municipio?: string; ano?: number } = {}) =>
    (await api.post("/etl/sync-public-data", null, {
      params: { municipio: params.municipio ?? "Macae", ...(params.ano ? { ano: params.ano } : {}) },
    })).data,
  runTcerj: async (params: { municipio?: string; ano?: number } = {}) =>
    (await api.post("/etl/tcerj/run", null, {
      params: { municipio: params.municipio ?? "Macae", ...(params.ano ? { ano: params.ano } : {}) },
    })).data,
  runMacaePortal: async () => (await api.post("/etl/macae-portal/run")).data,
  importCsv: async (params: { path: string; municipio?: string }) =>
    (await api.post("/etl/import-csv", null, {
      params: { path: params.path, municipio: params.municipio ?? "Macae" },
    })).data,
};

export const geoService = {
  layer: (layerType: "municipality" | "census_tract" | "road") =>
    callOrMock<GeoFeatureCollection>(
      async () => (await api.get<GeoFeatureCollection>(`/geo-layers/${layerType}`)).data,
      { type: "FeatureCollection", features: [] },
    ),
};

export const mlService = {
  predict: async (payload: Record<string, unknown>) =>
    (await api.post("/ml/predict", payload)).data,
  trainBaseline: async () => (await api.post("/ml/train-baseline")).data,
};

export const exportsService = {
  worksCsvUrl: () => `${ROOT}/api/v1/exports/works.csv`,
  worksXlsxUrl: () => `${ROOT}/api/v1/exports/works.xlsx`,
};

/* -------------------------------------------------------------------------- */
/* Services de domínio (Obra, Contrato, Alerta, Município, Summary).          */
/* Mantêm a API antiga das páginas, agora alimentada pelo backend real.       */
/* -------------------------------------------------------------------------- */

export interface ObrasListParams {
  municipio?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

export const obrasService = {
  list: async (params: ObrasListParams = {}): Promise<Obra[]> => {
    const works = await worksService.list({
      municipio: params.municipio,
      limit: params.limit ?? 500,
      offset: params.offset ?? 0,
    });
    const base = USE_MOCK && works.length === 0 ? mockObras : works.map(adaptObra);
    return base.filter((o) => {
      if (params.status && o.status !== params.status) return false;
      if (params.q) {
        const k = params.q.toLowerCase();
        if (!`${o.nome} ${o.municipio} ${o.empresa_contratada}`.toLowerCase().includes(k))
          return false;
      }
      return true;
    });
  },
  get: async (id: string): Promise<Obra | undefined> => {
    const w = await worksService.get(id);
    if (w) return adaptObra(w);
    return USE_MOCK ? mockObras.find((o) => o.id === id) : undefined;
  },
};

export const municipiosService = {
  list: async (): Promise<Municipio[]> => {
    const works = await worksService.list({ limit: 1000 });
    if (USE_MOCK && works.length === 0) return mockMunicipios;
    return municipiosFromWorks(works);
  },
};

export const contratosService = {
  list: async (_params: { q?: string } = {}): Promise<Contrato[]> => {
    const works = await worksService.list({ limit: 1000 });
    if (USE_MOCK && works.length === 0) return mockContratos;
    return contratosFromWorks(works);
  },
};

export const alertasService = {
  list: async (_params: { nivel?: string } = {}): Promise<Alerta[]> => {
    const works = await worksService.list({ limit: 1000 });
    if (USE_MOCK && works.length === 0) return mockAlertas;
    return alertasFromWorks(works);
  },
};

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    try {
      const [s, works] = await Promise.all([
        analyticsService.summary(),
        worksService.list({ limit: 1000 }),
      ]);
      return summaryFromAnalytics(s, works);
    } catch {
      return mockSummary;
    }
  },
};

export type { AlertRead };