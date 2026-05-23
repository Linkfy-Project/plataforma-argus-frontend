import type { Municipio } from "@/types";
import { mockObras, MUNICIPIOS_RJ } from "./obras";

function pseudoEficiencia(seed: number) {
  let s = seed;
  const r = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  return Math.round(55 + r() * 40);
}

export const mockMunicipios: Municipio[] = MUNICIPIOS_RJ.map((nome, i) => {
  const obras = mockObras.filter((o) => o.municipio === nome);
  return {
    id: `MUN-${100 + i}`,
    nome,
    total_obras: obras.length,
    obras_em_andamento: obras.filter((o) => o.status === "Em andamento").length,
    obras_concluidas: obras.filter((o) => o.status === "Concluída").length,
    obras_com_alerta: obras.filter((o) => o.status === "Atrasada" || o.status === "Paralisada").length,
    valor_total: obras.reduce((s, o) => s + o.valor_contratado, 0),
    eficiencia: pseudoEficiencia(i + 7),
  };
});