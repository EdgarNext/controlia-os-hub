alter table public.retail_pos_orders
add column if not exists origin_local_folio text null;

create index if not exists retail_pos_orders_tenant_origin_local_folio_idx
on public.retail_pos_orders (tenant_id, origin_local_folio)
where origin_local_folio is not null;

create unique index if not exists retail_pos_orders_tenant_origin_local_folio_uidx
on public.retail_pos_orders (tenant_id, origin_local_folio)
where origin_local_folio is not null;
