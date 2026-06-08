/* ========================================================================== */
/* Tipos da Plataforma ARGUS                                                  */
/* ========================================================================== */

/* -------------------------------------------------------------------------- */
/* Tipos de domínio do frontend (legacy / adaptação)                          */
/* -------------------------------------------------------------------------- */

export type ObraStatus = "Planejada" | "Em andamento" | "Concluída" | "Atrasada" | "Paralisada";
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
  /** Scores individuais por pilar ARGUS (0–100). */
  cost_score?: number;
  deadline_score?: number;
  quality_score?: number;
  recurrence_score?: number;
  social_impact_score?: number;
  numero_contrato?: string;
  bairro?: string;
  endereco?: string;
  latitude?: number;
  longitude?: number;
  /** Contadores de infrações CREA (proxy multi-fonte). */
  crea_light_count?: number;
  crea_medium_count?: number;
  crea_grave_count?: number;
  /** Ratio de sobreposição territorial (buffer 500m). */
  territorial_overlap_ratio?: number;
  /** Benchmark SINAPI R$/m² usado no cálculo paramétrico. */
  benchmark_cost_m2?: number;
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
/* Tipos espelhando o backend FastAPI — Obras / Analytics / Legacy            */
/* -------------------------------------------------------------------------- */

export interface AlertRead {
  id: number;
  code: string;
  severity: string;
  severity_weight: number;
  severity_multiplier: number;
  weighted_severity: number;
  message: string;
  created_at: string;
}

export interface WorkRead {
  id: number;
  external_id?: string | null;
  source: string;
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
  benchmark_cost_m2?: number | null;
  crea_light_count: number;
  crea_medium_count: number;
  crea_grave_count: number;
  territorial_overlap_ratio?: number | null;
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
  best: Array<
    Pick<
      WorkRead,
      "id" | "municipio" | "object_description" | "contractor_name" | "efficiency_score"
    >
  >;
  worst: Array<
    Pick<
      WorkRead,
      "id" | "municipio" | "object_description" | "contractor_name" | "efficiency_score"
    >
  >;
}

export interface ScoreAlert {
  code: string;
  severity: string;
  severity_weight: number;
  severity_multiplier: number;
  weighted_severity: number;
  message: string;
  details?: Record<string, unknown>;
}

export interface ScoreComponents {
  weights: {
    cost: number;
    deadline: number;
    quality: number;
    recurrence: number;
    social_impact: number;
    ml_risk: number;
  };
  cost: Record<string, unknown>;
  deadline: Record<string, unknown>;
  quality: Record<string, unknown>;
  recurrence: Record<string, unknown>;
  social_impact: Record<string, unknown>;
  ml_risk: Record<string, unknown>;
  criticality_rule: Record<string, unknown>;
}

export interface ScoreExplain {
  cost_score: number;
  deadline_score: number;
  quality_score: number;
  recurrence_score: number;
  social_impact_score: number;
  ml_risk_score?: number;
  efficiency_score: number;
  alerts: ScoreAlert[];
  components: ScoreComponents;
}

export interface ScoringRules {
  weights: Record<string, number>;
  formulas: Record<string, string>;
  crea_penalties: { light: number; medium: number; grave: number };
  criticality_multiplier: {
    idh_below: number;
    multiplier: number;
    applies_to: string;
  };
}

export interface SyncStatus {
  scheduled?: boolean;
  job_id?: string;
  timezone?: string;
  now?: string;
  next_run_time?: string;
  seconds_left?: number;
  time_left?: string;
}

/** Alerta enriquecido com dados da obra de origem (para a página Alertas). */
export interface AlertWithWork extends AlertRead {
  work_id: number;
  work_object_description: string;
  contractor_name: string | null;
  municipio: string;
  efficiency_score: number | null;
}

