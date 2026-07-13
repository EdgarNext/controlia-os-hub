# Modular RBAC

## Scope

This document describes the base RBAC model for tenant membership, tenant-wide admin access, and user/module roles.

## Role Layers

- `Platform Owner` is the only global bypass role. It comes from `platform_settings.owner_user_id`.
- `Tenant Admin` is represented by `tenant_memberships.role = admin`.
- `Tenant Member` is represented by `tenant_memberships` with role `operator` or `viewer`.
- `Module Role` is represented by `tenant_user_module_roles`.

## When to Use Each Layer

- Use `Platform Owner` only for global platform administration and cross-tenant support.
- Use `tenant_memberships.role = admin` only for a true tenant-wide admin who should access every enabled module in the tenant.
- Use `tenant_user_module_roles` for area-specific operational access.
- Do not use `tenant_memberships.role = admin` to model a POS-only, kitchen-only, or events-only administrator.

## Effective Access Resolution

The effective module role resolves in this order:

1. `Platform Owner` -> `admin` for every enabled module.
2. `tenant_memberships.role = admin` -> `admin` for every enabled module in that tenant.
3. `tenant_user_module_roles` -> use the assigned module role for that `(tenant_id, user_id, module_key)`.
4. No module assignment -> no module access.

Temporary compatibility fallback:

- If a non-admin tenant member has no modular assignments yet, the current implementation falls back to the membership role for enabled modules.
- This fallback exists to avoid breaking existing users before explicit module-role assignments are created.

## Modeling Examples

- POS admin:
  `tenant_memberships.role = viewer` plus `tenant_user_module_roles.sales_pos = admin`
- Kitchen admin:
  `tenant_memberships.role = viewer` plus `kitchen_inventory = admin` and `kitchen_recipes = admin`
- Events/Venue admin:
  `tenant_memberships.role = viewer` plus `event_core = admin`
- Multi-module user:
  one membership row plus multiple `tenant_user_module_roles` rows
- Tenant Admin:
  `tenant_memberships.role = admin` with no modular rows required

## Performance Rules

- Resolve enabled modules once per tenant request.
- Resolve effective module roles in one central RPC per tenant request.
- Keep navigation filtering in memory after tenant context resolution.
- Do not query per menu item.
- Do not inspect operational tables to infer permissions.

## Navigation and Guards

- Navigation should hide modules with effective role `none`.
- Page-level access should continue using `tenant_role_module_pages` as the page template by role.
- Route/page guards should compose:
  1. tenant resolution
  2. effective module role
  3. page access
  4. product-specific rules such as `pos_type`

## Phase 2B-2 Integration

- Tenant root (`app/(tenant)/[tenantSlug]/page.tsx`) resolves the first accessible module from `moduleRoleByKey` and avoids sending the user to modules with effective role `none`.
- `event_core` now has direct route protection at module level for:
  - `/${tenantSlug}/dashboard`
  - `/${tenantSlug}/events`
  - `/${tenantSlug}/events/new`
  - `/${tenantSlug}/events/[eventId]`
  - `/${tenantSlug}/events/create`
  - `/${tenantSlug}/venue`
  - `/${tenantSlug}/venue/rooms`
  - `/${tenantSlug}/venue/rooms/[room_id]`
  - `/${tenantSlug}/venue/equipment`
- The minimum guard for `event_core` is module-level access because there are no dedicated page keys/templates for events and venue yet.
- Server Actions for events and venue no longer rely on generic tenant membership/admin checks. They now validate the effective modular role for `event_core`:
  - read flows require `read`
  - mutations require `manage` and currently map to effective module role `admin`
- Kitchen was audited in this phase. The current kitchen routes already resolve access through modular page guards (`resolveTenantModulePageContext`) and did not require new closing work in this phase.

## Direct URL Protection

- Hiding a nav item is not considered sufficient protection.
- Direct URL access is blocked by route loaders/pages that resolve tenant context and validate the effective module role before rendering data.
- Event and venue Server Actions repeat the same modular check server-side so a blocked user cannot bypass the UI by posting forms manually.

## Provisioning Runbooks

- For Cocina e Inventarios provisioning, use `apps/hub/docs/rbac/kitchen-inventory-user-provisioning.md`.
- That runbook includes two variants:
  - additive kitchen access while preserving existing permissions;
  - Kitchen Only / No POS provisioning for new operational users.

## Compatibility With POS Type

- `tenant_user_module_roles` decides whether a user can enter `sales_pos` or `retail_pos`.
- `pos_type` decides which POS experience is valid inside that module.
- Module RBAC and `pos_type` solve different problems and should remain separate.
- In practice:
  - RBAC decides whether the user can enter `sales_pos` or `retail_pos`.
  - `tenant_modules.config.pos_type` decides whether the allowed POS surface is `simple`, `variants`, or `retail`.
  - A user with `sales_pos` access but without `event_core` should not see or enter events/venue/dashboard routes.

## Temporary Fallback

- The compatibility fallback remains active in this phase.
- If a tenant member has no rows yet in `tenant_user_module_roles` for a tenant, the effective module role still inherits from `tenant_memberships.role` for enabled modules.
- As soon as a user gets at least one modular assignment in that tenant, unassigned modules resolve to `none`.
- This preserves current access while allowing new modular assignments to become authoritative per user.

## Future Work

- Add formal `event_core` page keys and `tenant_role_module_pages` templates for events/venue/dashboard if those surfaces need page-level differentiation later.
- Add admin UI to assign `tenant_user_module_roles`.
- Remove the temporary fallback after real modular assignments are in place.
- Add POS simple reporting once the product surface is ready.
