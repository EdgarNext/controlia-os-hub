# Modular Role Assignment Runbook

## Objetivo

Este runbook describe cómo convertir un usuario existente en un usuario POS-only dentro de un tenant específico, sin tocar otros usuarios, otros tenants ni datos operativos.

## Caso de referencia

- Tenant: `expo-cuu`
- Usuario objetivo: `8b3e4b98-9ee5-40a7-926c-02c67054960e`
- Resultado esperado:
  - membership base en `expo-cuu`
  - `tenant_memberships.role = viewer`
  - `tenant_user_module_roles.sales_pos = admin`
  - sin otros roles modulares en `expo-cuu`

## Validaciones previas

1. Verificar que el usuario existe en `auth.users`.
2. Verificar que el usuario no es `Platform Owner`.
3. Resolver el tenant destino por slug.
4. Confirmar que `sales_pos` está habilitado en el tenant.
5. Confirmar que `tenant_modules.config.pos_type = simple`.
6. Verificar memberships actuales del usuario.
7. Si el usuario tiene memberships en otros tenants, detenerse y pedir confirmación explícita antes de limpiar esos accesos.
8. Verificar roles modulares actuales del usuario.
9. Verificar `tenant_role_module_pages` para `sales_pos/admin`.

## SQL plantilla

```sql
select id
from auth.users
where id = '<USER_ID>'::uuid;
```

```sql
select owner_user_id
from public.platform_settings
limit 1;
```

```sql
select id, slug
from public.tenants
where slug = '<TENANT_SLUG>';
```

```sql
select tm.tenant_id, tm.module_key, tm.enabled, tm.config
from public.tenant_modules tm
join public.tenants t on t.id = tm.tenant_id
where t.slug = '<TENANT_SLUG>'
  and tm.module_key = 'sales_pos';
```

```sql
select t.slug, tm.tenant_id, tm.user_id, tm.role
from public.tenant_memberships tm
join public.tenants t on t.id = tm.tenant_id
where tm.user_id = '<USER_ID>'::uuid
order by t.slug;
```

```sql
select t.slug, tumr.tenant_id, tumr.user_id, tumr.module_key, tumr.module_role
from public.tenant_user_module_roles tumr
join public.tenants t on t.id = tumr.tenant_id
where tumr.user_id = '<USER_ID>'::uuid
order by t.slug, tumr.module_key;
```

## Secuencia de asignación

1. Asegurar membership en el tenant destino con `role = 'viewer'`.
2. Eliminar roles modulares del usuario en ese tenant que no sean `sales_pos`.
3. Insertar o actualizar `tenant_user_module_roles` con `module_key = 'sales_pos'` y `module_role = 'admin'`.
4. Reconsultar memberships y roles modulares.

## Plantilla de write

```sql
insert into public.tenant_memberships (
  tenant_id,
  user_id,
  role,
  created_by
)
values (
  '<TENANT_ID>'::uuid,
  '<USER_ID>'::uuid,
  'viewer',
  null
);
```

```sql
update public.tenant_memberships
set role = 'viewer'
where tenant_id = '<TENANT_ID>'::uuid
  and user_id = '<USER_ID>'::uuid;
```

```sql
delete from public.tenant_user_module_roles
where tenant_id = '<TENANT_ID>'::uuid
  and user_id = '<USER_ID>'::uuid
  and module_key <> 'sales_pos';
```

```sql
insert into public.tenant_user_module_roles (
  tenant_id,
  user_id,
  module_key,
  module_role,
  created_by
)
values (
  '<TENANT_ID>'::uuid,
  '<USER_ID>'::uuid,
  'sales_pos',
  'admin',
  null
)
on conflict (tenant_id, user_id, module_key)
do update set
  module_role = excluded.module_role;
```

## Rollback

El rollback debe ser específico para el usuario y tenant tocados.

Para el caso `expo-cuu` + `8b3e4b98-9ee5-40a7-926c-02c67054960e`:

- estado previo de membership: no existía fila
- estado previo de rol modular `sales_pos`: no existía fila

Rollback:

```sql
delete from public.tenant_user_module_roles
where tenant_id = 'c1c5cb42-2dab-4516-ad50-73f1475051aa'::uuid
  and user_id = '8b3e4b98-9ee5-40a7-926c-02c67054960e'::uuid
  and module_key = 'sales_pos';
```

```sql
delete from public.tenant_memberships
where tenant_id = 'c1c5cb42-2dab-4516-ad50-73f1475051aa'::uuid
  and user_id = '8b3e4b98-9ee5-40a7-926c-02c67054960e'::uuid;
```

## Checklist de navegador

1. Iniciar sesión con el usuario objetivo.
2. Confirmar que sólo aparece el tenant esperado.
3. Confirmar que sólo aparece POS simple.
4. Confirmar acceso a categorías POS simple.
5. Confirmar acceso a productos POS simple.
6. Intentar acceso directo a rutas de eventos, venue, cocina, POS variants y retail.
7. Confirmar que esas rutas no aparecen o se bloquean.