/** Resposta paginada do backend para listagem de obras. */
export interface PaginatedWorks {
  items: WorkRead[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

/* -------------------------------------------------------------------------- */
/* Tipos do Dashboard Executivo (endpoint /dashboard/*)                       */
/* -------------------------------------------------------------------------- */

/** Resumo executivo com todos os KPIs do painel. */
export interface DashboardExecutiveSummary {
  municipio: string;
  ultima_atualizacao: string;
  obras_monitoradas: number;
  valor_total_contratado: number;
  valor_total_pago: number;
  valor_potencial_em_risco: number;
  obras_criticas: number;
  obras_alto_risco: number;
  obras_em_atencao: number;
  obras_eficientes: number;
  obras_atrasadas: number;
  obras_sem_geolocalizacao: number;
  contratos_com_aditivos_altos: number;
  alertas_criticos: number;
  alertas_totais: number;
  fornecedores_monitorados: number;
  bairros_monitorados: number;
  score_medio: number;
  data_quality_score: number;
}

/** Item da fila priorizada de obras que o gestor deve avaliar primeiro. */
export interface PriorityQueueItem {
  prioridade: number;
  obra_id: number;
  obra: string;
  bairro: string | null;
  secretaria: string | null;
  fornecedor: string | null;
  score_argus: number | null;
  classificacao_risco: string;
  valor_contratado: number;
  valor_em_risco_estimado: number;
  dias_atraso: number;
  alertas_ativos: number;
  motivo_principal: string;
  acao_sugerida: string;
}

/** Faixa de risco com contagem de obras (para gráficos). */
export interface RiskDistributionItem {
  label: string;
  min: number | null;
  max: number | null;
  total: number;
}

/* -------------------------------------------------------------------------- */
/* Tipos de Análise Territorial (endpoint /territory/*)                       */
/* -------------------------------------------------------------------------- */

/** Visão geral da análise microterritorial de Macaé-RJ. */
export interface TerritoryOverview {
  municipio: string;
  bairros_monitorados: number;
  obras_monitoradas: number;
  valor_total_contratado: number;
  score_medio: number;
  bairros_criticos: number;
  obras_sem_bairro: number;
  obras_sem_geolocalizacao: number;
  bairro_mais_critico: string;
  bairro_maior_valor: string;
  bairro_mais_atrasos: string;
  recomendacoes: string[];
}

/** Bairro com indicadores de risco na lista de bairros. */
export interface NeighborhoodListItem {
  bairro: string;
  obras: number;
  valor_total: number;
  valor_pago: number;
  score_medio: number;
  obras_criticas: number;
  obras_alto_risco: number;
  obras_atrasadas: number;
  alertas_totais: number;
  alertas_criticos: number;
  fornecedores_distintos: number;
  fornecedor_mais_recorrente: string;
  obras_sem_geolocalizacao: number;
  classificacao: string;
  recomendacao: string;
}

/** Bairro com indicadores de risco (endpoint dashboard). */
export interface NeighborhoodRiskItem {
  bairro: string;
  obras: number;
  score_medio: number;
  obras_criticas: number;
  obras_atrasadas: number;
  valor_total: number;
  alertas: number;
  classificacao: string;
  recomendacao: string;
}

/** Resumo de obra no detalhe do bairro. */
export interface ObraResumo {
  id: number;
  descricao: string;
  fornecedor: string | null;
  score: number | null;
  classificacao: string;
  valor_contratado: number;
  dias_atraso: number;
  alertas: number;
}

/** Resumo de fornecedor no detalhe do bairro. */
export interface FornecedorResumo {
  nome: string;
  cnpj: string | null;
  obras: number;
  valor_total: number;
  score_medio: number;
}

/** Resumo de alerta no detalhe do bairro. */
export interface AlertaResumo {
  obra_id: number;
  code: string;
  severity: string;
  message: string;
}

/** Resumo numérico do bairro. */
export interface BairroResumo {
  obras: number;
  valor_total: number;
  valor_pago: number;
  score_medio: number;
  obras_criticas: number;
  obras_alto_risco: number;
  obras_atrasadas: number;
  alertas_totais: number;
  alertas_criticos: number;
  fornecedores_distintos: number;
  classificacao: string;
}

/** Detalhe completo de um bairro. */
export interface NeighborhoodDetail {
  bairro: string;
  resumo: BairroResumo;
  obras_criticas: ObraResumo[];
  obras_atrasadas: ObraResumo[];
  principais_fornecedores: FornecedorResumo[];
  alertas: AlertaResumo[];
  analise_textual: string;
  acoes_recomendadas: string[];
}

/** Propriedades de cada feature no GeoJSON do heatmap. */
export interface HeatmapFeatureProperties {
  obra_id: number;
  nome: string;
  bairro: string;
  score: number | null;
  classificacao: string;
  valor_contratado: number;
  alertas: number;
  dias_atraso: number;
  fornecedor: string | null;
}

/** Resposta GeoJSON FeatureCollection para o heatmap territorial. */
export interface HeatmapResponse {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: string; coordinates: number[] };
    properties: HeatmapFeatureProperties;
  }>;
}

