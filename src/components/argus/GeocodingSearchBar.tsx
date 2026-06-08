import { useState, useRef, useEffect, useCallback } from "react";
import { Search, MapPin, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { usePhotonSearch } from "@/hooks/usePhotonSearch";
import type { PhotonFeature } from "@/hooks/usePhotonSearch";
import { cn } from "@/lib/utils";

/**
 * Resultado selecionado pelo usuário no autocomplete.
 */
export interface GeocodingResult {
  /** Latitude (WGS84) */
  lat: number;
  /** Longitude (WGS84) */
  lng: number;
  /** Nome legível do local selecionado */
  name: string;
}

/**
 * Props do componente GeocodingSearchBar.
 */
interface GeocodingSearchBarProps {
  /** Callback disparado quando o usuário seleciona uma sugestão */
  onSelect: (result: GeocodingResult) => void;
  /** Placeholder customizado do input */
  placeholder?: string;
  /** Classes CSS adicionais para o container */
  className?: string;
  /** Altura do input (padrão: "h-14") */
  inputHeight?: string;
  /** Variante visual: "default" (grande, para o cidadão) ou "compact" (pequeno, para filtros) */
  variant?: "default" | "compact";
}

/**
 * Monta o texto descritivo de uma sugestão Photon.
 * Combina cidade, estado e país quando disponíveis.
 */
function buildDescription(feature: PhotonFeature): string {
  const parts: string[] = [];
  if (feature.city) parts.push(feature.city);
  if (feature.state) parts.push(feature.state);
  if (feature.country && !parts.length) parts.push(feature.country);
  return parts.join(", ");
}

/**
 * Componente de busca geográfica reutilizável com autocomplete.
 *
 * Utiliza a API Photon (Komoot) para geocodificação em tempo real.
 * Suporta navegação por teclado (setas para cima/baixo, Enter para selecionar, Esc para fechar).
 * O dropdown fecha automaticamente ao clicar fora do componente.
 *
 * @example
 * ```tsx
 * <GeocodingSearchBar
 *   onSelect={(result) => {
 *     map.flyTo([result.lat, result.lng], 16);
 *   }}
 * />
 * ```
 */
export function GeocodingSearchBar({
  onSelect,
  placeholder = "🔍 Busque por bairro, rua ou local...",
  className,
  inputHeight = "h-14",
  variant = "default",
}: GeocodingSearchBarProps) {
  const { suggestions, isLoading, error, setQuery, clearSuggestions } = usePhotonSearch({
    debounceMs: 300,
    limit: 5,
    lang: "pt",
  });

  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  // Refs para detectar clique fora e controlar o dropdown
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  /**
   * Fecha o dropdown ao clicar fora do componente.
   */
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Abre o dropdown quando há sugestões disponíveis.
   */
  useEffect(() => {
    if (suggestions.length > 0 && inputValue.trim()) {
      setIsOpen(true);
    } else {
      setIsOpen(false);
    }
    setActiveIndex(-1);
  }, [suggestions, inputValue]);

  /**
   * Trata a mudança no valor do input.
   * Atualiza o estado local e propaga para o hook de busca.
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);
      setQuery(value);
    },
    [setQuery],
  );

  /**
   * Trata a seleção de uma sugestão.
   * Fecha o dropdown e dispara o callback onSelect.
   */
  const handleSelect = useCallback(
    (feature: PhotonFeature) => {
      const name = feature.name + (feature.city ? `, ${feature.city}` : "");
      setInputValue(name);
      setIsOpen(false);
      setActiveIndex(-1);
      clearSuggestions();

      onSelect({
        lat: feature.lat,
        lng: feature.lng,
        name,
      });
    },
    [onSelect, clearSuggestions],
  );

  /**
   * Limpa o input e as sugestões.
   */
  const handleClear = useCallback(() => {
    setInputValue("");
    clearSuggestions();
    setIsOpen(false);
    setActiveIndex(-1);
    inputRef.current?.focus();
  }, [clearSuggestions]);

  /**
   * Trata a navegação por teclado no dropdown.
   * - Seta para baixo: move o destaque para o próximo item
   * - Seta para cima: move o destaque para o item anterior
   * - Enter: seleciona o item destacado
   * - Esc: fecha o dropdown
   */
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            handleSelect(suggestions[activeIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setActiveIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, activeIndex, handleSelect],
  );

  /**
   * Rola o item ativo para ficar visível no dropdown.
   */
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[activeIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex]);

  const isCompact = variant === "compact";

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Campo de busca */}
      <div className="relative">
        <Search
          className={cn(
            "absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground",
            isCompact ? "left-2.5 h-3.5 w-3.5" : "left-4 h-5 w-5",
          )}
        />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && inputValue.trim()) {
              setIsOpen(true);
            }
          }}
          className={cn(
            "w-full rounded-xl border-border bg-card pr-10 text-base shadow-sm placeholder:text-muted-foreground/60",
            inputHeight,
            isCompact ? "pl-8 text-xs" : "pl-12",
          )}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-activedescendant={activeIndex >= 0 ? `photon-option-${activeIndex}` : undefined}
          aria-label="Buscar localização geográfica"
        />

        {/* Ícone de loading ou botão de limpar */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : inputValue ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Dropdown de sugestões */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          aria-label="Sugestões de localização"
          className={cn(
            "absolute left-0 right-0 z-[9999] mt-1 max-h-60 overflow-auto rounded-xl border border-border bg-card shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {suggestions.map((feature, index) => {
            const description = buildDescription(feature);
            const isActive = index === activeIndex;

            return (
              <li
                key={`${feature.lat}-${feature.lng}-${index}`}
                id={`photon-option-${index}`}
                role="option"
                aria-selected={isActive}
                className={cn(
                  "flex cursor-pointer items-start gap-3 px-4 py-2.5 transition-colors",
                  isActive ? "bg-primary/10 text-foreground" : "hover:bg-muted/60",
                  index === 0 && "rounded-t-xl",
                  index === suggestions.length - 1 && "rounded-b-xl",
                )}
                onClick={() => handleSelect(feature)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{feature.name}</p>
                  {description && (
                    <p className="truncate text-xs text-muted-foreground">{description}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Mensagem de erro (sutil, não bloqueante) */}
      {error && !isLoading && (
        <p className="mt-1 text-xs text-destructive/70">
          Não foi possível buscar localizações. Tente novamente.
        </p>
      )}
    </div>
  );
}
