# Kitchen / Inventory User Provisioning

## Purpose

Reusable runbook to provision Cocina e Inventarios access in Controlia OS without repeating a full architectural audit while the current RBAC contract remains unchanged.

## Current RBAC Contract

Validated contract:

- `public.tenant_memberships`
- `public.tenant_user_module_roles`
- `public.tenant_role_module_pages`

Current resolution model:

1. `tenant_memberships` provides tenant membership and tenant-level role.
2. `tenant_user_module_roles` provides per-module access.
3. `tenant_role_module_pages` provides page templates per module role.
4. If a non-admin user has at least one modular assignment in a tenant, unassigned modules resolve to `none`.

Reference documents:

- `specs/SECURITY_MODEL.md`
- `apps/hub/docs/rbac/modular-rbac.md`
- `apps/hub/app/(tenant)/[tenantSlug]/kitchen/_lib/page-access.ts`
- `apps/hub/lib/auth/module-page-access.ts`
- `apps/hub/supabase/migrations/20260628150000_modular_rbac_phase2b1_base.sql`

## Standard Package

```text
kitchen_inventory = admin
kitchen_recipes = admin
event_catering = admin
```

Effective kitchen pages covered by this package:

- `kitchen_inventory`: `overview`, `items`, `locations`, `suppliers`, `movements`, `reports`
- `kitchen_recipes`: `overview`, `recipes`, `costing`, `imports`, `reports`
- `event_catering`: `overview`, `plans`, `requirements`, `requisitions`, `consumption`, `reports`

## Profile 1: Additive Kitchen Access

Use this when the user already has valid access that must be preserved.

Rules:

- preserve the existing membership row;
- preserve the current tenant-level role;
- preserve existing modular roles;
- add only the standard kitchen package;
- never delete all modular roles;
- never replace the full set of roles for the user.

Typical examples:

- staff with existing POS access;
- users who already operate `event_core`;
- internal admins who now also need kitchen surfaces.

## Profile 2: Kitchen Only / No POS

Use this when the user should work in kitchen/inventory but must not operate POS.

Rules:

1. create a base membership with `role = 'viewer'` only if the membership does not already exist;
2. assign only the standard kitchen package;
3. do not assign `sales_pos`;
4. do not add POS page access;
5. do not add POS grants;
6. validate the negative POS result after the change.

Operational note:

- `viewer` is the validated base membership for this flow.
- Functional access comes from `tenant_user_module_roles`.
- Do not assume `viewer` alone blocks POS forever; always validate the effective model currently deployed.

## Parameterized Procedure

Placeholders:

- `<USER_UUID>`
- `<TENANT_SLUG>`
- `<TENANT_ID>`

### 1. Lightweight Reuse Check

Before using this runbook on a new request, verify:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'tenant_memberships',
    'tenant_user_module_roles',
    'tenant_role_module_pages',
    'tenant_modules',
    'modules_catalog'
  )
order by table_name;
```

```sql
select routine_name
from information_schema.routines
where routine_schema = 'public'
  and routine_name in (
    'resolve_current_tenant_module_role',
    'list_current_tenant_module_roles',
    'list_current_tenant_module_page_accesses'
  )
order by routine_name;
```

```sql
select module_key, name, status
from public.modules_catalog
where module_key in ('kitchen_inventory', 'kitchen_recipes', 'event_catering')
order by module_key;
```

```sql
select module_key, page_key, role, access_level
from public.tenant_role_module_pages
where module_key in ('kitchen_inventory', 'kitchen_recipes', 'event_catering')
  and role = 'admin'
order by module_key, page_key;
```

If these checks still match the current contract and no later migration has replaced the model, reuse this runbook directly.

### 2. Snapshot Before Change

Identity:

```sql
select id, email
from auth.users
where id = '<USER_UUID>'::uuid;
```

Memberships in all tenants:

```sql
select t.slug, tm.tenant_id, tm.user_id, tm.role, tm.created_at
from public.tenant_memberships tm
join public.tenants t on t.id = tm.tenant_id
where tm.user_id = '<USER_UUID>'::uuid
order by t.slug;
```

Membership in the target tenant:

```sql
select t.slug, tm.tenant_id, tm.user_id, tm.role, tm.created_at
from public.tenant_memberships tm
join public.tenants t on t.id = tm.tenant_id
where tm.user_id = '<USER_UUID>'::uuid
  and tm.tenant_id = '<TENANT_ID>'::uuid;
```

Modular roles in all tenants:

```sql
select t.slug, tumr.tenant_id, tumr.user_id, tumr.module_key, tumr.module_role, tumr.created_at
from public.tenant_user_module_roles tumr
join public.tenants t on t.id = tumr.tenant_id
where tumr.user_id = '<USER_UUID>'::uuid
order by t.slug, tumr.module_key;
```

Modular roles in the target tenant:

```sql
select tumr.tenant_id, tumr.user_id, tumr.module_key, tumr.module_role, tumr.created_at
from public.tenant_user_module_roles tumr
where tumr.user_id = '<USER_UUID>'::uuid
  and tumr.tenant_id = '<TENANT_ID>'::uuid
