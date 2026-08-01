import type {
  RetailPosCostingProductSearchResponse,
  RetailPosCostingProductSearchResult,
} from "@/shared/types/retail-pos";

export type CostingSearchClientInput = {
  tenantSlug: string;
  query: string;
  supplierId?: string | null;
  supplierOnly: boolean;
  limit?: number;
  signal?: AbortSignal;
};

export function normalizeCostingSearchClientQuery(query: string) {
  return query
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function buildCostingSearchUrl(input: CostingSearchClientInput) {
  const params = new URLSearchParams();
  params.set("q", input.query);
  if (input.supplierId) params.set("supplierId", input.supplierId);
  params.set("supplierOnly", input.supplierOnly ? "true" : "false");
  params.set("limit", String(input.limit ?? 20));
  return `/api/tenant/${encodeURIComponent(input.tenantSlug)}/retail-pos/catalog/costing-search?${params.toString()}`;
}

export async function fetchCostingProducts(
  input: CostingSearchClientInput,
  fetcher: typeof fetch = fetch,
): Promise<RetailPosCostingProductSearchResult[]> {
  const response = await fetcher(buildCostingSearchUrl(input), {
    method: "GET",
    signal: input.signal,
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | RetailPosCostingProductSearchResponse
    | { error?: string }
    | null;

  if (!response.ok) {
    const message =
      response.status === 401
        ? "Tu sesión expiró."
        : response.status === 403
          ? "No tienes permiso para consultar este catálogo."
          : "No fue posible buscar productos.";
    throw new Error(message);
  }

  if (!payload || !("results" in payload) || !Array.isArray(payload.results)) {
    throw new Error("No fue posible buscar productos.");
  }

  return payload.results;
}
