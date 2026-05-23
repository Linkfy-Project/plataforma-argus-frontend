import type { Obra } from "@/types";

const municipiosRJ = [
  "Rio de Janeiro", "Niterói", "São Gonçalo", "Duque de Caxias", "Nova Iguaçu",
  "Petrópolis", "Volta Redonda", "Campos dos Goytacazes", "Macaé", "Angra dos Reis",
  "Cabo Frio", "Teresópolis",
];

const empresas = [
  "Construtora Atlântico S.A.", "Engebrás Ltda.", "OAS Engenharia", "Construcap",
  "Queiroz Galvão", "Odebrecht Infra", "Mendes Júnior",
];
const orgaos = [
  "Secretaria Municipal de Obras", "Secretaria de Infraestrutura", "Prefeitura Municipal",
  "Secretaria de Transportes", "Secretaria de Saúde",
];
const statuses: Obra["status"][] = [
  "Em andamento", "Em andamento", "Em andamento", "Concluída", "Planejada", "Atrasada", "Paralisada",
];
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

export const MUNICIPIOS_RJ = municipiosRJ;

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