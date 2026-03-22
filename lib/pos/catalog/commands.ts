import { getSupabaseServerClient } from "@/lib/supabase/server";
import { CATALOG_IMAGES_BUCKET, getCatalogImagePath } from "@/lib/pos/catalog/images";
import type {
  PosCatalogCategoryFormValues,
  PosCatalogCategoryListItem,
  PosCatalogProductFormValues,
  PosCatalogProductListItem,
} from "@/types/pos-catalog";

type CreateCatalogCategoryInput = {
  tenantId: string;
  actorUserId: string;
  input: PosCatalogCategoryFormValues;
};

type UpdateCatalogCategoryInput = {
  tenantId: string;
  id: string;
  actorUserId: string;
  input: PosCatalogCategoryFormValues;
};

type CreateCatalogProductInput = {
  tenantId: string;
  actorUserId: string;
  input: PosCatalogProductFormValues;
  imageFile?: File | null;
};

type UpdateCatalogProductInput = {
  tenantId: string;
  id: string;
  actorUserId: string;
  input: PosCatalogProductFormValues;
  imageFile?: File | null;
};

type UpdateCatalogProductFlagsInput = {
  tenantId: string;
  id: string;
  actorUserId: string;
  is_active: boolean;
  is_sold_out: boolean;
  is_popular: boolean;
};

type ArchiveCatalogProductInput = {
  tenantId: string;
  id: string;
  actorUserId: string;
};

async function assertCategoryBelongsToTenant(
  tenantId: string,
  categoryId: string,
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("catalog_categories")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("id", categoryId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to validate category: ${error.message}`);
  }

  if (!data) {
    throw new Error("La categoría no pertenece al tenant activo.");
  }
}

async function uploadCatalogItemImage(input: {
  tenantId: string;
  productId: string;
  imageFile: File;
}): Promise<string> {
  const imagePath = getCatalogImagePath({
    tenantId: input.tenantId,
    kind: "items",
    id: input.productId,
    file: input.imageFile,
  });

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.storage
    .from(CATALOG_IMAGES_BUCKET)
    .upload(imagePath, input.imageFile, {
      upsert: true,
      contentType: input.imageFile.type || undefined,
    });

  if (error) {
    throw new Error(`Unable to upload product image: ${error.message}`);
  }

  return imagePath;
}

export async function createCatalogCategory({
  tenantId,
  actorUserId,
  input,
}: CreateCatalogCategoryInput): Promise<PosCatalogCategoryListItem> {
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("catalog_categories")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      sort_order: input.sort_order,
      is_active: input.is_active,
      created_by: actorUserId,
      updated_by: actorUserId,
      updated_at: nowIso,
    })
    .select(
      "id, tenant_id, name, sort_order, is_active, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .single();

  if (error) {
    throw new Error(`Unable to create catalog category: ${error.message}`);
  }

  return data as PosCatalogCategoryListItem;
}

export async function updateCatalogCategory({
  tenantId,
  id,
  actorUserId,
  input,
}: UpdateCatalogCategoryInput): Promise<PosCatalogCategoryListItem> {
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("catalog_categories")
    .update({
      name: input.name,
      sort_order: input.sort_order,
      is_active: input.is_active,
      updated_by: actorUserId,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .select(
      "id, tenant_id, name, sort_order, is_active, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to update catalog category: ${error.message}`);
  }

  if (!data) {
    throw new Error("Catalog category not found for this tenant.");
  }

  return data as PosCatalogCategoryListItem;
}

