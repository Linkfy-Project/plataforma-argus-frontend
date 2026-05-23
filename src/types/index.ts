export type ObraStatus = "Planejada" | "Em andamento" | "Concluída" | "Atrasada" | "Paralisada";
export type AlertaNivel = "Baixo" | "Médio" | "Alto" | "Crítico";

export interface Obra {
  id: string;
  nome: string;
  municipio: string;
  status: ObraStatus;
  valor_contratado: number;
  valor_executado: number;
  percentual_execucao: number;
  data_inicio: string;
  data_fim_prevista: string;
  orgao_responsavel: string;
  empresa_contratada: string;
  descricao: string;
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
}