import type { Obra, Municipio, Contrato, Alerta, DashboardSummary } from "@/types";

const municipiosRJ = [
  "Rio de Janeiro", "Niterói", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu",
  "Petrópolis", "Volta Redonda", "Campos dos Goytacazes", "Macaé", "Angra dos Reis",
  "Cabo Frio", "Teresópolis",
];

const empresas = ["Construtora Atlântico S.A.", "Engebrás Ltda.", "OAS Engenharia", "Construcap", "Queiroz Galvão", "Odebrecht Infra", "Mendes Júnior"];
const orgaos = ["Secretaria Municipal de Obras", "Secretaria de Infraestrutura", "Prefeitura Municipal", "Secretaria de Transportes", "Secretaria de Saúde"];
const statuses: Obra["status"][] = ["Em andamento", "Em andamento", "Em andamento", "Concluída", "Planejada", "Atrasada", "Paralisada"];
const nomes = [
  "Pavimentação da Av. Brasil", "Construção da UPA Central", "Reforma da Escola Municipal Tiradentes",
  "Modernização do Hospital Geral", "Ampliação do Sistema de Esgoto", "Construção do Viaduto Norte",
  "Revitalização da Praça da Matriz", "Drenagem do Bairro Rocha", "Construção da Creche Municipal",
  "Reforma do Terminal Rodoviário", "Pavimentação da Estrada do Sol", "Construção do Posto de Saúde",
  "Iluminação Pública da Orla", "Recuperação da Ponte do Rio Macacu", "Centro Cultural Municipal",
  "Saneamento Básico Zona Sul", "Reforma do Mercado Público", "Construção de Ciclovia",
];

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rnd = seedRand(42);

export const mockObras: Obra[] = Array.from({ length: 28 }).map((_, i) => {
  const valor = Math.round((500_000 + rnd() * 12_000_000) / 1000) * 1000;
  const pct = Math.round(rnd() * 100);
  const status = statuses[Math.floor(rnd() * statuses.length)];
  const finalPct = status === "Concluída" ? 100 : status === "Planejada" ? 0 : pct;
  const start = new Date(2023, Math.floor(rnd() * 12), 1 + Math.floor(rnd() * 27));
  const end = new Date(start.getTime() + (180 + rnd() * 540) * 86400000);
  return {
    id: `OBR-${1000 + i}`,
    nome: nomes[i % nomes.length] + (i >= nomes.length ? ` ${Math.floor(i / nomes.length) + 1}` : ""),
    municipio: municipiosRJ[Math.floor(rnd() * municipiosRJ.length)],
    status,
    valor_contratado: valor,
    valor_executado: Math.round((valor * finalPct) / 100),
    percentual_execucao: finalPct,
    data_inicio: start.toISOString(),
    data_fim_prevista: end.toISOString(),
    orgao_responsavel: orgaos[Math.floor(rnd() * orgaos.length)],
    empresa_contratada: empresas[Math.floor(rnd() * empresas.length)],
    descricao:
      "Intervenção pública destinada à melhoria da infraestrutura urbana, com foco em qualidade técnica, eficiência orçamentária e benefício direto à população do município.",
  };
});

export const mockMunicipios: Municipio[] = municipiosRJ.map((nome, i) => {
  const obras = mockObras.filter((o) => o.municipio === nome);
  return {
    id: `MUN-${100 + i}`,
    nome,
    total_obras: obras.length,
    obras_em_andamento: obras.filter((o) => o.status === "Em andamento").length,
    obras_concluidas: obras.filter((o) => o.status === "Concluída").length,
    obras_com_alerta: obras.filter((o) => o.status === "Atrasada" || o.status === "Paralisada").length,
    valor_total: obras.reduce((s, o) => s + o.valor_contratado, 0),
    eficiencia: Math.round(50 + rnd() * 50),
  };
});

export const mockContratos: Contrato[] = mockObras.map((o, i) => ({
  id: `CTR-${2000 + i}`,
  numero: `${2024}/${String(1000 + i).padStart(4, "0")}`,
  obra_id: o.id,
  obra_nome: o.nome,
  municipio: o.municipio,
  valor_contratado: o.valor_contratado,
  valor_executado: o.valor_executado,
  empresa: o.empresa_contratada,
  data_assinatura: o.data_inicio,
  status: o.status === "Concluída" ? "Encerrado" : o.status === "Paralisada" ? "Suspenso" : "Vigente",
}));

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