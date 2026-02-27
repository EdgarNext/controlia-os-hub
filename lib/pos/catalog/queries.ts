import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  PosCatalogCategoryListItem,
  PosCatalogCategorySelectItem,
  PosCatalogProductListItem,
} from "@/types/pos-catalog";

type ListCatalogInput = {
  tenantId: string;
};

type GetCatalogCategoryByIdInput = {
  tenantId: string;
  id: string;
};

type GetCatalogProductByIdInput = {
  tenantId: string;
  id: string;
};

type ProductRow = Omit<PosCatalogProductListItem, "category_name">;

async function loadCategoryNamesByIds(tenantId: string, categoryIds: string[]) {
  if (categoryIds.length === 0) {
    return new Map<string, string>();
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select("id, name")
    .eq("tenant_id", tenantId)
    .in("id", categoryIds)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to load category names: ${error.message}`);
  }

  return new Map((data ?? []).map((row) => [row.id, row.name]));
}

export async function listCatalogCategories({
  tenantId,
}: ListCatalogInput): Promise<PosCatalogCategoryListItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select(
      "id, tenant_id, name, sort_order, is_active, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .eq("tenant_id", tenantId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load catalog categories: ${error.message}`);
  }

  return (data ?? []) as PosCatalogCategoryListItem[];
}

export async function listCatalogCategoriesForSelect({
  tenantId,
}: ListCatalogInput): Promise<PosCatalogCategorySelectItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select("id, tenant_id, name")
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load categories for select: ${error.message}`);
  }

  return (data ?? []) as PosCatalogCategorySelectItem[];
}

export async function getCatalogCategoryById({
  tenantId,
  id,
}: GetCatalogCategoryByIdInput): Promise<PosCatalogCategoryListItem | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select(
      "id, tenant_id, name, sort_order, is_active, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load catalog category: ${error.message}`);
  }

  return (data as PosCatalogCategoryListItem | null) ?? null;
}

export async function listCatalogProducts({
  tenantId,
}: ListCatalogInput): Promise<PosCatalogProductListItem[]> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select(
      "id, tenant_id, category_id, name, price_cents, is_active, is_sold_out, is_popular, image_path, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .eq("tenant_id", tenantId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load catalog products: ${error.message}`);
  }

  const rows = (data ?? []) as ProductRow[];
  const categoryIds = rows
    .map((row) => row.category_id)
    .filter((value): value is string => Boolean(value));
  const categoryNameById = await loadCategoryNamesByIds(tenantId, categoryIds);

  return rows.map((row) => ({
    ...row,
    category_name: row.category_id ? categoryNameById.get(row.category_id) ?? null : null,
  }));
}

export async function getCatalogProductById({
  tenantId,
  id,
}: GetCatalogProductByIdInput): Promise<PosCatalogProductListItem | null> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_items")
    .select(
      "id, tenant_id, category_id, name, price_cents, is_active, is_sold_out, is_popular, image_path, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load catalog product: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const row = data as ProductRow;
  const categoryNameById =
    row.category_id != null
      ? await loadCategoryNamesByIds(tenantId, [row.category_id])
      : new Map<string, string>();

  return {
    ...row,
    category_name: row.category_id ? categoryNameById.get(row.category_id) ?? null : null,
  };
}
