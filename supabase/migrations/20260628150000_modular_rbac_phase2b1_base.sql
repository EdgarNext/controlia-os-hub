create table public.tenant_user_module_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  module_key text not null references public.modules_catalog(module_key) on delete cascade,
  module_role text not null check (module_role in ('admin', 'operator', 'viewer')),
  created_at timestamp with time zone not null default now(),
  created_by uuid null references auth.users(id)
);

create unique index tenant_user_module_roles_tenant_user_module_unique
  on public.tenant_user_module_roles (tenant_id, user_id, module_key);

create index tenant_user_module_roles_tenant_user_idx
  on public.tenant_user_module_roles (tenant_id, user_id);

create index tenant_user_module_roles_tenant_module_idx
  on public.tenant_user_module_roles (tenant_id, module_key);

alter table public.tenant_user_module_roles enable row level security;

create policy tenant_user_module_roles_platform_owner_all
  on public.tenant_user_module_roles
  for all
  using (public.is_platform_owner())
  with check (public.is_platform_owner());

create policy tenant_user_module_roles_tenant_admin_select
  on public.tenant_user_module_roles
  for select
  using (public.is_tenant_admin(tenant_id));

create policy tenant_user_module_roles_tenant_admin_insert
  on public.tenant_user_module_roles
  for insert
  with check (public.is_tenant_admin(tenant_id));

create policy tenant_user_module_roles_tenant_admin_update
  on public.tenant_user_module_roles
  for update
  using (public.is_tenant_admin(tenant_id))
  with check (public.is_tenant_admin(tenant_id));

create policy tenant_user_module_roles_tenant_admin_delete
  on public.tenant_user_module_roles
  for delete
  using (public.is_tenant_admin(tenant_id));

create policy tenant_user_module_roles_user_select_own
  on public.tenant_user_module_roles
  for select
  using (auth.uid() = user_id and public.is_tenant_member(tenant_id));

create or replace function public.resolve_current_tenant_module_role(
  p_tenant_id uuid,
  p_module_key text
) returns text
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_membership_role text;
  v_module_role text;
  v_has_modular_roles boolean := false;
begin
  if p_tenant_id is null or coalesce(trim(p_module_key), '') = '' then
    return null;
  end if;

  if not exists (
    select 1
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant_id
      and tm.module_key = p_module_key
      and tm.enabled = true
  ) then
    return null;
  end if;

  if public.is_platform_owner() then
    return 'admin';
  end if;

  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    return null;
  end if;

  select tm.role
  into v_membership_role
  from public.tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and tm.user_id = auth.uid()
  limit 1;

  if v_membership_role is null then
    return null;
  end if;

  if v_membership_role = 'admin' then
    return 'admin';
  end if;

  select tumr.module_role
  into v_module_role
  from public.tenant_user_module_roles tumr
  where tumr.tenant_id = p_tenant_id
    and tumr.user_id = auth.uid()
    and tumr.module_key = p_module_key
  limit 1;

  if v_module_role is not null then
    return v_module_role;
  end if;

  select exists (
    select 1
    from public.tenant_user_module_roles tumr
    where tumr.tenant_id = p_tenant_id
      and tumr.user_id = auth.uid()
  )
  into v_has_modular_roles;

  if v_has_modular_roles then
    return null;
  end if;

  return v_membership_role;
end;
$function$;

create or replace function public.list_current_tenant_module_roles(
  p_tenant_id uuid
) returns table(module_key text, module_role text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_membership_role text;
  v_has_modular_roles boolean := false;
begin
  if p_tenant_id is null then
    return;
  end if;

  if public.is_platform_owner() then
    return query
    select tm.module_key, 'admin'::text as module_role
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant_id
      and tm.enabled = true
    order by tm.module_key;
    return;
  end if;

  if auth.uid() is null or not public.is_tenant_member(p_tenant_id) then
    return;
  end if;

  select tm.role
  into v_membership_role
  from public.tenant_memberships tm
  where tm.tenant_id = p_tenant_id
    and tm.user_id = auth.uid()
  limit 1;

  if v_membership_role is null then
    return;
  end if;

  if v_membership_role = 'admin' then
    return query
    select tm.module_key, 'admin'::text as module_role
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant_id
      and tm.enabled = true
    order by tm.module_key;
    return;
  end if;

  select exists (
    select 1
    from public.tenant_user_module_roles tumr
    where tumr.tenant_id = p_tenant_id
      and tumr.user_id = auth.uid()
  )
  into v_has_modular_roles;

  if v_has_modular_roles then
    return query
    select tm.module_key, tumr.module_role
    from public.tenant_modules tm
    join public.tenant_user_module_roles tumr
      on tumr.tenant_id = tm.tenant_id
     and tumr.user_id = auth.uid()
     and tumr.module_key = tm.module_key
    where tm.tenant_id = p_tenant_id
      and tm.enabled = true
    order by tm.module_key;
    return;
  end if;

  return query
  select tm.module_key, v_membership_role as module_role
  from public.tenant_modules tm
  where tm.tenant_id = p_tenant_id
    and tm.enabled = true
  order by tm.module_key;
end;
$function$;

create or replace function public.list_current_tenant_module_page_accesses(
  p_tenant_id uuid,
  p_module_key text
) returns table(page_key text, access_level text)
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
begin
  if p_tenant_id is null or coalesce(trim(p_module_key), '') = '' then
    return;
  end if;

  if not exists (
    select 1
    from public.tenant_modules tm
    where tm.tenant_id = p_tenant_id
      and tm.module_key = p_module_key
      and tm.enabled = true
  ) then
    return;
  end if;

  if public.is_platform_owner() then
    return query
    select distinct trmp.page_key, 'manage'::text as access_level
    from public.tenant_role_module_pages trmp
    where trmp.module_key = p_module_key
    order by trmp.page_key;
    return;
  end if;

  v_role := public.resolve_current_tenant_module_role(p_tenant_id, p_module_key);

  if v_role is null then
    return;
  end if;

  return query
  select trmp.page_key, trmp.access_level
  from public.tenant_role_module_pages trmp
  where trmp.module_key = p_module_key
    and trmp.role = v_role;
end;
$function$;
