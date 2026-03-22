"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveSalesPosPageActor } from "@/lib/auth/module-page-access";
import {
  type CatalogCsvImportSummary,
  importProductsFromCsv,
} from "@/lib/pos/catalog/csv-transfer";
import {
  archiveCatalogProduct,
  createCatalogProduct,
  restoreCatalogProduct,
  updateCatalogProductFlags,
  updateCatalogProduct,
} from "@/lib/pos/catalog/commands";
import type { PosCatalogProductFormValues } from "@/types/pos-catalog";

export type ProductActionState = {
  error: string | null;
  fieldErrors: {
    name?: string;
    price?: string;
    category_id?: string;
    class?: string;
  };
};

const initialState: ProductActionState = {
  error: null,
  fieldErrors: {},
};

const initialProductCsvImportState: ProductCsvImportActionState = {
  error: null,
  summary: null,
};

export type InlineProductActionResult = {
  ok: boolean;
  error: string | null;
};

export type ProductCsvImportActionState = {
  error: string | null;
  summary: CatalogCsvImportSummary | null;
};

function isRedirectErrorLike(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  return String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

function toTrimmedString(input: FormDataEntryValue | null): string {
  return String(input ?? "").trim();
}

function toBoolean(input: FormDataEntryValue | null): boolean {
  return String(input ?? "") === "on";
}

function getImageFile(formData: FormData): File | null {
  const file = formData.get("image");
  if (!file || typeof file !== "object") {
    return null;
  }

  if (!(file instanceof File)) {
    return null;
  }

  if (typeof file.size !== "number" || file.size <= 0) {
    return null;
  }

  return file;
}

function parsePriceToCents(input: FormDataEntryValue | null): number {
  const raw = String(input ?? "").trim();
  if (!raw) {
    throw new Error("Precio requerido.");
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error("Precio inválido.");
  }

  return Math.round(parsed * 100);
}

function validateProductInput(formData: FormData): {
  input: PosCatalogProductFormValues | null;
  fieldErrors: ProductActionState["fieldErrors"];
} {
  const fieldErrors: ProductActionState["fieldErrors"] = {};

  const name = toTrimmedString(formData.get("name"));
  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
  }

  let priceCents = 0;
  try {
    priceCents = parsePriceToCents(formData.get("price"));
  } catch {
    fieldErrors.price = "El precio debe ser un número válido mayor o igual a 0.";
  }

  const categoryRaw = toTrimmedString(formData.get("category_id"));
  const categoryId = categoryRaw || null;
  const classRaw = toTrimmedString(formData.get("class"));
  const productClass = classRaw === "drink" ? "drink" : "food";

  const isActive = toBoolean(formData.get("is_active"));

  if (Object.keys(fieldErrors).length > 0) {
    return {
      input: null,
      fieldErrors,
    };
  }

  return {
    input: {
      name,
      category_id: categoryId,
      class: productClass,
      price_cents: priceCents,
      is_active: isActive,
    },
    fieldErrors: {},
  };
}

function productsListPath(tenantSlug: string): string {
  return `/${tenantSlug}/pos/catalog/products`;
}

function validateInlineProductInput(formData: FormData): {
  input: PosCatalogProductFormValues | null;
  fieldErrors: ProductActionState["fieldErrors"];
} {
  return validateProductInput(formData);
}

async function resolveTenantAndActor(tenantSlug: string): Promise<{
  tenantId: string;
  tenantSlug: string;
  actorUserId: string;
}> {
  const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");

  return {
    tenantId: tenant.tenantId,
    tenantSlug: tenant.tenantSlug,
    actorUserId: user.id,
  };
}

export async function createProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();

  if (!tenantSlug) {
    return {
      ...initialState,
      error: "Tenant inválido.",
    };
  }

  const validation = validateProductInput(formData);
  if (!validation.input) {
    return {
      ...initialState,
      fieldErrors: validation.fieldErrors,
    };
  }
  const imageFile = getImageFile(formData);

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");

    await createCatalogProduct({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      input: validation.input,
      imageFile,
    });

    revalidatePath(productsListPath(tenant.tenantSlug));
    redirect(productsListPath(tenant.tenantSlug));
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "No se pudo crear el producto.";
    return {
      ...initialState,
      error: message,
    };
  }
}

export async function updateProductAction(
  _previousState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const productId = toTrimmedString(formData.get("productId"));

  if (!tenantSlug || !productId) {
    return {
      ...initialState,
      error: "Solicitud inválida.",
    };
  }

  const validation = validateProductInput(formData);
  if (!validation.input) {
    return {
      ...initialState,
      fieldErrors: validation.fieldErrors,
    };
  }
  const imageFile = getImageFile(formData);

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");

    await updateCatalogProduct({
      tenantId: tenant.tenantId,
      id: productId,
      actorUserId: user.id,
      input: validation.input,
      imageFile,
    });

    revalidatePath(productsListPath(tenant.tenantSlug));
    revalidatePath(`/${tenant.tenantSlug}/pos/catalog/products/${productId}/edit`);
    redirect(productsListPath(tenant.tenantSlug));
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "No se pudo actualizar el producto.";
    return {
      ...initialState,
      error: message,
    };
  }
}

