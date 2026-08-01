import type { RuntimePerfTrace } from "@/lib/retail-pos/runtime-perf";
import { RetailPosRuntimeError } from "@/lib/retail-pos/errors";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  RetailPosCostingProductSearchResponse,
  RetailPosCostingProductSearchResult,
  RetailPosCostingProductSearchMatchType,
} from "@/shared/types/retail-pos";

export const RETAIL_POS_COSTING_SEARCH_MAX_QUERY_LENGTH = 160;
export const RETAIL_POS_COSTING_SEARCH_MAX_LIMIT = 20;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MATCH_TYPES = new Set<RetailPosCostingProductSearchMatchType>([
  "exact_name",
  "name_prefix",
  "token_match",
  "fts",
  "trigram",
  "exact_sku",
  "sku_prefix",
]);

export type RetailPosCostingSearchInput = {
  tenantId: string;
  query: string;
  supplierId?: string | null;
  supplierOnly?: boolean;
  limit?: number;
  trace?: RuntimePerfTrace;
};

export type RetailPosCostingSearchQuery = {
  query: string;
  supplierId: string | null;
  supplierOnly: boolean;
  limit: number;
};

function invalid(message: string, details?: Record<string, unknown>) {
  return new RetailPosRuntimeError(400, message, "INVALID_SEARCH_REQUEST", details);
}

function normalizeForMinimumLength(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function parseBooleanQueryParam(value: string | null, name: string) {
  if (value === null) return false;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw invalid(`${name} debe ser true, false, 1 o 0.`, { parameter: name });
}

export function normalizeRetailPosCostingSearchQuery(
  input: Pick<RetailPosCostingSearchInput, "query" | "supplierId" | "supplierOnly" | "limit">,
): RetailPosCostingSearchQuery {
  if (typeof input.query !== "string") {
    throw invalid("q es obligatorio.", { parameter: "q" });
  }

  const query = input.query.trim();
  if (query.length > RETAIL_POS_COSTING_SEARCH_MAX_QUERY_LENGTH) {
    throw invalid(`q no puede exceder ${RETAIL_POS_COSTING_SEARCH_MAX_QUERY_LENGTH} caracteres.`, {
      parameter: "q",
    });
  }

  const supplierId = input.supplierId?.trim() || null;
  if (supplierId && !isUuid(supplierId)) {
    throw invalid("supplierId debe ser un UUID válido.", { parameter: "supplierId" });
  }

  const limit = input.limit ?? RETAIL_POS_COSTING_SEARCH_MAX_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > RETAIL_POS_COSTING_SEARCH_MAX_LIMIT) {
    throw invalid(`limit debe ser un entero entre 1 y ${RETAIL_POS_COSTING_SEARCH_MAX_LIMIT}.`, {
      parameter: "limit",
    });
  }

  return {
    query,
    supplierId,
    supplierOnly: Boolean(input.supplierOnly),
    limit,
  };
}

function isFiniteInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && Number.isInteger(value);
}

function nullableString(value: unknown) {
  return value === null || typeof value === "string" ? value : undefined;
}

function mapSearchRow(row: unknown): RetailPosCostingProductSearchResult {
  if (!row || typeof row !== "object") {
    throw new Error("Malformed costing search row");
  }

  const source = row as Record<string, unknown>;
  if (
    typeof source.product_id !== "string" ||
    typeof source.name !== "string" ||
    !isFiniteInteger(source.unit_price_cents) ||
    !isFiniteInteger(source.wholesale_price_cents) ||
    (source.cost_cents !== null && !isFiniteInteger(source.cost_cents))
  ) {
    throw new Error("Malformed costing search response");
  }

  const matchType = source.match_type;
  const rankScore = source.rank_score;
  if (matchType !== undefined && (typeof matchType !== "string" || !MATCH_TYPES.has(matchType as RetailPosCostingProductSearchMatchType))) {
    throw new Error("Malformed costing search match type");
  }
  if (rankScore !== undefined && (typeof rankScore !== "number" || !Number.isFinite(rankScore))) {
    throw new Error("Malformed costing search rank score");
  }

  const result: RetailPosCostingProductSearchResult = {
    productId: source.product_id,
    name: source.name,
    sku: nullableString(source.sku) ?? null,
    barcode: nullableString(source.barcode) ?? null,
    brand: nullableString(source.brand) ?? null,
    categoryName: nullableString(source.category_name) ?? null,
    supplierId: nullableString(source.supplier_id) ?? null,
    supplierName: nullableString(source.supplier_name) ?? null,
    salesUnitCode: nullableString(source.sales_unit_code) ?? null,
    salesUnitLabel: nullableString(source.sales_unit_label) ?? null,
    costCents: source.cost_cents ?? 0,
    publicPriceCents: source.unit_price_cents,
    wholesalePriceCents: source.wholesale_price_cents,
  };

  if (typeof matchType === "string") result.matchType = matchType as RetailPosCostingProductSearchMatchType;
  if (typeof rankScore === "number") result.rankScore = rankScore;
  return result;
}

