alter table public.retail_pos_device_settings
add column if not exists allow_order_entry boolean not null default false;
