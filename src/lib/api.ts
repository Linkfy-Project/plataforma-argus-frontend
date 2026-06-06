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
 * - "MACAE", "Macae", "Macaé" → "Macaé-RJ"
 * - "RIO DE JANEIRO", "Rio de Janeiro" → "Rio de Janeiro"
 * Usa uma chave de agrupamento sem acentos + uppercase para detectar duplicatas.
 */
const CANONICAL_MUNICIPIO: Record<string, string> = {
  macae: "Macaé-RJ",
  "macaé": "Macaé-RJ",
};

export function normalizeMunicipioName(raw: string): string {
  const cleaned = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos
    .replace(/[-–\s]+/g, " ")       // normaliza espaços/hífens
    .trim()
    .toLowerCase();
  // Se tem mapeamento canônico, usa
  if (CANONICAL_MUNICIPIO[cleaned]) return CANONICAL_MUNICIPIO[cleaned];
  // Caso genérico: Title Case
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Agrupa e mescla dados intermunicipais normalizando nomes de municípios.
 * Valores numéricos são somados; scores são re-calculados como média ponderada.
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
      // Média ponderada do score
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

/* -------------------------------------------------------------------------- */
/* Services                                                                   */
/* -------------------------------------------------------------------------- */

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

export const healthService = {
  health: async (): Promise<{ status: string } | Record<string, unknown>> =>
    (
      await axios.get(IS_ABSOLUTE ? `${ROOT}/health` : `${ROOT}/health`, {
        timeout: COLD_START_TIMEOUT_MS,
      })
    ).data,
};

export const worksService = {
  /** Busca página única — retorna resposta paginada completa. */
  list: (params: WorksListParams = {}) =>
    callOrMock<PaginatedWorks>(
      async () => {
        const { data } = await api.get<PaginatedWorks>("/works", {
          params: {
            ...(params.municipio ? { municipio: params.municipio } : {}),
            ...(params.min_score != null ? { min_score: params.min_score } : {}),
            ...(params.max_score != null ? { max_score: params.max_score } : {}),
            ...(params.status ? { status: params.status } : {}),
            ...(params.search ? { search: params.search } : {}),
            ...(params.min_value != null ? { min_value: params.min_value } : {}),
            ...(params.max_value != null ? { max_value: params.max_value } : {}),
            ...(params.has_score != null ? { has_score: params.has_score } : {}),
            page: params.page ?? 1,
            per_page: params.per_page ?? 25,
          },
        });
        return data;
      },
      { items: [], total: 0, page: 1, per_page: 25, total_pages: 0 },
    ),

  /** Busca TODAS as páginas iterando automaticamente (para agregações). */
  listAll: async (params: Omit<WorksListParams, "page" | "per_page"> = {}): Promise<WorkRead[]> => {
    const out: WorkRead[] = [];
    let page = 1;
    const perPage = 1000;
    while (true) {
      const resp = await worksService.list({ ...params, page, per_page: perPage });
      out.push(...resp.items);
      if (out.length >= resp.total || resp.items.length < perPage) break;
      page++;
    }
    return out;
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
  trends: (params: { municipio?: string } = {}) =>
    callOrMock<TrendPoint[]>(
      async () =>
        (
          await api.get<TrendPoint[]>("/analytics/trends", {
            params: params.municipio ? { municipio: params.municipio } : undefined,
          })
        ).data,
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
  retrainReal: async () => (await api.post("/ml/retrain-real")).data,
};

export const exportsService = {
  worksCsvUrl: () => `${ROOT}/api/v1/exports/works.csv`,
  worksXlsxUrl: () => `${ROOT}/api/v1/exports/works.xlsx`,

  /** Download do CSV com tratamento de erro via fetch + blob. */
  downloadCsv: async (filename = "argus-obras.csv"): Promise<void> => {
    const url = exportsService.worksCsvUrl();
    const res = await fetch(url, { signal: AbortSignal.timeout(COLD_START_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Falha ao exportar CSV (HTTP ${res.status}). Verifique se o backend está disponível.`);
    }
    const blob = await res.blob();
    triggerDownload(blob, filename, "text/csv");
  },

  /** Download do XLSX com tratamento de erro via fetch + blob. */
  downloadXlsx: async (filename = "argus-obras.xlsx"): Promise<void> => {
    const url = exportsService.worksXlsxUrl();
    const res = await fetch(url, { signal: AbortSignal.timeout(COLD_START_TIMEOUT_MS) });
    if (!res.ok) {
      throw new Error(`Falha ao exportar XLSX (HTTP ${res.status}). Verifique se o backend está disponível.`);
    }
    const blob = await res.blob();
    triggerDownload(blob, filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  },

  /** Exporta dados atuais como CSV gerado no cliente (fallback). */
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

/* -------------------------------------------------------------------------- */
/* Services de domínio (Obra, Contrato, Alerta, Município, Summary).          */
/* Mantêm a API antiga das páginas, agora alimentada pelo backend real.       */
/* -------------------------------------------------------------------------- */

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
  /** Busca paginada de obras com filtros delegados ao backend. */
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

export const municipiosService = {
  list: async (): Promise<Municipio[]> => {
    const works = await worksService.listAll({});
    if (USE_MOCK && works.length === 0) return mockMunicipios;
    return municipiosFromWorks(works);
  },
};

export const contratosService = {
  list: async (_params: { q?: string } = {}): Promise<Contrato[]> => {
    const works = await worksService.listAll({});
    if (USE_MOCK && works.length === 0) return mockContratos;
    return contratosFromWorks(works);
  },
};

export const alertasService = {
  list: async (_params: { nivel?: string } = {}): Promise<Alerta[]> => {
    const works = await worksService.listAll({});
    if (USE_MOCK && works.length === 0) return mockAlertas;
    return alertasFromWorks(works);
  },
};

export const dashboardService = {
  getSummary: async (): Promise<DashboardSummary> => {
    try {
      const [s, works] = await Promise.all([analyticsService.summary(), worksService.listAll({})]);
      return summaryFromAnalytics(s, works);
    } catch {
      return mockSummary;
    }
  },
};

export type { AlertRead };
