import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PosCatalogCategory,
  PosCatalogItem,
  PosCatalogUser,
  PosCatalogVariant,
  PosSyncCatalogResponse,
} from "@/types/pos";

function normalizeSince(since?: string | null): string | null {
  if (!since) {
    return null;
  }

  const parsed = new Date(since);

  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid since timestamp.");
  }

  return parsed.toISOString();
}

export async function getCatalogSyncPayload(input: {
  tenantId: string;
  tenantSlug: string;
  since?: string | null;
}): Promise<PosSyncCatalogResponse> {
  const sinceIso = normalizeSince(input.since);
  const supabase = getSupabaseAdminClient();

  const categoriesQuery = supabase
    .from("catalog_categories")
    .select("id, tenant_id, name, sort_order, is_active, image_path, deleted_at, updated_at")
    .eq("tenant_id", input.tenantId)
    .order("updated_at", { ascending: true });

  const itemsQuery = supabase
    .from("catalog_items")
    .select(
      "id, tenant_id, category_id, type, class, name, price_cents, is_active, has_variants, is_sold_out, is_popular, image_path, deleted_at, updated_at",
    )
    .eq("tenant_id", input.tenantId)
    .order("updated_at", { ascending: true });

  const variantsQuery = supabase
    .from("catalog_variants")
    .select("id, tenant_id, catalog_item_id, label, is_active, updated_at")
    .eq("tenant_id", input.tenantId)
    .order("updated_at", { ascending: true });

  const usersQuery = supabase
    .from("pos_users")
    .select("id, tenant_id, name, pin_hash, role, is_active, updated_at")
    .eq("tenant_id", input.tenantId)
    .order("updated_at", { ascending: true });

  const filteredCategories = sinceIso
    ? categoriesQuery.or(`updated_at.gt.${sinceIso},deleted_at.gt.${sinceIso}`)
    : categoriesQuery.is("deleted_at", null);

  const filteredItems = sinceIso
    ? itemsQuery.or(`updated_at.gt.${sinceIso},deleted_at.gt.${sinceIso}`)
    : itemsQuery.is("deleted_at", null);

  const filteredVariants = sinceIso ? variantsQuery.gt("updated_at", sinceIso) : variantsQuery;
  const filteredUsers = sinceIso ? usersQuery.gt("updated_at", sinceIso) : usersQuery;

  const [categoriesResult, itemsResult, variantsResult, usersResult] = await Promise.all([
    filteredCategories,
    filteredItems,
    filteredVariants,
    filteredUsers,
  ]);

  if (categoriesResult.error) {
    throw new Error(`Unable to sync categories: ${categoriesResult.error.message}`);
  }

  if (itemsResult.error) {
    throw new Error(`Unable to sync items: ${itemsResult.error.message}`);
  }

  if (variantsResult.error) {
    throw new Error(`Unable to sync variants: ${variantsResult.error.message}`);
  }

  if (usersResult.error) {
    throw new Error(`Unable to sync users: ${usersResult.error.message}`);
  }

  return {
    tenantId: input.tenantId,
    tenantSlug: input.tenantSlug,
    syncedAt: new Date().toISOString(),
    incremental: Boolean(sinceIso),
    imageBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/catalog-images`
      : null,
    categories: (categoriesResult.data ?? []) as PosCatalogCategory[],
    items: (itemsResult.data ?? []) as PosCatalogItem[],
    variants: (variantsResult.data ?? []) as PosCatalogVariant[],
    users: (usersResult.data ?? []) as PosCatalogUser[],
  };
}
