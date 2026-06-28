import type { TenantContext } from "@/lib/auth/tenant-context";
import type {
  ModulePageAccessLevel,
  RetailPosPageKey,
  SalesPosPageKey,
} from "@/lib/auth/module-page-access";
import {
  resolveRetailPosPageActor,
  resolveRetailPosPageContext,
  resolveSalesPosPageActor,
  resolveSalesPosPageContext,
} from "@/lib/auth/module-page-access";
import { assertTenantPosType, type TenantPosType } from "./tenant-pos-type";

type PosTypeGuardOptions = {
  allowUnknown?: boolean;
};

export function assertAllowedTenantPosType(
  tenant: Pick<TenantContext, "posType">,
  allowedPosTypes: TenantPosType[],
  options?: PosTypeGuardOptions,
) {
  assertTenantPosType(tenant, allowedPosTypes, options?.allowUnknown ?? true);
}

export async function resolveSalesPosTypePageContext(
  tenantSlug: string,
  pageKey: SalesPosPageKey,
  allowedPosTypes: TenantPosType[],
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "read",
  options?: PosTypeGuardOptions,
) {
  const tenant = await resolveSalesPosPageContext(tenantSlug, pageKey, requiredLevel);
  assertAllowedTenantPosType(tenant, allowedPosTypes, options);
  return tenant;
}

export async function resolveSalesPosTypePageActor(
  tenantSlug: string,
  pageKey: SalesPosPageKey,
  allowedPosTypes: TenantPosType[],
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "manage",
  options?: PosTypeGuardOptions,
) {
  const actor = await resolveSalesPosPageActor(tenantSlug, pageKey, requiredLevel);
  assertAllowedTenantPosType(actor.tenant, allowedPosTypes, options);
  return actor;
}

export async function resolveRetailPosTypePageContext(
  tenantSlug: string,
  pageKey: RetailPosPageKey,
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "read",
  options?: PosTypeGuardOptions,
) {
  const tenant = await resolveRetailPosPageContext(tenantSlug, pageKey, requiredLevel);
  assertAllowedTenantPosType(tenant, ["retail"], options);
  return tenant;
}

export async function resolveRetailPosTypePageActor(
  tenantSlug: string,
  pageKey: RetailPosPageKey,
  requiredLevel: Exclude<ModulePageAccessLevel, "none"> = "manage",
  options?: PosTypeGuardOptions,
) {
  const actor = await resolveRetailPosPageActor(tenantSlug, pageKey, requiredLevel);
  assertAllowedTenantPosType(actor.tenant, ["retail"], options);
  return actor;
}
