-- CRM phase 2: customer quotations backed by authorized product prices.

begin;

create table if not exists public.sales_quotes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_no text not null,
  customer_id uuid not null references public.customers(id),
  owner_employee_id uuid not null references public.employees(id),
  status text not null default 'draft'
    check (status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  price_type text not null
    check (price_type in ('retail', 'group', 'dropship')),
  valid_until date not null,
  subtotal_cny numeric(14, 2) not null default 0 check (subtotal_cny >= 0),
  total_cny numeric(14, 2) not null default 0 check (total_cny >= 0),
  payment_terms text,
  delivery_terms text,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, quote_no)
);

create table if not exists public.sales_quote_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.sales_quotes(id) on delete cascade,
  product_id uuid not null references public.products(id),
  product_code text not null,
  product_name text not null,
  specification text,
  unit text not null default '件',
  quantity numeric(12, 2) not null check (quantity > 0),
  unit_price_cny numeric(14, 2) not null check (unit_price_cny >= 0),
  line_total_cny numeric(14, 2) not null check (line_total_cny >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (quote_id, product_id)
);

create index if not exists sales_quotes_org_created_idx
  on public.sales_quotes (organization_id, created_at desc);

create index if not exists sales_quotes_customer_idx
  on public.sales_quotes (customer_id, created_at desc);

create index if not exists sales_quote_items_quote_idx
  on public.sales_quote_items (quote_id, position);

drop trigger if exists set_sales_quotes_updated_at on public.sales_quotes;
create trigger set_sales_quotes_updated_at
before update on public.sales_quotes
for each row execute function public.set_updated_at();

create or replace function public.can_view_sales_quote(p_quote_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.sales_quotes quote
    where quote.id = p_quote_id
      and quote.organization_id = public.current_organization_id()
      and (
        quote.owner_employee_id = public.current_employee_id()
        or public.can_manage_customers()
        or public.has_org_role('chairman')
        or public.has_org_role('finance')
        or public.has_org_role('admin')
      )
  )
$function$;

