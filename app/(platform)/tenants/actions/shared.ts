import type { TenantRole, TenantStatus } from "@/lib/repos/types";

export type ActionState = {
  ok: boolean;
  message: string;
  redirectTo?: string;
};

export function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-\s]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isTenantStatus(value: string): value is TenantStatus {
  return value === "active" || value === "inactive" || value === "archived";
}

export function isTenantRole(value: string): value is TenantRole {
  return value === "admin" || value === "operator" || value === "viewer";
}