order by tumr.module_key;
```

Enabled modules for the target tenant:

```sql
select tenant_id, module_key, enabled, config
from public.tenant_modules
where tenant_id = '<TENANT_ID>'::uuid
order by module_key;
```

POS-related baseline:

```sql
select tumr.tenant_id, tumr.user_id, tumr.module_key, tumr.module_role
from public.tenant_user_module_roles tumr
where tumr.user_id = '<USER_UUID>'::uuid
  and tumr.tenant_id = '<TENANT_ID>'::uuid
  and tumr.module_key = 'sales_pos';
```

```sql
select module_key, page_key, role, access_level
from public.tenant_role_module_pages
where module_key = 'sales_pos'
order by role, page_key;
```

### 3. Idempotent Execution

Create the membership only if it does not exist:

```sql
insert into public.tenant_memberships (
  tenant_id,
  user_id,
  role,
  created_by
)
select
  '<TENANT_ID>'::uuid,
  '<USER_UUID>'::uuid,
  'viewer',
  null
where not exists (
  select 1
  from public.tenant_memberships tm
  where tm.tenant_id = '<TENANT_ID>'::uuid
    and tm.user_id = '<USER_UUID>'::uuid
);
```

Upsert only the kitchen package:

```sql
insert into public.tenant_user_module_roles (
  tenant_id,
  user_id,
  module_key,
  module_role,
  created_by
)
values
  ('<TENANT_ID>'::uuid, '<USER_UUID>'::uuid, 'kitchen_inventory', 'admin', null),
  ('<TENANT_ID>'::uuid, '<USER_UUID>'::uuid, 'kitchen_recipes', 'admin', null),
  ('<TENANT_ID>'::uuid, '<USER_UUID>'::uuid, 'event_catering', 'admin', null)
on conflict (tenant_id, user_id, module_key)
do update set module_role = excluded.module_role
where public.tenant_user_module_roles.module_role is distinct from excluded.module_role;
```

Execution guardrails:

- membership only when missing;
- upsert limited to the three kitchen modules;
- never `delete` all user roles;
- never replace unrelated module assignments;
- never touch other tenants.

## Positive Validation

Recheck final roles:

```sql
select tumr.tenant_id, tumr.user_id, tumr.module_key, tumr.module_role
from public.tenant_user_module_roles tumr
where tumr.user_id = '<USER_UUID>'::uuid
  and tumr.tenant_id = '<TENANT_ID>'::uuid
order by tumr.module_key;
```

Resolve effective kitchen pages from the current modular role:

```sql
select trmp.module_key, trmp.page_key, trmp.access_level
from public.tenant_user_module_roles tumr
join public.tenant_role_module_pages trmp
  on trmp.module_key = tumr.module_key
 and trmp.role = tumr.module_role
where tumr.user_id = '<USER_UUID>'::uuid
  and tumr.tenant_id = '<TENANT_ID>'::uuid
  and tumr.module_key in ('kitchen_inventory', 'kitchen_recipes', 'event_catering')
  and trmp.access_level <> 'none'
order by trmp.module_key, trmp.page_key;
```

Expected pages:

- inventory: `items`, `locations`, `suppliers`, `movements`
- recipes: `recipes`, `costing`, `imports`
- catering: `plans`, `requirements`, `requisitions`, `consumption`
- plus `overview` and `reports`

## Negative POS Validation

For Kitchen Only / No POS users, confirm no POS role was added:

```sql
select tumr.tenant_id, tumr.user_id, tumr.module_key, tumr.module_role
from public.tenant_user_module_roles tumr
where tumr.user_id = '<USER_UUID>'::uuid
  and tumr.tenant_id = '<TENANT_ID>'::uuid
  and tumr.module_key = 'sales_pos';
```

Interpretation under the current contract:

- if the user has at least one modular role in the tenant;
- and no `sales_pos` modular assignment;
- and the tenant-level role is not `admin`;
- then `sales_pos` resolves to `none` for that user in that tenant.

This follows the current fallback behavior documented in `modular-rbac.md`.

For evidence, collect:

```text
sales_pos role added by this execution = no
POS page access added by this execution = no
POS grant added by this execution = no
```

Important limitation:

- if the user already had POS access in the target tenant before the change, do not remove it automatically;
- report the contradiction explicitly and keep the kitchen provisioning additive.

## Reuse Conditions

Reuse this runbook without a new architecture audit only if all remain true:

1. the RBAC tables still exist;
2. the module keys still exist;
3. `admin` is still a valid kitchen module role;
4. no later migration has replaced the current contract;
5. the page matrix remains compatible with the standard package.
