begin;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  category text not null check (category in ('rice', 'oil', 'gift')),
  source_category text not null,
  image_path text,
  barcode text,
  brand text,
  short_name text not null,
  name text not null,
  name_en text,
  specification text,
  case_specification text,
  shelf_life text,
  tax_rate numeric(6, 5),
  minimum_order text,
  stock_status text,
  supports_dropship boolean not null default false,
  is_recommended boolean not null default false,
  applicable_scenarios text,
  description text,
  delivery_notes text,
  invoice_notes text,
  alternative_product_codes text[] not null default array[]::text[],
  keywords text[] not null default array[]::text[],
  status text not null default 'active'
    check (status in ('draft', 'active', 'archived')),
  created_by_employee_id uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.product_prices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  price_type text not null
    check (price_type in ('procurement', 'retail', 'group', 'dropship')),
  amount_cny numeric(14, 2) not null check (amount_cny >= 0),
  source_note text,
  status text not null default 'active'
    check (status in ('active', 'expired')),
  valid_from date not null default current_date,
  valid_until date,
  created_by_employee_id uuid references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, product_id, price_type)
);

alter table public.inventory_items
  add column if not exists product_id uuid references public.products(id);

create index if not exists products_org_category_code_idx
  on public.products (organization_id, category, code);

create index if not exists products_org_recommended_idx
  on public.products (organization_id, is_recommended)
  where status = 'active';

create index if not exists product_prices_product_type_idx
  on public.product_prices (product_id, price_type)
  where status = 'active';

create index if not exists inventory_items_product_id_idx
  on public.inventory_items (product_id);

drop trigger if exists set_products_updated_at on public.products;
create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists set_product_prices_updated_at on public.product_prices;
create trigger set_product_prices_updated_at
before update on public.product_prices
for each row execute function public.set_updated_at();

create or replace function public.can_manage_products()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.auth_user_id = (select auth.uid())
      and e.status = 'active'
      and (
        d.code = 'DX-PROC'
        or public.has_org_role('admin')
      )
  )
$function$;

create or replace function public.can_view_channel_prices()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.auth_user_id = (select auth.uid())
      and e.status = 'active'
      and (
        d.code in ('DX-SALES', 'DX-CS', 'DX-PROC', 'DX-FIN')
        or public.has_org_role('admin')
        or public.has_org_role('chairman')
      )
  )
$function$;

create or replace function public.can_view_procurement_prices()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.auth_user_id = (select auth.uid())
      and e.status = 'active'
      and (
        d.code in ('DX-PROC', 'DX-FIN')
        or public.has_org_role('admin')
        or public.has_org_role('chairman')
      )
  )
$function$;

create or replace function public.update_product_master(
  p_product_id uuid,
  p_stock_status text,
  p_minimum_order text,
  p_is_recommended boolean,
  p_status text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_organization_id uuid := public.current_organization_id();
begin
  if not public.can_manage_products() then
    raise exception '只有采购人员或系统管理员可以维护产品资料'
      using errcode = '42501';
  end if;

  if p_status not in ('draft', 'active', 'archived') then
    raise exception '产品状态无效'
      using errcode = '22023';
  end if;

  update public.products
  set
    stock_status = nullif(btrim(coalesce(p_stock_status, '')), ''),
    minimum_order = nullif(btrim(coalesce(p_minimum_order, '')), ''),
    is_recommended = p_is_recommended,
    status = p_status
  where id = p_product_id
    and organization_id = v_organization_id;

  if not found then
    raise exception '产品不存在或不属于当前组织'
      using errcode = '42501';
  end if;
end;
$function$;

alter table public.products enable row level security;
alter table public.product_prices enable row level security;

drop policy if exists "products visible to active employees" on public.products;
create policy "products visible to active employees"
on public.products for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_employee_id() is not null
);

drop policy if exists "products manageable by procurement" on public.products;
create policy "products manageable by procurement"
on public.products for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.can_manage_products()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_products()
);

drop policy if exists "product prices visible by type" on public.product_prices;
create policy "product prices visible by type"
on public.product_prices for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_employee_id() is not null
  and (
    price_type = 'retail'
    or (
      price_type in ('group', 'dropship')
      and public.can_view_channel_prices()
    )
    or (
      price_type = 'procurement'
      and public.can_view_procurement_prices()
    )
  )
);

drop policy if exists "product prices manageable by procurement" on public.product_prices;
create policy "product prices manageable by procurement"
on public.product_prices for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.can_manage_products()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_products()
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists product_images_select_active_employee on storage.objects;
create policy product_images_select_active_employee
on storage.objects
for select
to authenticated
using (
  bucket_id = 'product-images'
  and public.current_employee_id() is not null
);

drop policy if exists product_images_insert_product_manager on storage.objects;
create policy product_images_insert_product_manager
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.can_manage_products()
);

drop policy if exists product_images_update_product_manager on storage.objects;
create policy product_images_update_product_manager
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.can_manage_products()
)
with check (
  bucket_id = 'product-images'
  and public.can_manage_products()
);

drop policy if exists product_images_delete_product_manager on storage.objects;
create policy product_images_delete_product_manager
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.can_manage_products()
);

revoke all on table public.products from anon;
revoke all on table public.product_prices from anon;
grant select on table public.products to authenticated;
grant select on table public.product_prices to authenticated;

revoke all on function public.can_manage_products() from public;
revoke all on function public.can_view_channel_prices() from public;
revoke all on function public.can_view_procurement_prices() from public;
revoke all on function public.update_product_master(uuid, text, text, boolean, text) from public;
grant execute on function public.can_manage_products() to authenticated;
grant execute on function public.can_view_channel_prices() to authenticated;
grant execute on function public.can_view_procurement_prices() to authenticated;
grant execute on function public.update_product_master(uuid, text, text, boolean, text)
  to authenticated;

comment on table public.products is
  '德馨星云 PIM 产品主档，统一承载产品编号、规格、条码、场景和图文资料。';
comment on table public.product_prices is
  '产品价格策略表，按零售、团购、代发和采购价实施字段级访问隔离。';

commit;
