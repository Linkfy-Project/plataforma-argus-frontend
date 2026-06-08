import type { DashboardSummary } from "@/types";
import { mockObras } from "./obras";
import { mockMunicipios } from "./municipios";
import { mockAlertas } from "./alertas";

export const mockSummary: DashboardSummary = {
  total_obras: mockObras.length,
  obras_em_andamento: mockObras.filter((o) => o.status === "Em andamento").length,
  obras_concluidas: mockObras.filter((o) => o.status === "Concluída").length,
  obras_paralisadas: mockObras.filter((o) => o.status === "Paralisada").length,
  valor_total_contratado: mockObras.reduce((s, o) => s + o.valor_contratado, 0),
  municipios_monitorados: mockMunicipios.length,
  alertas_criticos: mockAlertas.filter((a) => a.nivel === "Crítico" || a.nivel === "Alto").length,
  percentual_medio_execucao: Math.round(
    mockObras.reduce((s, o) => s + o.percentual_execucao, 0) / mockObras.length,
  ),
};