export async function createProductInlineAction(formData: FormData): Promise<InlineProductActionResult> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  if (!tenantSlug) {
    return { ok: false, error: "Tenant inválido." };
  }

  const validation = validateInlineProductInput(formData);
  if (!validation.input) {
    return { ok: false, error: Object.values(validation.fieldErrors)[0] ?? "Datos inválidos." };
  }

  try {
    const context = await resolveTenantAndActor(tenantSlug);
    const imageFile = getImageFile(formData);
    await createCatalogProduct({
      tenantId: context.tenantId,
      actorUserId: context.actorUserId,
      input: validation.input,
      imageFile,
    });

    revalidatePath(productsListPath(context.tenantSlug));
    return { ok: true, error: null };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo crear el producto.",
    };
  }
}

export async function updateProductInlineAction(formData: FormData): Promise<InlineProductActionResult> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const productId = toTrimmedString(formData.get("productId"));

  if (!tenantSlug || !productId) {
    return { ok: false, error: "Solicitud inválida." };
  }

  const validation = validateInlineProductInput(formData);
  if (!validation.input) {
    return { ok: false, error: Object.values(validation.fieldErrors)[0] ?? "Datos inválidos." };
  }

  try {
    const context = await resolveTenantAndActor(tenantSlug);
    const imageFile = getImageFile(formData);
    await updateCatalogProduct({
      tenantId: context.tenantId,
      id: productId,
      actorUserId: context.actorUserId,
      input: validation.input,
      imageFile,
    });

    revalidatePath(productsListPath(context.tenantSlug));
    return { ok: true, error: null };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar el producto.",
    };
  }
}

export async function archiveProductInlineAction(formData: FormData): Promise<InlineProductActionResult> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const productId = toTrimmedString(formData.get("productId"));

  if (!tenantSlug || !productId) {
    return { ok: false, error: "Solicitud inválida." };
  }

  try {
    const context = await resolveTenantAndActor(tenantSlug);
    await archiveCatalogProduct({
      tenantId: context.tenantId,
      id: productId,
      actorUserId: context.actorUserId,
    });
    revalidatePath(productsListPath(context.tenantSlug));
    return { ok: true, error: null };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo archivar el producto.",
    };
  }
}

export async function restoreProductInlineAction(formData: FormData): Promise<InlineProductActionResult> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const productId = toTrimmedString(formData.get("productId"));

  if (!tenantSlug || !productId) {
    return { ok: false, error: "Solicitud inválida." };
  }

  try {
    const context = await resolveTenantAndActor(tenantSlug);
    await restoreCatalogProduct({
      tenantId: context.tenantId,
      id: productId,
      actorUserId: context.actorUserId,
    });
    revalidatePath(productsListPath(context.tenantSlug));
    return { ok: true, error: null };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo restaurar el producto.",
    };
  }
}

export async function updateProductFlagsInlineAction(
  formData: FormData,
): Promise<InlineProductActionResult> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const productId = toTrimmedString(formData.get("productId"));

  if (!tenantSlug || !productId) {
    return { ok: false, error: "Solicitud inválida." };
  }

  try {
    const context = await resolveTenantAndActor(tenantSlug);
    await updateCatalogProductFlags({
      tenantId: context.tenantId,
      id: productId,
      actorUserId: context.actorUserId,
      is_active: toBoolean(formData.get("is_active")),
      is_sold_out: toBoolean(formData.get("is_sold_out")),
      is_popular: toBoolean(formData.get("is_popular")),
    });

    revalidatePath(productsListPath(context.tenantSlug));
    return { ok: true, error: null };
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo actualizar el estado del producto.",
    };
  }
}

export async function importProductsCsvAction(
  _previousState: ProductCsvImportActionState,
  formData: FormData,
): Promise<ProductCsvImportActionState> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const file = formData.get("file");

  if (!tenantSlug) {
    return {
      ...initialProductCsvImportState,
      error: "Tenant inválido.",
    };
  }

  try {
    const { tenant, user } = await resolveSalesPosPageActor(tenantSlug, "products", "manage");
    const summary = await importProductsFromCsv({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      file: file instanceof File ? file : null,
    });

    revalidatePath(productsListPath(tenant.tenantSlug));

    return {
      error: null,
      summary,
    };
  } catch (error) {
    return {
      ...initialProductCsvImportState,
      error: error instanceof Error ? error.message : "No se pudo importar el CSV de productos.",
    };
  }
}
