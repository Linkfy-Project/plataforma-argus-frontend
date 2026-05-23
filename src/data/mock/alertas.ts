import type { Alerta } from "@/types";
import { mockObras } from "./obras";

const niveis: Alerta["nivel"][] = ["Baixo", "Médio", "Alto", "Crítico"];
const titulos = [
  "Obra atrasada em relação ao cronograma",
  "Execução financeira abaixo do esperado",
  "Obra paralisada há mais de 30 dias",
  "Prazo contratual vencido",
  "Divergência entre valor executado e medições",
  "Indícios de inconsistência nos dados",
];

export const mockAlertas: Alerta[] = mockObras
  .filter((o) => o.status === "Atrasada" || o.status === "Paralisada" || o.percentual_execucao < 30)
  .slice(0, 14)
  .map((o, i) => ({
    id: `ALT-${3000 + i}`,
    nivel: niveis[i % niveis.length],
    titulo: titulos[i % titulos.length],
    descricao: `A obra "${o.nome}" apresenta indicadores que requerem atenção. Recomenda-se análise técnica e revisão do plano de execução.`,
    obra_id: o.id,
    obra_nome: o.nome,
    municipio: o.municipio,
    data_deteccao: new Date(Date.now() - i * 86400000 * 3).toISOString(),
    acao_sugerida: "Solicitar relatório técnico ao órgão responsável e agendar visita de fiscalização.",
  }));