export async function searchRetailPosCostingProducts(
  input: RetailPosCostingSearchInput,
): Promise<RetailPosCostingProductSearchResponse> {
  if (!isUuid(input.tenantId)) {
    throw new RetailPosRuntimeError(500, "No fue posible resolver el tenant.", "TENANT_CONTEXT_INVALID");
  }

  const normalized = normalizeRetailPosCostingSearchQuery(input);
  const meta = {
    query: normalized.query,
    supplierOnly: normalized.supplierOnly,
  };

  if (normalizeForMinimumLength(normalized.query).length < 2) {
    return { results: [], meta: { ...meta, count: 0 } };
  }

  const supabase = getSupabaseAdminClient({ trace: input.trace });
  const rpcStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { data, error } = await supabase.rpc("retail_pos_search_costing_products_v1", {
    p_tenant_id: input.tenantId,
    p_query: normalized.query,
    p_supplier_id: normalized.supplierId,
    p_supplier_only: normalized.supplierOnly,
    p_limit: normalized.limit,
  });
  const rpcDurationMs =
    (typeof performance !== "undefined" ? performance.now() : Date.now()) - rpcStartedAt;
  input.trace?.recordSupabaseDuration(rpcDurationMs);
  input.trace?.addDuration("rpc", rpcDurationMs);

  if (error) {
    const errorCode = typeof error.code === "string" ? error.code : "";
    const message = typeof error.message === "string" ? error.message : "";
    const knownCode =
      message.includes("RETAIL_POS_SUPPLIER_NOT_FOUND")
        ? "SUPPLIER_NOT_FOUND"
        : message.includes("RETAIL_POS_SEARCH_QUERY_TOO_SHORT")
          ? "QUERY_TOO_SHORT"
          : message.includes("RETAIL_POS_SEARCH_QUERY_REQUIRED")
            ? "QUERY_REQUIRED"
            : null;

    if (knownCode === "SUPPLIER_NOT_FOUND") {
      throw new RetailPosRuntimeError(400, "El proveedor no pertenece al tenant.", knownCode);
    }

    console.error(
      `[retail-pos][catalog-search] ${JSON.stringify({
        operation: "retail_pos_search_costing_products_v1",
        tenant_id: input.tenantId,
        query_length: normalized.query.length,
        supplier_id: normalized.supplierId,
        supplier_only: normalized.supplierOnly,
        limit: normalized.limit,
        rpc_duration_ms: Math.round(rpcDurationMs * 100) / 100,
        error_code: errorCode || null,
        error_message: message,
      })}`,
    );
    throw new RetailPosRuntimeError(500, "No fue posible buscar productos.", "COSTING_SEARCH_FAILED");
  }

  try {
    const results = (Array.isArray(data) ? data : []).map(mapSearchRow);
    return { results, meta: { ...meta, count: results.length } };
  } catch (error) {
    console.error("[retail-pos][catalog-search] malformed RPC response", error);
    throw new RetailPosRuntimeError(500, "La búsqueda devolvió una respuesta inválida.", "COSTING_SEARCH_INVALID_RESPONSE");
  }
}
