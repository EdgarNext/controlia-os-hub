"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { resolveRetailPosTypePageActor } from "@/lib/auth/tenant-pos-access";
import {
  createRetailPosBackofficeCatalogProduct,
  updateRetailPosBackofficeCatalogProduct,
} from "@/lib/retail-pos/catalog";

export type RetailProductEditFormValues = {
  name: string;
  brand: string;
  sku: string;
  barcode: string;
  price: string;
  cost: string;
  supplier_id: string;
  sales_unit_code: string;
  sales_unit_label: string;
  allow_decimal_quantity: boolean;
  is_active: boolean;
};

export type RetailProductEditActionState = {
  error: string | null;
  fieldErrors: Partial<Record<keyof RetailProductEditFormValues, string>>;
  values: RetailProductEditFormValues;
};

function toTrimmedString(input: FormDataEntryValue | null): string {
  return String(input ?? "").trim();
}

function toBoolean(input: FormDataEntryValue | null): boolean {
  return String(input ?? "") === "on";
}

function isRedirectErrorLike(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("digest" in error)) {
    return false;
  }

  return String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT");
}

function parseMoneyToCents(rawInput: string, fieldLabel: string, allowNull = false): number | null {
  const raw = rawInput.trim();

  if (!raw) {
    if (allowNull) {
      return null;
    }

    throw new Error(`${fieldLabel} requerido.`);
  }

  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error(`${fieldLabel} invalido. Usa hasta 2 decimales.`);
  }

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} invalido.`);
  }

  return Math.round(parsed * 100);
}

function normalizeFormValues(formData: FormData): RetailProductEditFormValues {
  return {
    name: toTrimmedString(formData.get("name")),
    brand: toTrimmedString(formData.get("brand")),
    sku: toTrimmedString(formData.get("sku")),
    barcode: toTrimmedString(formData.get("barcode")),
    price: toTrimmedString(formData.get("price")),
    cost: toTrimmedString(formData.get("cost")),
    supplier_id: toTrimmedString(formData.get("supplier_id")),
    sales_unit_code: toTrimmedString(formData.get("sales_unit_code")),
    sales_unit_label: toTrimmedString(formData.get("sales_unit_label")),
    allow_decimal_quantity: toBoolean(formData.get("allow_decimal_quantity")),
    is_active: toBoolean(formData.get("is_active")),
  };
}

function validateFormValues(values: RetailProductEditFormValues): {
  fieldErrors: RetailProductEditActionState["fieldErrors"];
  payload: {
    name: string;
    brand: string | null;
    sku: string | null;
    barcode: string | null;
    price_cents: number;
    cost_cents: number | null;
    supplier_id: string | null;
    sales_unit_code: string;
    sales_unit_label: string;
    allow_decimal_quantity: boolean;
    is_active: boolean;
  } | null;
} {
  const fieldErrors: RetailProductEditActionState["fieldErrors"] = {};

  if (!values.name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (values.name.length < 2) {
    fieldErrors.name = "El nombre debe tener al menos 2 caracteres.";
  }

  if (!values.sales_unit_code) {
    fieldErrors.sales_unit_code = "El codigo de unidad es obligatorio.";
  }

  if (!values.sales_unit_label) {
    fieldErrors.sales_unit_label = "La etiqueta de unidad es obligatoria.";
  }

  let priceCents: number | null = null;
  let costCents: number | null = null;

  try {
    priceCents = parseMoneyToCents(values.price, "Precio venta", false);
  } catch (error) {
    fieldErrors.price = error instanceof Error ? error.message : "Precio venta invalido.";
  }

  try {
    costCents = parseMoneyToCents(values.cost, "Costo", true);
  } catch (error) {
    fieldErrors.cost = error instanceof Error ? error.message : "Costo invalido.";
  }

  if (Object.keys(fieldErrors).length > 0 || priceCents === null) {
    return {
      fieldErrors,
      payload: null,
    };
  }

  return {
    fieldErrors: {},
    payload: {
      name: values.name,
      brand: values.brand || null,
      sku: values.sku || null,
      barcode: values.barcode || null,
      price_cents: priceCents,
      cost_cents: costCents,
      supplier_id: values.supplier_id || null,
      sales_unit_code: values.sales_unit_code,
      sales_unit_label: values.sales_unit_label,
      allow_decimal_quantity: values.allow_decimal_quantity,
      is_active: values.is_active,
    },
  };
}

function mapActionError(
  error: unknown,
  values: RetailProductEditFormValues,
): RetailProductEditActionState {
  const message = error instanceof Error ? error.message : "No se pudo actualizar el producto retail.";
  const lowered = message.toLowerCase();
  const fieldErrors: RetailProductEditActionState["fieldErrors"] = {};

  if (lowered.includes("sku")) {
    fieldErrors.sku = "El SKU ya esta en uso dentro del tenant.";
  }

  if (lowered.includes("barcode")) {
    fieldErrors.barcode = "El barcode ya esta en uso dentro del tenant.";
  }

  if (lowered.includes("supplier_id")) {
    fieldErrors.supplier_id = "Selecciona un proveedor valido del tenant.";
  }

  return {
    error: Object.keys(fieldErrors).length > 0 ? null : message,
    fieldErrors,
    values,
  };
}

export async function updateRetailProductAction(
  _previousState: RetailProductEditActionState,
  formData: FormData,
): Promise<RetailProductEditActionState> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const productId = toTrimmedString(formData.get("productId"));
  const values = normalizeFormValues(formData);

  if (!tenantSlug || !productId) {
    return {
      error: "Solicitud invalida.",
      fieldErrors: {},
      values,
    };
  }

  const validation = validateFormValues(values);
  if (!validation.payload) {
    return {
      error: null,
      fieldErrors: validation.fieldErrors,
      values,
    };
  }

  try {
    await resolveRetailPosTypePageActor(tenantSlug, "catalog", "manage");

    await updateRetailPosBackofficeCatalogProduct({
      tenantSlug,
      productId,
      request: validation.payload,
    });

    revalidatePath(`/${tenantSlug}/retail`);
    revalidatePath(`/${tenantSlug}/retail/products`);
    revalidatePath(`/${tenantSlug}/retail/products/${productId}`);
    revalidatePath(`/${tenantSlug}/retail/products/${productId}/edit`);
    redirect(`/${tenantSlug}/retail/products/${productId}?updated=1`);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return mapActionError(error, values);
  }
}

export async function createRetailProductAction(
  _previousState: RetailProductEditActionState,
  formData: FormData,
): Promise<RetailProductEditActionState> {
  const tenantSlug = toTrimmedString(formData.get("tenantSlug")).toLowerCase();
  const values = normalizeFormValues(formData);

  if (!tenantSlug) {
    return {
      error: "Solicitud invalida.",
      fieldErrors: {},
      values,
    };
  }

  const validation = validateFormValues(values);
  if (!validation.payload) {
    return {
      error: null,
      fieldErrors: validation.fieldErrors,
      values,
    };
  }

  try {
    await resolveRetailPosTypePageActor(tenantSlug, "catalog", "manage");

    const payload = await createRetailPosBackofficeCatalogProduct({
      tenantSlug,
      request: validation.payload,
    });

    const productId = payload.product.product_id;
    revalidatePath(`/${tenantSlug}/retail`);
    revalidatePath(`/${tenantSlug}/retail/products`);
    revalidatePath(`/${tenantSlug}/retail/products/new`);
    revalidatePath(`/${tenantSlug}/retail/products/${productId}`);
    redirect(`/${tenantSlug}/retail/products/${productId}?created=1`);
  } catch (error) {
    if (isRedirectErrorLike(error)) {
      throw error;
    }

    return mapActionError(error, values);
  }
}