/** Obra com problemas de qualidade de dados. */
export interface ObraDataQualityIssue {
  id: number;
  descricao: string;
  bairro: string;
  problemas: string[];
}

/** Relatório de qualidade dos dados territoriais. */
export interface DataQualityReport {
  total_obras: number;
  obras_sem_bairro: number;
  obras_sem_geolocalizacao: number;
  obras_sem_valor: number;
  obras_sem_fornecedor: number;
  obras_sem_prazo: number;
  data_quality_score: number;
  obras_para_saneamento: ObraDataQualityIssue[];
}

/* -------------------------------------------------------------------------- */
/* Tipos de Fornecedores (endpoint /suppliers/*)                              */
/* -------------------------------------------------------------------------- */

/** Item do ranking de fornecedores. */
export interface SupplierRankingItem {
  fornecedor: string;
  cnpj: string | null;
  contratos: number;
  obras: number;
  valor_total: number;
  valor_pago: number;
  score_medio: number | null;
  obras_criticas: number;
  obras_atrasadas: number;
  alertas_totais: number;
  alertas_criticos: number;
  aditivo_medio_percentual: number;
  bairros_atuacao: string[];
  classificacao: string;
  recomendacao: string;
}

/** Detalhe completo de um fornecedor. */
export interface SupplierDetailRead extends SupplierRankingItem {
  obras_lista: Record<string, unknown>[];
  contratos_lista: Record<string, unknown>[];
  alertas_lista: Record<string, unknown>[];
}

/* -------------------------------------------------------------------------- */
/* Tipos de Contratos (endpoint /contracts/*)                                 */
/* -------------------------------------------------------------------------- */

/** Contrato exposto pela API. */
export interface ContractItem {
  id: string;
  work_id: number;
  numero_contrato: string | null;
  objeto: string | null;
  obra_nome: string | null;
  municipio: string | null;
  bairro: string | null;
  fornecedor: string | null;
  cnpj_fornecedor: string | null;
  secretaria: string | null;
  valor_original: number | null;
  valor_atual: number | null;
  valor_pago: number | null;
  percentual_aditivo: number | null;
  data_inicio: string | null;
  data_fim: string | null;
  dias_para_vencimento: number | null;
  status: string | null;
  score_argus: number | null;
  classificacao_risco: string | null;
  alertas: number;
  acao_sugerida: string | null;
}

/** Detalhe de um contrato individual. */
export interface ContractDetailRead extends ContractItem {
  created_at: string | null;
  updated_at: string | null;
  alertas_detalhes: Record<string, unknown>[];
}

/* -------------------------------------------------------------------------- */
/* Tipos de Alertas com Workflow (endpoint /alerts/*)                         */
/* -------------------------------------------------------------------------- */

/** Alerta com workflow exposto pela API de alertas. */
export interface AlertWorkflowItem {
  id: number;
  work_id: number;
  tipo: string;
  code: string;
  severity: string;
  nivel: string;
  status: string;
  obra_nome: string | null;
  municipio: string | null;
  bairro: string | null;
  fornecedor: string | null;
  descricao: string | null;
  motivo: string | null;
  acao_sugerida: string | null;
  data_deteccao: string | null;
  score_argus: number | null;
  valor_contratado: number | null;
}

/** Status permitidos para atualização de alertas. */
export type AlertStatusValue = "Novo" | "Em análise" | "Encaminhado" | "Resolvido" | "Descartado";

