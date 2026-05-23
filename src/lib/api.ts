import axios from "axios";
import type { Obra, Municipio, Contrato, Alerta, DashboardSummary } from "@/types";
import { mockObras, mockMunicipios, mockContratos, mockAlertas, mockSummary } from "@/data/mock";

export const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
});

async function withFallback<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const dashboardService = {
  getSummary: () =>
    withFallback<DashboardSummary>(async () => (await api.get("/dashboard/summary")).data, mockSummary),
};

export const obrasService = {
  list: () => withFallback<Obra[]>(async () => (await api.get("/obras")).data, mockObras),
  get: (id: string) =>
    withFallback<Obra | undefined>(
      async () => (await api.get(`/obras/${id}`)).data,
      mockObras.find((o) => o.id === id),
    ),
};

export const municipiosService = {
  list: () =>
    withFallback<Municipio[]>(async () => (await api.get("/municipios")).data, mockMunicipios),
};

export const contratosService = {
  list: () => withFallback<Contrato[]>(async () => (await api.get("/contratos")).data, mockContratos),
};

export const alertasService = {
  list: () => withFallback<Alerta[]>(async () => (await api.get("/alertas")).data, mockAlertas),
};