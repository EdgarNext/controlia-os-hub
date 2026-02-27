"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertTenantAdmin } from "@/app/(tenant)/lib/tenant-access";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import {
  createCatalogProduct,
  updateCatalogProduct,
} from "@/lib/pos/catalog/commands";
import type { PosCatalogProductFormValues } from "@/types/pos-catalog";

export type ProductActionState = {
  error: string | null;
  fieldErrors: {
    name?: string;
    price?: string;
    category_id?: string;
  };
};

const initialState: ProductActionState = {
  error: null,
  fieldErrors: {},
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
      price_cents: priceCents,
      is_active: isActive,
    },
    fieldErrors: {},
  };
}

function productsListPath(tenantSlug: string): string {
  return `/${tenantSlug}/pos/admin/catalog/products`;
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
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const user = await assertTenantAdmin(tenant.tenantId);

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
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const user = await assertTenantAdmin(tenant.tenantId);

    await updateCatalogProduct({
      tenantId: tenant.tenantId,
      id: productId,
      actorUserId: user.id,
      input: validation.input,
      imageFile,
    });

    revalidatePath(productsListPath(tenant.tenantSlug));
    revalidatePath(`/${tenant.tenantSlug}/pos/admin/catalog/products/${productId}/edit`);
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