/* -------------------------------------------------------------------------- */
/* Tipos de Relatórios Executivos (endpoint /reports/*)                        */
/* -------------------------------------------------------------------------- */

/** KPIs do relatório executivo geral. */
export interface ReportExecutiveKPIs {
  obras_monitoradas: number;
  valor_total_contratado: number;
  valor_total_pago: number;
  valor_total_aditivos: number;
  score_medio: number;
  obras_eficientes: number;
  obras_em_atencao: number;
  obras_alto_risco: number;
  obras_criticas: number;
  obras_atrasadas: number;
  obras_sem_geolocalizacao: number;
  contratos_aditivos_altos: number;
  percentual_executado: number;
}

/** Item de prioridade no relatório executivo. */
export interface ReportPriorityItem {
  id: number;
  objeto: string;
  bairro: string | null;
  fornecedor: string | null;
  score: number | null;
  classificacao: string;
  valor_contratado: number;
  motivo: string;
}

/** Bairro crítico no relatório executivo. */
export interface ReportCriticalNeighborhood {
  bairro: string;
  obras: number;
  score_medio: number;
  obras_criticas: number;
  valor_total: number;
}

/** Fornecedor em revisão no relatório executivo. */
export interface ReportSupplierReview {
  fornecedor: string;
  obras: number;
  score_medio: number;
  alertas: number;
  valor_total: number;
  classificacao: string;
}

/** Contrato com aditivos altos. */
export interface ReportHighAdditive {
  id: number;
  objeto: string;
  fornecedor: string | null;
  valor_contratado: number;
  valor_aditivo: number;
  percentual_aditivo: number;
}

/** Alerta crítico no relatório. */
export interface ReportCriticalAlert {
  id: number;
  obra_id: number;
  obra: string;
  codigo: string;
  severidade: string;
  mensagem: string;
  criado_em: string | null;
}

/** Relatório executivo geral completo. */
export interface ExecutiveReport {
  municipio: string;
  gerado_em: string;
  kpis: ReportExecutiveKPIs;
  prioridades_hoje: ReportPriorityItem[];
  bairros_criticos: ReportCriticalNeighborhood[];
  fornecedores_revisao: ReportSupplierReview[];
  contratos_aditivos_altos: ReportHighAdditive[];
  alertas_criticos: ReportCriticalAlert[];
  recomendacoes: string[];
}

/** Obra crítica no relatório. */
export interface CriticalWorkReportItem {
  id: number;
  objeto: string;
  bairro: string | null;
  municipio: string;
  fornecedor: string | null;
  score: number | null;
  classificacao: string;
  valor_contratado: number;
  valor_pago: number;
  percentual_aditivo: number;
  dias_atraso: number;
  alertas: number;
  score_custo: number | null;
  score_prazo: number | null;
  score_qualidade: number | null;
  score_recorrencia: number | null;
  score_social: number | null;
  previsao_entrega: string | null;
  status: string;
}

/** Bairro no relatório de bairros. */
export interface NeighborhoodReportItem {
  bairro: string;
  obras: number;
  score_medio: number | null;
  classificacao: string;
  obras_criticas: number;
  obras_alto_risco: number;
  obras_atrasadas: number;
  valor_total: number;
  valor_pago: number;
  alertas_totais: number;
  fornecedores_distintos: number;
}

/** Fornecedor no relatório de fornecedores. */
export interface SupplierReportItem {
  fornecedor: string;
  contratos: number;
  score_medio: number | null;
  classificacao: string;
  obras_criticas: number;
  obras_atrasadas: number;
  valor_total: number;
  valor_pago: number;
  alertas_totais: number;
  bairros_atuacao: string[];
  aditivo_medio_percentual: number;
}

/** Relatório de qualidade dos dados. */
export interface DataQualityReportFull {
  municipio: string;
  total_obras: number;
  obras_sem_bairro: number;
  obras_sem_geolocalizacao: number;
  obras_sem_valor: number;
  obras_sem_fornecedor: number;
  obras_sem_prazo: number;
  obras_sem_score: number;
  data_quality_score: number;
  obras_para_saneamento: Array<{
    id: number;
    descricao: string;
    bairro: string | null;
    problemas: string[];
  }>;
}