create or replace function public.create_sales_quote(
  p_customer_id uuid,
  p_price_type text,
  p_valid_until date,
  p_payment_terms text,
  p_delivery_terms text,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_quote_id uuid;
  v_quote_no text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_product_id uuid;
  v_quantity numeric(12, 2);
  v_unit_price numeric(14, 2);
  v_line_total numeric(14, 2);
  v_total numeric(14, 2) := 0;
  v_position integer := 0;
begin
  select *
  into v_actor
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '只有销售、客服或系统管理员可以创建报价单'
      using errcode = '42501';
  end if;

  if p_price_type not in ('retail', 'group', 'dropship') then
    raise exception '报价类型无效' using errcode = '22023';
  end if;

  if p_price_type in ('group', 'dropship')
    and not public.can_view_channel_prices()
  then
    raise exception '当前账号无权使用渠道价格'
      using errcode = '42501';
  end if;

  if p_valid_until < current_date
    or p_valid_until > current_date + 90
  then
    raise exception '报价有效期需在未来 90 天内'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 50
  then
    raise exception '报价商品数量需为 1 至 50 项'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.id = p_customer_id
      and customer.organization_id = v_actor.organization_id
      and customer.status <> 'inactive'
  ) then
    raise exception '客户不存在、已停用或无权访问'
      using errcode = '42501';
  end if;

  v_quote_no := 'DXQ-'
    || to_char(clock_timestamp(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.sales_quotes (
    organization_id,
    quote_no,
    customer_id,
    owner_employee_id,
    status,
    price_type,
    valid_until,
    payment_terms,
    delivery_terms,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_quote_no,
    p_customer_id,
    v_actor.id,
    'draft',
    p_price_type,
    p_valid_until,
    nullif(btrim(coalesce(p_payment_terms, '')), ''),
    nullif(btrim(coalesce(p_delivery_terms, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  )
  returning id into v_quote_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    begin
      v_product_id := (v_item ->> 'productId')::uuid;
      v_quantity := (v_item ->> 'quantity')::numeric;
    exception
      when others then
        raise exception '报价商品参数无效' using errcode = '22023';
    end;

    if v_quantity <= 0 or v_quantity > 999999 then
      raise exception '商品数量必须大于 0' using errcode = '22023';
    end if;

    select *
    into v_product
    from public.products product
    where product.id = v_product_id
      and product.organization_id = v_actor.organization_id
      and product.status = 'active';

    if v_product.id is null then
      raise exception '报价商品不存在或已下架' using errcode = '22023';
    end if;

    select price.amount_cny
    into v_unit_price
    from public.product_prices price
    where price.organization_id = v_actor.organization_id
      and price.product_id = v_product.id
      and price.price_type = p_price_type
      and price.status = 'active'
      and price.valid_from <= current_date
      and (price.valid_until is null or price.valid_until >= current_date)
    limit 1;

    if v_unit_price is null then
      raise exception '商品 % 未配置当前报价类型价格', v_product.code
        using errcode = '22023';
    end if;

    if exists (
      select 1
      from public.sales_quote_items item
      where item.quote_id = v_quote_id
        and item.product_id = v_product.id
    ) then
      raise exception '同一商品不能重复添加' using errcode = '22023';
    end if;

    v_position := v_position + 1;
    v_line_total := round(v_quantity * v_unit_price, 2);
    v_total := v_total + v_line_total;

    insert into public.sales_quote_items (
      organization_id,
      quote_id,
      product_id,
      product_code,
      product_name,
      specification,
      unit,
      quantity,
      unit_price_cny,
      line_total_cny,
      position
    )
    values (
      v_actor.organization_id,
      v_quote_id,
      v_product.id,
      v_product.code,
      v_product.name,
      v_product.specification,
      coalesce(nullif(v_product.case_specification, ''), '件'),
      v_quantity,
      v_unit_price,
      v_line_total,
      v_position
    );
  end loop;

  update public.sales_quotes
  set subtotal_cny = v_total, total_cny = v_total
  where id = v_quote_id;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'sales_quote_created',
    'sales_quote',
    v_quote_id,
    '创建客户报价单',
    jsonb_build_object(
      'quoteNo', v_quote_no,
      'customerId', p_customer_id,
      'priceType', p_price_type,
      'itemCount', v_position,
      'totalCny', v_total
    )
  );

  return jsonb_build_object(
    'id', v_quote_id,
    'quoteNo', v_quote_no,
    'totalCny', v_total
  );
end;
$function$;

alter table public.sales_quotes enable row level security;
alter table public.sales_quote_items enable row level security;

drop policy if exists "sales quotes visible to authorized users"
  on public.sales_quotes;
create policy "sales quotes visible to authorized users"
on public.sales_quotes for select
to authenticated
using (public.can_view_sales_quote(id));

drop policy if exists "sales quote items visible with quote"
  on public.sales_quote_items;
create policy "sales quote items visible with quote"
on public.sales_quote_items for select
to authenticated
using (public.can_view_sales_quote(quote_id));

revoke all on table public.sales_quotes from anon;
revoke all on table public.sales_quote_items from anon;
revoke insert, update, delete on table public.sales_quotes from authenticated;
revoke insert, update, delete on table public.sales_quote_items from authenticated;
grant select on table public.sales_quotes to authenticated;
grant select on table public.sales_quote_items to authenticated;

revoke all on function public.can_view_sales_quote(uuid) from public, anon;
revoke all on function public.create_sales_quote(
  uuid, text, date, text, text, text, jsonb
) from public, anon;
grant execute on function public.can_view_sales_quote(uuid) to authenticated;
grant execute on function public.create_sales_quote(
  uuid, text, date, text, text, text, jsonb
) to authenticated;

comment on table public.sales_quotes is
  'Customer quotation headers using authorized PIM channel prices.';
comment on table public.sales_quote_items is
  'Immutable product and price snapshots for customer quotations.';

commit;
