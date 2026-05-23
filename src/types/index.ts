export type ObraStatus =
  | "Planejada"
  | "Em andamento"
  | "Concluída"
  | "Atrasada"
  | "Paralisada";
export type AlertaNivel = "Baixo" | "Médio" | "Alto" | "Crítico";

export interface Obra {
  id: string;
  nome: string;
  municipio: string;
  status: ObraStatus | string;
  valor_contratado: number;
  valor_executado: number;
  percentual_execucao: number;
  data_inicio: string;
  data_fim_prevista: string;
  orgao_responsavel: string;
  empresa_contratada: string;
  descricao: string;
  /** Score de eficiência (0–100), quando calculado pelo backend. */
  eficiencia?: number;
  /** Riscos preditivos calculados pelo backend (0–1). */
  risco_atraso?: number;
  risco_custo?: number;
  risco_retrabalho?: number;
  numero_contrato?: string;
  bairro?: string;
  endereco?: string;
  latitude?: number;
  longitude?: number;
}

export interface Municipio {
  id: string;
  nome: string;
  total_obras: number;
  obras_em_andamento: number;
  obras_concluidas: number;
  obras_com_alerta: number;
  valor_total: number;
  eficiencia: number;
}

export interface Contrato {
  id: string;
  numero: string;
  obra_id: string;
  obra_nome: string;
  municipio: string;
  valor_contratado: number;
  valor_executado: number;
  empresa: string;
  data_assinatura: string;
  status: string;
}

export interface Alerta {
  id: string;
  nivel: AlertaNivel;
  titulo: string;
  descricao: string;
  obra_id: string;
  obra_nome: string;
  municipio: string;
  data_deteccao: string;
  acao_sugerida: string;
}

export interface DashboardSummary {
  total_obras: number;
  obras_em_andamento: number;
  obras_concluidas: number;
  obras_paralisadas: number;
  valor_total_contratado: number;
  municipios_monitorados: number;
  alertas_criticos: number;
  percentual_medio_execucao: number;
  eficiencia_media?: number;
}

/* -------------------------------------------------------------------------- */
/* Tipos espelhando o backend FastAPI (`/openapi.json`).                      */
/* -------------------------------------------------------------------------- */

export interface AlertRead {
  id: number;
  code: string;
  severity: string;
  message: string;
  created_at: string;
}

export interface WorkRead {
  id: number;
  external_id?: string | null;
  source?: string | null;
  municipio: string;
  object_description: string;
  contractor_name?: string | null;
  contractor_document?: string | null;
  contract_type?: string | null;
  contract_number?: string | null;
  bidding_number?: string | null;
  managing_unit?: string | null;
  requesting_agency?: string | null;
  contract_value?: number | null;
  committed_value?: number | null;
  settled_value?: number | null;
  paid_value?: number | null;
  additive_value?: number | null;
  area_m2?: number | null;
  signed_at?: string | null;
  due_at?: string | null;
  finished_at?: string | null;
  status?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  idh?: number | null;
  efficiency_score?: number | null;
  cost_score?: number | null;
  deadline_score?: number | null;
  quality_score?: number | null;
  recurrence_score?: number | null;
  social_impact_score?: number | null;
  risk_delay_probability?: number | null;
  risk_cost_probability?: number | null;
  risk_rework_probability?: number | null;
  created_at: string;
  updated_at: string;
  alerts: AlertRead[];
}

export interface AnalyticsSummary {
  total_works: number;
  average_efficiency_score: number;
  delayed_works: number;
  critical_alerts: number;
}

export interface AnalyticsRankings {
  best: Array<Pick<WorkRead, "id" | "municipio" | "object_description" | "contractor_name" | "efficiency_score">>;
  worst: Array<Pick<WorkRead, "id" | "municipio" | "object_description" | "contractor_name" | "efficiency_score">>;
}