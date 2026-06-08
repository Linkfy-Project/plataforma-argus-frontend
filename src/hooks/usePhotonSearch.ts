import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Representa uma feature retornada pela API Photon (Komoot).
 * Cada resultado contém propriedades geográficas e coordenadas.
 */
export interface PhotonFeature {
  /** Nome principal do local */
  name: string;
  /** Rua/logradouro (quando disponível) */
  street?: string;
  /** Cidade */
  city?: string;
  /** Estado/UF */
  state?: string;
  /** País */
  country?: string;
  /** Tipo do resultado (ex: "locality", "street", "house") */
  type: string;
  /** Latitude (WGS84) */
  lat: number;
  /** Longitude (WGS84) */
  lng: number;
}

/**
 * Parâmetros de configuração do hook de busca Photon.
 */
interface UsePhotonSearchOptions {
  /** Tempo de debounce em milissegundos (padrão: 300ms) */
  debounceMs?: number;
  /** Limite máximo de resultados (padrão: 5) */
  limit?: number;
  /** Idioma dos resultados (padrão: "pt") */
  lang?: string;
}

/**
 * Valor de retorno do hook de busca Photon.
 */
interface UsePhotonSearchReturn {
  /** Lista de sugestões geocodificadas */
  suggestions: PhotonFeature[];
  /** Indica se uma requisição está em andamento */
  isLoading: boolean;
  /** Erro ocorrido durante a busca (null se não houver erro) */
  error: Error | null;
  /** Atualiza a query de busca (com debounce aplicado internamente) */
  setQuery: (query: string) => void;
  /** Limpa as sugestões e reseta o estado */
  clearSuggestions: () => void;
}

/**
 * URL base da API Photon do Komoot para geocodificação.
 */
const PHOTON_API_URL = "https://photon.komoot.io/api/";

/**
 * Hook customizado para busca geográfica com autocomplete usando a API Photon.
 *
 * Implementa debounce de 300ms para evitar sobrecarregar a API durante digitação.
 * Trata erros de rede graciosamente e permite configuração de idioma e limite.
 *
 * @param options - Configurações opcionais (debounce, limit, lang)
 * @returns Objeto com sugestões, estado de loading, erro e funções de controle
 *
 * @example
 * ```tsx
 * const { suggestions, isLoading, setQuery } = usePhotonSearch();
 * // Ao digitar: setQuery("Praia de Copacabana")
 * // suggestions conterá os resultados geocodificados
 * ```
 */
export function usePhotonSearch(options: UsePhotonSearchOptions = {}): UsePhotonSearchReturn {
  const { debounceMs = 300, limit = 5, lang = "pt" } = options;

  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Ref para controlar o timer de debounce
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para controlar AbortController (cancelar requisições anteriores)
  const abortControllerRef = useRef<AbortController | null>(null);
  // Ref para a query atual (evita closures desatualizadas)
  const queryRef = useRef<string>("");

  /**
   * Executa a busca na API Photon com a query fornecida.
   * Cancela qualquer requisição anterior em andamento.
   */
  const fetchSuggestions = useCallback(
    async (query: string) => {
      // Se a query estiver vazia, limpa as sugestões
      if (!query.trim()) {
        setSuggestions([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Cancela requisição anterior se existir
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Cria novo AbortController para esta requisição
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setIsLoading(true);
      setError(null);

      try {
        // Monta a URL com os parâmetros de busca
        const params = new URLSearchParams({
          q: query.trim(),
          lang,
          limit: String(limit),
        });

        const response = await fetch(`${PHOTON_API_URL}?${params.toString()}`, {
          signal: controller.signal,
        });

        // Se a requisição foi abortada, não processa
        if (controller.signal.aborted) return;

        if (!response.ok) {
          throw new Error(`Erro na busca geográfica: ${response.status}`);
        }

        const data = await response.json();

        // Mapeia as features GeoJSON para o formato simplificado
        const features: PhotonFeature[] = (data.features || []).map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (feature: any) => {
            const props = feature.properties || {};
            const coords = feature.geometry?.coordinates || [0, 0];

            return {
              name: props.name || props.street || "Local sem nome",
              street: props.street || undefined,
              city: props.city || undefined,
              state: props.state || undefined,
              country: props.country || undefined,
              type: props.type || "unknown",
              // Photon retorna coordenadas no formato [lng, lat]
              lng: coords[0],
              lat: coords[1],
            };
          },
        );

        // Só atualiza se a query ainda for a mesma (evita race condition)
        if (queryRef.current === query) {
          setSuggestions(features);
        }
      } catch (err: unknown) {
        // Ignora erros de abort (navegação cancelada pelo usuário)
        if (err instanceof DOMException && err.name === "AbortError") return;

        console.error("[usePhotonSearch] Erro ao buscar sugestões:", err);
        setError(err instanceof Error ? err : new Error("Erro desconhecido na busca"));
        setSuggestions([]);
      } finally {
        // Só atualiza loading se não foi abortado
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [lang, limit],
  );

  /**
   * Atualiza a query de busca com debounce.
   * A cada nova chamada, reinicia o timer de debounce.
   */
  const setQuery = useCallback(
    (query: string) => {
      queryRef.current = query;

      // Limpa timer anterior
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Se a query estiver vazia, limpa imediatamente
      if (!query.trim()) {
        setSuggestions([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Indica que está carregando (feedback imediato)
      setIsLoading(true);

      // Inicia novo timer de debounce
      debounceTimerRef.current = setTimeout(() => {
        fetchSuggestions(query);
      }, debounceMs);
    },
    [debounceMs, fetchSuggestions],
  );

  /**
   * Limpa todas as sugestões e reseta o estado do hook.
   */
  const clearSuggestions = useCallback(() => {
    queryRef.current = "";
    setSuggestions([]);
    setIsLoading(false);
    setError(null);

    // Cancela requisição pendente
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Limpa timer de debounce
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  }, []);

  // Cleanup: cancela timers e requisições ao desmontar o componente
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return { suggestions, isLoading, error, setQuery, clearSuggestions };
}
