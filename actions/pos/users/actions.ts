"use server";

import { revalidatePath } from "next/cache";
import { resolveTenantContextBySlug } from "@/lib/auth/tenant-context";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { hashPosUserPin } from "@/lib/pos/user-auth";

export type PosUserRole = "cashier" | "supervisor" | "admin";

export type CreatePosUserFormState = {
  error: string | null;
  fieldErrors: {
    name?: string;
    role?: string;
    pin?: string;
  };
  values: {
    name: string;
    role: PosUserRole;
  };
  result: {
    id: string;
    name: string;
    role: PosUserRole;
    isActive: boolean;
  } | null;
};

const initialCreatePosUserState: CreatePosUserFormState = {
  error: null,
  fieldErrors: {},
  values: {
    name: "",
    role: "cashier",
  },
  result: null,
};

function normalizeTenantSlug(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeName(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeRole(value: unknown): PosUserRole | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "cashier" || normalized === "supervisor" || normalized === "admin") {
    return normalized;
  }
  return null;
}

function normalizePin(value: unknown): string {
  return String(value ?? "").trim();
}

function isUniqueViolation(errorMessage: string): boolean {
  return (
    errorMessage.includes("pos_users_tenant_name_uidx") ||
    errorMessage.includes("duplicate key value violates unique constraint")
  );
}

export async function createPosUserAction(
  _previousState: CreatePosUserFormState,
  formData: FormData,
): Promise<CreatePosUserFormState> {
  const tenantSlug = normalizeTenantSlug(formData.get("tenantSlug"));
  const name = normalizeName(formData.get("name"));
  const role = normalizeRole(formData.get("role"));
  const pin = normalizePin(formData.get("pin"));

  const fieldErrors: CreatePosUserFormState["fieldErrors"] = {};

  if (!name) {
    fieldErrors.name = "El nombre es obligatorio.";
  } else if (name.length > 120) {
    fieldErrors.name = "El nombre no puede exceder 120 caracteres.";
  }

  if (!role) {
    fieldErrors.role = "Selecciona un rol válido.";
  }

  if (!pin) {
    fieldErrors.pin = "El PIN es obligatorio.";
  } else if (pin.length < 4) {
    fieldErrors.pin = "El PIN debe tener al menos 4 caracteres.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      ...initialCreatePosUserState,
      fieldErrors,
      values: {
        name,
        role: role ?? "cashier",
      },
    };
  }

  try {
    const tenant = await resolveTenantContextBySlug(tenantSlug);
    if (!tenant.isPlatformOwner) {
      throw new Error("Solo Platform Owner puede administrar usuarios POS por ahora.");
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabaseAdminClient();

    const { data, error } = await supabase
      .from("pos_users")
      .insert({
        tenant_id: tenant.tenantId,
        name,
        pin_hash: hashPosUserPin(pin),
        role,
        is_active: true,
        created_at: nowIso,
        updated_at: nowIso,
      })
      .select("id, name, role, is_active")
      .limit(1)
      .maybeSingle<{ id: string; name: string; role: PosUserRole; is_active: boolean }>();

    if (error) {
      if (isUniqueViolation(error.message)) {
        const safeRole: PosUserRole = role ?? "cashier";
        return {
          ...initialCreatePosUserState,
          error: "Ya existe un usuario POS con ese nombre en este tenant.",
          values: {
            name,
            role: safeRole,
          },
        };
      }

      throw new Error(`No fue posible crear el usuario POS: ${error.message}`);
    }

    if (!data) {
      throw new Error("No fue posible crear el usuario POS.");
    }

    revalidatePath(`/${tenant.tenantSlug}/pos/users`);
    revalidatePath(`/${tenant.tenantSlug}/pos/reports/cashiers`);
    revalidatePath(`/${tenant.tenantSlug}/pos/reports/cashier-shift`);
    revalidatePath(`/${tenant.tenantSlug}/pos`);

    return {
      ...initialCreatePosUserState,
      result: {
        id: data.id,
        name: data.name,
        role: data.role,
        isActive: data.is_active,
      },
    };
  } catch (error) {
    return {
      ...initialCreatePosUserState,
      error: error instanceof Error ? error.message : "No fue posible crear el usuario POS.",
      values: {
        name,
        role: role ?? "cashier",
      },
    };
  }
}