export async function createCatalogProduct({
  tenantId,
  actorUserId,
  input,
  imageFile = null,
}: CreateCatalogProductInput): Promise<PosCatalogProductListItem> {
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  if (input.category_id) {
    await assertCategoryBelongsToTenant(tenantId, input.category_id);
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .insert({
      tenant_id: tenantId,
      name: input.name,
      category_id: input.category_id,
      price_cents: input.price_cents,
      is_active: input.is_active,
      type: "product",
      class: input.class,
      has_variants: false,
      is_sold_out: false,
      is_popular: false,
      created_by: actorUserId,
      updated_by: actorUserId,
      updated_at: nowIso,
    })
    .select(
      "id, tenant_id, category_id, name, price_cents, is_active, is_sold_out, is_popular, image_path, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .single();

  if (error) {
    throw new Error(`Unable to create catalog product: ${error.message}`);
  }

  let created = data as PosCatalogProductListItem;

  if (imageFile) {
    const imagePath = await uploadCatalogItemImage({
      tenantId,
      productId: created.id,
      imageFile,
    });

    const { data: updatedData, error: imageUpdateError } = await supabase
      .from("catalog_items")
      .update({
        image_path: imagePath,
        updated_by: actorUserId,
        updated_at: nowIso,
      })
      .eq("tenant_id", tenantId)
      .eq("id", created.id)
      .select(
        "id, tenant_id, category_id, name, price_cents, is_active, is_sold_out, is_popular, image_path, created_at, created_by, updated_at, updated_by, deleted_at",
      )
      .single();

    if (imageUpdateError) {
      throw new Error(`Unable to save product image path: ${imageUpdateError.message}`);
    }

    created = updatedData as PosCatalogProductListItem;
  }

  return created;
}

export async function updateCatalogProduct({
  tenantId,
  id,
  actorUserId,
  input,
  imageFile = null,
}: UpdateCatalogProductInput): Promise<PosCatalogProductListItem> {
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  if (input.category_id) {
    await assertCategoryBelongsToTenant(tenantId, input.category_id);
  }

  const updatePayload: Record<string, unknown> = {
    name: input.name,
    category_id: input.category_id,
    class: input.class,
    price_cents: input.price_cents,
    is_active: input.is_active,
    updated_by: actorUserId,
    updated_at: nowIso,
  };

  if (imageFile) {
    const imagePath = await uploadCatalogItemImage({
      tenantId,
      productId: id,
      imageFile,
    });

    updatePayload.image_path = imagePath;
  }

  const { data, error } = await supabase
    .from("catalog_items")
    .update(updatePayload)
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .select(
      "id, tenant_id, category_id, name, price_cents, is_active, is_sold_out, is_popular, image_path, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to update catalog product: ${error.message}`);
  }

  if (!data) {
    throw new Error("Catalog product not found for this tenant.");
  }

  return data as PosCatalogProductListItem;
}

export async function updateCatalogProductFlags({
  tenantId,
  id,
  actorUserId,
  is_active,
  is_sold_out,
  is_popular,
}: UpdateCatalogProductFlagsInput): Promise<PosCatalogProductListItem> {
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("catalog_items")
    .update({
      is_active,
      is_sold_out,
      is_popular,
      updated_by: actorUserId,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null)
    .select(
      "id, tenant_id, category_id, name, price_cents, is_active, is_sold_out, is_popular, image_path, created_at, created_by, updated_at, updated_by, deleted_at",
    )
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to update catalog product flags: ${error.message}`);
  }

  if (!data) {
    throw new Error("Catalog product not found for this tenant.");
  }

  return data as PosCatalogProductListItem;
}

export async function archiveCatalogProduct({
  tenantId,
  id,
  actorUserId,
}: ArchiveCatalogProductInput): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("catalog_items")
    .update({
      deleted_at: nowIso,
      is_active: false,
      updated_by: actorUserId,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    throw new Error(`Unable to archive catalog product: ${error.message}`);
  }
}

export async function restoreCatalogProduct({
  tenantId,
  id,
  actorUserId,
}: ArchiveCatalogProductInput): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("catalog_items")
    .update({
      deleted_at: null,
      updated_by: actorUserId,
      updated_at: nowIso,
    })
    .eq("tenant_id", tenantId)
    .eq("id", id);

  if (error) {
    throw new Error(`Unable to restore catalog product: ${error.message}`);
  }
}
