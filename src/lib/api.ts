import axios from "axios";
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
  DashboardSummary,
} from "@/types";

/**
 * Camada HTTP da Plataforma Argus.
 *
 * Backend esperado: FastAPI exposto via `VITE_API_BASE_URL`.
 * Endpoints REST (mantenha em sincronia com o backend):
 *   GET /dashboard/summary
 *   GET /obras            ?municipio=&status=&q=
 *   GET /obras/{id}
 *   GET /municipios
 *   GET /contratos        ?q=
 *   GET /alertas          ?nivel=
 *
 * Quando `VITE_USE_MOCK=true` ou o backend está indisponível, os
 * dados mockados em `src/data/mock` são utilizados automaticamente.
 */
export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "http://localhost:8000";

export const USE_MOCK =
  String(import.meta.env.VITE_USE_MOCK ?? "").toLowerCase() === "true";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 6000,
  headers: { Accept: "application/json" },
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    // Centraliza log; cada service decide se usa fallback.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.warn("[Argus API]", error?.config?.url, error?.message);
    }
    return Promise.reject(error);
  },
);

/** Executa `fn` contra a API; retorna `fallback` em caso de erro ou modo mock. */
export async function withFallback<T>(
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  if (USE_MOCK) return fallback;
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

/* -------------------------------------------------------------------------- */
/* Services                                                                   */
/* -------------------------------------------------------------------------- */

export interface ObrasListParams {
  municipio?: string;
  status?: string;
  q?: string;
}

export const obrasService = {
  list: (params: ObrasListParams = {}) =>
    withFallback<Obra[]>(
      async () => (await api.get<Obra[]>("/obras", { params })).data,
      mockObras,
    ),
  get: (id: string) =>
    withFallback<Obra | undefined>(
      async () => (await api.get<Obra>(`/obras/${id}`)).data,
      mockObras.find((o) => o.id === id),
    ),
};

export const municipiosService = {
  list: () =>
    withFallback<Municipio[]>(
      async () => (await api.get<Municipio[]>("/municipios")).data,
      mockMunicipios,
    ),
};

export const contratosService = {
  list: (params: { q?: string } = {}) =>
    withFallback<Contrato[]>(
      async () => (await api.get<Contrato[]>("/contratos", { params })).data,
      mockContratos,
    ),
};

export const alertasService = {
  list: (params: { nivel?: string } = {}) =>
    withFallback<Alerta[]>(
      async () => (await api.get<Alerta[]>("/alertas", { params })).data,
      mockAlertas,
    ),
};

export const dashboardService = {
  getSummary: () =>
    withFallback<DashboardSummary>(
      async () =>
        (await api.get<DashboardSummary>("/dashboard/summary")).data,
      mockSummary,
    ),
};