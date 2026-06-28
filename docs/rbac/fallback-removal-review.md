# Revisión requerida antes de eliminar fallback RBAC modular

## Contexto

Mientras `tenant_user_module_roles` siga vacío para un usuario dentro de un tenant, el rol efectivo modular todavía hereda `tenant_memberships.role` para los módulos habilitados del tenant.

## Actualización Fase 2C

- El usuario `8b3e4b98-9ee5-40a7-926c-02c67054960e` en `expo-cuu` ya no depende del fallback para `sales_pos`.
- Estado aplicado:
  - `tenant_memberships.role = viewer`
  - `tenant_user_module_roles.sales_pos = admin`
- Al tener al menos una asignación modular explícita en `expo-cuu`, los módulos no asignados para ese usuario dejan de heredarse y deben resolver `none`.

## Regla de transición

Cuando un usuario recibe su primera asignación modular en un tenant, deja de heredar acceso para los módulos no asignados y esos módulos pasan a resolver `none`.

## Usuarios/memberships a revisar

| tenant_slug | tenant_id | user_id | membership_role | módulos habilitados del tenant | tiene asignaciones modulares | recomendación inicial |
| --- | --- | --- | --- | --- | --- | --- |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 6658c925-a7a2-4e91-8110-658f474b7a52 | admin | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Confirmar si debe seguir como Tenant Admin general o migrarse a administración por módulos. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | f4177ede-c55e-4c6d-a08e-b5c61371bd7c | admin | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Confirmar si debe seguir como Tenant Admin general o migrarse a administración por módulos. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 0779a7ab-ca06-4a9c-aa8d-fd4c4f2a0a87 | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 0fd0b997-3224-42c0-b6ba-555fc690a91e | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 2194d7d0-85ca-4853-8940-45dd6ea84235 | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 3184d688-f418-4902-a72e-bb791d697c23 | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 483528fd-e00f-4038-8da2-d193238f9ce7 | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | a67effd9-e1b3-4af2-ab2f-f28e0929aaa4 | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | a6fb5893-4350-4828-86d5-e459f49a2359 | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | f379fb88-0c34-4b06-ae2c-f46b9ead64a8 | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | ffa2a5a9-58f1-4387-8ad1-d60a5ee54bfd | operator | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 0030ebfa-c1bd-4f3f-ae69-d27cb725287c | viewer | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 89d8fb80-67f2-4ffa-a5f5-4b23378ba082 | viewer | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 8fa4d120-856c-43d6-b00b-50fbc9a86b81 | viewer | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | 8fe0a76f-6759-4540-86b0-88eeb4e11fa4 | viewer | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | bba492b3-43d5-4359-bc11-dba5bebd6320 | viewer | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |
| expo-cuu | c1c5cb42-2dab-4516-ad50-73f1475051aa | fa222a71-a464-4d1c-8d09-9ce68e8c3ee6 | viewer | event_catering, event_core, kitchen_inventory, kitchen_recipes, sales_pos | no | Revisar qué módulos necesita realmente antes de apagar el fallback. |

## Queries de auditoría

```sql
select
  tm.tenant_id,
  t.slug as tenant_slug,
  tm.user_id,
  tm.role as membership_role,
  coalesce(
    array_agg(distinct tmod.module_key order by tmod.module_key)
      filter (where tmod.enabled),
    '{}'
  ) as enabled_modules,
  exists (
    select 1
    from public.tenant_user_module_roles tumr
    where tumr.tenant_id = tm.tenant_id
      and tumr.user_id = tm.user_id
  ) as has_modular_assignments
from public.tenant_memberships tm
join public.tenants t
  on t.id = tm.tenant_id
left join public.tenant_modules tmod
  on tmod.tenant_id = tm.tenant_id
group by tm.tenant_id, t.slug, tm.user_id, tm.role
order by t.slug, tm.role, tm.user_id;
```

## Checklist antes de eliminar fallback

- Todos los usuarios operativos tienen asignaciones modulares explícitas.
- Cada Tenant Admin general fue confirmado explícitamente.
- Usuarios POS quedaron sólo con `sales_pos` o `retail_pos`.
- Usuarios de cocina quedaron con `kitchen_inventory`, `kitchen_recipes` y/o `event_catering` según corresponda.
- Usuarios de eventos/salas quedaron con `event_core`.
- La validación final se probó con sesión autenticada real.
