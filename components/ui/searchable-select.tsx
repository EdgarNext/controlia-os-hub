"use client";

import { ChevronDown, Check, Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Label } from "./label";

export type SearchableSelectOption = {
  value: string;
  label: string;
  keywords?: string[];
  disabled?: boolean;
};

type SearchableSelectProps = {
  id?: string;
  name: string;
  label?: string;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyText?: string;
  defaultValue?: string;
  disabled?: boolean;
  required?: boolean;
  errorText?: string | null;
  helpText?: string;
  className?: string;
  onValueChange?: (value: string) => void;
  clearable?: boolean;
};

export function SearchableSelect({
  id,
  name,
  label,
  options,
  placeholder = "Selecciona una opción",
  emptyText = "Sin resultados",
  defaultValue = "",
  disabled = false,
  required = false,
  errorText,
  helpText,
  className,
  onValueChange,
  clearable = false,
}: SearchableSelectProps) {
  const selectId = id ?? name;
  const listboxId = `${selectId}-listbox`;
  const describedById = errorText ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined;
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedValue, setSelectedValue] = useState(defaultValue);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const uniqueOptions = useMemo(() => {
    const seen = new Set<string>();
    const deduped: SearchableSelectOption[] = [];
    for (const option of options) {
      if (seen.has(option.value)) continue;
      seen.add(option.value);
      deduped.push(option);
    }
    return deduped;
  }, [options]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredOptions = useMemo(() => {
    if (!normalizedQuery) return uniqueOptions.filter((option) => !option.disabled);
    return uniqueOptions.filter((option) => {
      if (option.disabled) return false;
      const haystack = [option.label, ...(option.keywords ?? [])].join(" ").toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, uniqueOptions]);

  const selectedOption = uniqueOptions.find((option) => option.value === selectedValue) ?? null;

  useEffect(() => {
    setSelectedValue(defaultValue);
  }, [defaultValue]);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setQuery("");
      }
    }
    window.addEventListener("mousedown", handlePointer);
    return () => window.removeEventListener("mousedown", handlePointer);
  }, []);

  function commitValue(value: string) {
    setSelectedValue(value);
    setIsOpen(false);
    setQuery("");
    onValueChange?.(value);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => Math.min(prev + 1, Math.max(filteredOptions.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsOpen(true);
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else if (filteredOptions[highlightedIndex]) {
        commitValue(filteredOptions[highlightedIndex].value);
      }
      return;
    }
    if (event.key === "Escape") {
      setIsOpen(false);
      setQuery("");
    }
  }

  return (
    <div className={cn("space-y-1", className)} ref={rootRef}>
      {label ? <Label htmlFor={selectId}>{label}</Label> : null}
      <input type="hidden" name={name} value={selectedValue} required={required} />
      <div className="relative">
        <button
          id={selectId}
          type="button"
          role="combobox"
          disabled={disabled}
          aria-describedby={describedById}
          aria-invalid={Boolean(errorText) || undefined}
          aria-expanded={isOpen}
          aria-controls={listboxId}
          onClick={() => {
            if (disabled) return;
            setHighlightedIndex(0);
            setIsOpen((prev) => !prev);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-11 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 px-3 text-left text-sm text-foreground outline-none transition-colors",
            "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary",
            "disabled:cursor-not-allowed disabled:opacity-60",
            errorText && "border-danger focus-visible:border-danger focus-visible:ring-danger/30",
          )}
        >
          <span className={cn(!selectedOption && "text-muted")}>{selectedOption?.label ?? placeholder}</span>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        </button>

        {isOpen ? (
          <div className="absolute z-30 mt-1 w-full rounded-[var(--radius-base)] border border-border bg-surface p-2 shadow-[var(--shadow-soft)]">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setHighlightedIndex(0);
                }}
                autoFocus
                placeholder="Buscar..."
                aria-invalid={Boolean(errorText) || undefined}
                aria-describedby={describedById}
                className="h-9 w-full rounded-[var(--radius-base)] border border-border bg-surface-2 pl-8 pr-8 text-sm text-foreground outline-none placeholder:text-muted focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted transition-colors hover:text-foreground"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <ul id={listboxId} role="listbox" className="mt-2 max-h-56 overflow-auto rounded-[var(--radius-base)] border border-border bg-surface">
              {filteredOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-muted">{emptyText}</li>
              ) : (
                filteredOptions.map((option, index) => {
                  const isSelected = option.value === selectedValue;
                  const isHighlighted = index === highlightedIndex;
                  return (
                    <li key={option.value}>
                      <button
                        type="button"
                        onClick={() => commitValue(option.value)}
                        className={cn(
                          "flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground transition-colors",
                          isHighlighted && "bg-surface-2",
                          isSelected && "font-medium",
                          "hover:bg-surface-2",
                        )}
                      >
                        <span>{option.label}</span>
                        {isSelected ? <Check aria-hidden="true" className="h-4 w-4 text-primary" /> : null}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
            {clearable && selectedValue ? (
              <button
                type="button"
                onClick={() => commitValue("")}
                className="mt-2 inline-flex rounded-[var(--radius-base)] border border-border bg-surface-2 px-2 py-1 text-xs text-muted transition-colors hover:text-foreground"
              >
                Limpiar selección
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {errorText ? (
        <p id={`${selectId}-error`} className="text-sm text-danger">
          {errorText}
        </p>
      ) : helpText ? (
        <p id={`${selectId}-help`} className="text-sm text-muted">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
