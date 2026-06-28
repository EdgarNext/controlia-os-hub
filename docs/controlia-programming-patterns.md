# Controlia Programming Patterns

## Scope

This document captures verified patterns from `apps/hub` plus explicit recommendations for future work.

## App Router and Rendering

- The app uses Next.js App Router with Server Components by default.
- Tenant and platform layouts resolve data server-side before rendering navigation and content.
- Use Client Components only for interactive UI that depends on browser APIs, local state, or navigation hooks.
- Do not promote a Server Component to client-only unless the interaction cannot be isolated into a child component.

## Code Placement

- Put domain queries, orchestration helpers, and server-side business logic in `lib/`.
- Put presentational and interactive UI in `components/`.
- Put UI/admin mutations in `actions/` as Server Actions when the domain already follows that pattern.
- Avoid creating new API endpoints for admin flows when an existing domain uses Server Actions successfully.
- Keep tenant-facing route files thin. Resolve access and data near the top, then render UI from components.

## Tenant Navigation Pattern

- Tenant navigation is assembled from `TenantContext` plus module/page access.
- Navigation must resolve tenant-wide experience first, then role/page access second.
- Do not query operational tables to decide menu visibility.
- Keep navigation filtering in pure in-memory helpers after central tenant context resolution.
- Prefer mutually exclusive domain branches over ambiguous labels when two product experiences share a broad module.

## POS Type Resolution

- `TenantContext` is the correct place to resolve POS experience because it already reads enabled tenant modules.
- `pos_type` should be read from `tenant_modules.config` for the relevant POS module.
- Current supported values are `simple`, `variants`, `retail`, and `unknown` as a compatibility fallback.
- `unknown` is a temporary compatibility state and should preserve safe legacy behavior instead of breaking tenant render.
- Do not hardcode tenant slug rules in application code.

## Route Guards

- Guards should compose in this order:
  1. authenticated tenant resolution
  2. module enabled and page access
  3. tenant POS type compatibility
- Route guards must reuse tenant context and existing module/page access helpers.
- Protect direct URL access in layouts or route/page loaders, not only in the sidebar.
- Server Actions must enforce the same tenant/module/POS-type rules as the pages that render their forms.

## RBAC and Page Access

- Current RBAC is tenant membership + tenant role + module page access from `tenant_role_module_pages`.
- `tenant_role_module_pages` is appropriate for route/page-level visibility and action gating.
- Modular role assignment now lives in `tenant_user_module_roles`.
- Use `tenant_memberships.role = admin` only for a true tenant-wide admin, not for area-specific operators.
- `Platform Owner` remains the only global bypass role.
- Resolve effective module access centrally, then filter navigation in memory.
- Avoid overloading one `page_key` to cover incompatible experiences.
- When a module contains multiple product experiences, prefer more granular page keys instead of expanding conditionals in UI.

## Performance Rules

- Extend the central tenant context query instead of adding scattered queries to render navigation.
- Avoid N+1 access checks during menu construction.
- Do not inspect orders, products, or reports to infer the tenant experience at runtime.
- Keep expensive domain queries out of layouts and shared shells.
- Use Server Components and cached server helpers for navigation and access resolution where possible.

## Safe Production Changes

- Do not modify runtime POS endpoints, sync endpoints, payment flows, order flows, ticket printing flows, or device-auth contracts without explicit authorization.
- Avoid touching `app/api/**/pos/**` and `app/api/**/retail-pos/**` for admin/navigation work unless the change is specifically approved.
- Do not change operational table shapes as part of UI-only access work.
- Limit tenant config writes to the smallest explicit set of tenants and modules required by the phase.

## Server Action Rules

- Follow existing domain patterns in `actions/`.
- Validate tenant, module page access, and POS-type compatibility before mutating.
- Revalidate only the paths affected by the admin mutation.
- Keep form parsing and validation close to the action, but keep persistence logic in `lib/`.

## Recommendations

- Recommendation: introduce more granular `page_key` values inside `sales_pos` as the next safe step after `pos_type`.
- Recommendation: keep retail tenant UI isolated from cafeteria navigation until a dedicated retail hub surface exists.
- Recommendation: treat `unknown` as migration compatibility, not as a long-term product state.
