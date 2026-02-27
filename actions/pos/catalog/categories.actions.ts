"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertTenantAdmin } from "@/app/(tenant)/lib/tenant-access";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import {
  createCatalogCategory,
  updateCatalogCategory,
} from "@/lib/pos/catalog/commands";
import type { PosCatalogCategoryFormValues } from "@/types/pos-catalog";

export type CategoryActionState = {
  error: string | null;
  fieldErrors: {
    name?: string;
    sort_order?: string;
  };
};

const initialState: CategoryActionState = {
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

function parseSortOrder(input: FormDataEntryValue | null): number {
  const raw = String(input ?? "").trim();
  if (!raw) {
    return 0;
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) {
    throw new Error("Sort order must be a valid number.");
  }

  return Math.trunc(parsed);
}

function validateCategoryInput(formData: FormData): {
  input: PosCatalogCategoryFormValues | null;
  fieldErrors: CategoryActionState["fieldErrors"];
} {
  const name = toTrimmedString(formData.get("name"));
  const isActive = toBoolean(formData.get("is_active"));

  let sortOrder = 0;
  try {
    sortOrder = parseSortOrder(formData.get("sort_order"));
  } catch {
    return {
      input: null,
      fieldErrors: {
        sort_order: "Orden inválido.",
      },
    };
  }

  const fieldErrors: CategoryActionState["fieldErrors"] = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      input: null,
      fieldErrors,
    };
  }

  return {
    input: {
      name,
      sort_order: sortOrder,
      is_active: isActive,
    },
    fieldErrors: {},
  };
}

function categoryListPath(tenantSlug: string): string {
  return `/${tenantSlug}/pos/admin/catalog/categories`;
}

export async function createCategoryAction(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();

  if (!tenantSlug) {
    return {
      ...initialState,
      error: "Tenant inválido.",
    };
  }

  const validation = validateCategoryInput(formData);
  if (!validation.input) {
    return {
      ...initialState,
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const user = await assertTenantAdmin(tenant.tenantId);

    await createCatalogCategory({
      tenantId: tenant.tenantId,
      actorUserId: user.id,
      input: validation.input,
    });

    revalidatePath(categoryListPath(tenant.tenantSlug));
    redirect(categoryListPath(tenant.tenantSlug));
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "No se pudo crear la categoría.";
    return {
      ...initialState,
      error: message,
    };
  }
}

export async function updateCategoryAction(
  _previousState: CategoryActionState,
  formData: FormData,
): Promise<CategoryActionState> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const categoryId = toTrimmedString(formData.get("categoryId"));

  if (!tenantSlug || !categoryId) {
    return {
      ...initialState,
      error: "Solicitud inválida.",
    };
  }

  const validation = validateCategoryInput(formData);
  if (!validation.input) {
    return {
      ...initialState,
      fieldErrors: validation.fieldErrors,
    };
  }

  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    const user = await assertTenantAdmin(tenant.tenantId);

    await updateCatalogCategory({
      tenantId: tenant.tenantId,
      id: categoryId,
      actorUserId: user.id,
      input: validation.input,
    });

    revalidatePath(categoryListPath(tenant.tenantSlug));
    revalidatePath(`/${tenant.tenantSlug}/pos/admin/catalog/categories/${categoryId}/edit`);
    redirect(categoryListPath(tenant.tenantSlug));
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "No se pudo actualizar la categoría.";
    return {
      ...initialState,
      error: message,
    };
  }
}
