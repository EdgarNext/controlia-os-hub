"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useTransition, type ReactNode } from "react";

type CatalogNavigationContextValue = { isPending: boolean; navigate: (nextUrl: string) => void };
const CatalogNavigationContext = createContext<CatalogNavigationContextValue | null>(null);

export function useCatalogNavigation() {
  const context = useContext(CatalogNavigationContext);
  if (!context) throw new Error("useCatalogNavigation debe utilizarse dentro de CatalogNavigationShell.");
  return context;
}

export function useOptionalCatalogNavigation() {
  return useContext(CatalogNavigationContext);
}

export function CatalogNavigationShell({ children }: { children: ReactNode }) {
  const router = useRouter(); const pathname = usePathname(); const [isPending, startTransition] = useTransition();
  function navigate(nextUrl: string) { startTransition(() => router.replace(nextUrl.startsWith("/") ? nextUrl : `${pathname}${nextUrl}`, { scroll: false })); }
  return <CatalogNavigationContext.Provider value={{ isPending, navigate }}>{children}</CatalogNavigationContext.Provider>;
}

export function CatalogResultsFrame({ children }: { children: ReactNode }) {
  const { isPending } = useCatalogNavigation();
  return <section aria-busy={isPending} className="relative min-w-0"><div className={`pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden transition-opacity duration-150 ${isPending ? "opacity-100 delay-200" : "opacity-0"}`}><div className="catalog-progress-indeterminate h-full" /></div><div className="flex min-h-5 items-center justify-end" role="status" aria-live="polite"><span className={`text-sm text-muted transition-opacity duration-150 ${isPending ? "opacity-100 delay-200" : "opacity-0"}`}>Actualizando resultados…</span><span className="sr-only">{isPending ? "Actualizando resultados" : ""}</span></div><div inert={isPending || undefined} aria-disabled={isPending || undefined} className={`transition-opacity duration-150 ${isPending ? "pointer-events-none opacity-65" : "opacity-100"}`}>{children}</div></section>;
}
