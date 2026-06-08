/**
 * Centralized mock data for the Argus frontend.
 *
 * Each entity has its own file so swapping a mock for a real
 * FastAPI response is a single-file change. The shape of every
 * export here MUST match the equivalent endpoint defined in
 * `src/lib/services/*` and the contracts in `src/types`.
 */
export { mockObras, MUNICIPIOS_RJ } from "./obras";
export { mockMunicipios } from "./municipios";
export { mockContratos } from "./contratos";
export { mockAlertas } from "./alertas";
export { mockSummary } from "./summary";
