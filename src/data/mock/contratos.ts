import type { Contrato } from "@/types";
import { mockObras } from "./obras";

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
  status:
    o.status === "Concluída" ? "Encerrado" : o.status === "Paralisada" ? "Suspenso" : "Vigente",
}));
