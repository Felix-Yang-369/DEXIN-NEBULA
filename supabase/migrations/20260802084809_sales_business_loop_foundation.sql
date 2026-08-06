-- V0.8 phase 1: sales opportunities and sales order transaction backbone.
-- Generated with Supabase CLI; all writes run through audited RPC functions.

begin;

create table if not exists public.sales_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  opportunity_no text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  legal_entity_id uuid references public.customer_legal_entities(id) on delete restrict,
  owner_employee_id uuid not null references public.employees(id) on delete restrict,
  title text not null,
  stage text not null default 'lead'
    check (stage in ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost')),
  expected_amount_cny numeric(14, 2) not null default 0
    check (expected_amount_cny >= 0 and expected_amount_cny <= 100000000),
  probability integer not null default 10 check (probability between 0 and 100),
  expected_close_on date,
  source text,
  next_action text,
  lost_reason text,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, opportunity_no)
);

create table if not exists public.sales_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_no text not null,
  customer_id uuid not null references public.customers(id) on delete restrict,
  legal_entity_id uuid references public.customer_legal_entities(id) on delete restrict,
  owner_employee_id uuid not null references public.employees(id) on delete restrict,
  opportunity_id uuid references public.sales_opportunities(id) on delete set null,
  source_quote_id uuid references public.sales_quotes(id) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'fulfilling', 'completed', 'cancelled')),
  price_type text not null check (price_type in ('retail', 'group', 'dropship')),
  order_date date not null default current_date,
  requested_delivery_on date,
  currency text not null default 'CNY' check (currency = 'CNY'),
  subtotal_cny numeric(14, 2) not null default 0 check (subtotal_cny >= 0),
  discount_cny numeric(14, 2) not null default 0 check (discount_cny >= 0),
  total_cny numeric(14, 2) not null default 0 check (total_cny >= 0),
  payment_terms text,
  delivery_terms text,
  note text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_no),
  check (requested_delivery_on is null or requested_delivery_on >= order_date),
  check (discount_cny <= subtotal_cny),
  check (total_cny = subtotal_cny - discount_cny)
);

create table if not exists public.sales_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_code text not null,
  product_name text not null,
  specification text,
  unit text not null default '件',
  quantity numeric(12, 3) not null check (quantity > 0),
  unit_price_cny numeric(14, 2) not null check (unit_price_cny >= 0),
  line_total_cny numeric(14, 2) not null check (line_total_cny >= 0),
  delivered_quantity numeric(12, 3) not null default 0 check (delivered_quantity >= 0),
  returned_quantity numeric(12, 3) not null default 0 check (returned_quantity >= 0),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (order_id, product_id),
  check (delivered_quantity <= quantity),
  check (returned_quantity <= delivered_quantity)
);

create table if not exists public.sales_order_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_id uuid not null references public.sales_orders(id) on delete cascade,
  actor_employee_id uuid not null references public.employees(id),
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.sales_order_profitability (
  order_id uuid primary key references public.sales_orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  revenue_cny numeric(14, 2) not null default 0,
  cost_cny numeric(14, 2) not null default 0,
  gross_profit_cny numeric(14, 2) generated always as (revenue_cny - cost_cny) stored,
  cost_status text not null default 'pending'
    check (cost_status in ('pending', 'estimated', 'actual')),
  updated_at timestamptz not null default now()
);

create index if not exists sales_opportunities_org_stage_idx
  on public.sales_opportunities (organization_id, stage, expected_close_on, updated_at desc);
create index if not exists sales_opportunities_owner_idx
  on public.sales_opportunities (owner_employee_id, stage, updated_at desc);
create index if not exists sales_orders_org_status_idx
  on public.sales_orders (organization_id, status, order_date desc, created_at desc);
create index if not exists sales_orders_customer_idx
  on public.sales_orders (customer_id, order_date desc);
create index if not exists sales_order_items_order_idx
  on public.sales_order_items (order_id, position);
create index if not exists sales_order_events_order_idx
  on public.sales_order_events (order_id, created_at);

drop trigger if exists sales_opportunities_set_updated_at on public.sales_opportunities;
create trigger sales_opportunities_set_updated_at
before update on public.sales_opportunities
for each row execute function public.set_updated_at();
drop trigger if exists sales_orders_set_updated_at on public.sales_orders;
create trigger sales_orders_set_updated_at
before update on public.sales_orders
for each row execute function public.set_updated_at();
drop trigger if exists sales_order_profitability_set_updated_at on public.sales_order_profitability;
create trigger sales_order_profitability_set_updated_at
before update on public.sales_order_profitability
for each row execute function public.set_updated_at();

create or replace function public.can_view_sales_order(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1 from public.sales_orders sales_order
    where sales_order.id = p_order_id
      and sales_order.organization_id = public.current_organization_id()
      and (
        sales_order.owner_employee_id = public.current_employee_id()
        or public.can_manage_customers()
        or public.has_org_role('chairman')
        or public.has_org_role('finance')
        or public.has_org_role('admin')
      )
  )
$function$;

revoke all on function public.can_view_sales_order(uuid) from public, anon;
grant execute on function public.can_view_sales_order(uuid) to authenticated;

alter table public.sales_opportunities enable row level security;
alter table public.sales_orders enable row level security;
alter table public.sales_order_items enable row level security;
alter table public.sales_order_events enable row level security;
alter table public.sales_order_profitability enable row level security;

create policy sales_opportunities_select_authorized
on public.sales_opportunities for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    owner_employee_id = public.current_employee_id()
    or public.can_manage_customers()
    or public.has_org_role('chairman')
    or public.has_org_role('finance')
    or public.has_org_role('admin')
  )
);
create policy sales_orders_select_authorized
on public.sales_orders for select to authenticated
using (public.can_view_sales_order(id));
create policy sales_order_items_select_authorized
on public.sales_order_items for select to authenticated
using (public.can_view_sales_order(order_id));
create policy sales_order_events_select_authorized
on public.sales_order_events for select to authenticated
using (public.can_view_sales_order(order_id));
create policy sales_order_profitability_select_sensitive
on public.sales_order_profitability for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_org_role('finance')
    or public.has_org_role('chairman')
    or public.has_org_role('admin')
  )
);

revoke all on table public.sales_opportunities from anon, authenticated;
revoke all on table public.sales_orders from anon, authenticated;
revoke all on table public.sales_order_items from anon, authenticated;
revoke all on table public.sales_order_events from anon, authenticated;
revoke all on table public.sales_order_profitability from anon, authenticated;
grant select on table public.sales_opportunities to authenticated;
grant select on table public.sales_orders to authenticated;
grant select on table public.sales_order_items to authenticated;
grant select on table public.sales_order_events to authenticated;
grant select on table public.sales_order_profitability to authenticated;

create or replace function public.create_sales_opportunity(
  p_customer_id uuid,
  p_legal_entity_id uuid,
  p_title text,
  p_expected_amount_cny numeric,
  p_probability integer,
  p_expected_close_on date,
  p_source text,
  p_next_action text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_id uuid;
  v_no text;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '当前账号无权创建销售机会' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 2
    or coalesce(p_expected_amount_cny, -1) < 0
    or p_expected_amount_cny > 100000000
    or coalesce(p_probability, -1) not between 0 and 100
  then
    raise exception '销售机会参数无效' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.customers customer
    where customer.id = p_customer_id
      and customer.organization_id = v_actor.organization_id
      and customer.status <> 'inactive'
  ) then
    raise exception '客户不存在或已停用' using errcode = '42501';
  end if;
  if p_legal_entity_id is not null and not exists (
    select 1 from public.customer_legal_entities entity
    where entity.id = p_legal_entity_id
      and entity.customer_id = p_customer_id
      and entity.organization_id = v_actor.organization_id
      and entity.status = 'active'
  ) then
    raise exception '客户法律实体无效' using errcode = '42501';
  end if;
  v_no := 'DXO-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.sales_opportunities (
    organization_id, opportunity_no, customer_id, legal_entity_id,
    owner_employee_id, title, expected_amount_cny, probability,
    expected_close_on, source, next_action, note, created_by_employee_id
  ) values (
    v_actor.organization_id, v_no, p_customer_id, p_legal_entity_id,
    v_actor.id, btrim(p_title), p_expected_amount_cny, p_probability,
    p_expected_close_on, nullif(btrim(coalesce(p_source, '')), ''),
    nullif(btrim(coalesce(p_next_action, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
  ) returning id into v_id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'sales_opportunity_created',
    'sales_opportunity', v_id, '创建销售机会：' || btrim(p_title),
    jsonb_build_object('opportunity_no', v_no, 'customer_id', p_customer_id)
  );
  return jsonb_build_object('id', v_id, 'opportunityNo', v_no);
end;
$function$;

create or replace function public.create_sales_order(
  p_customer_id uuid,
  p_legal_entity_id uuid,
  p_opportunity_id uuid,
  p_price_type text,
  p_order_date date,
  p_requested_delivery_on date,
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
  v_order_id uuid;
  v_order_no text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity numeric(12, 3);
  v_unit_price numeric(14, 2);
  v_line_total numeric(14, 2);
  v_total numeric(14, 2) := 0;
  v_position integer := 0;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '当前账号无权创建销售订单' using errcode = '42501';
  end if;
  if p_legal_entity_id is null
    or p_price_type not in ('retail', 'group', 'dropship')
    or p_order_date is null
    or (p_requested_delivery_on is not null and p_requested_delivery_on < p_order_date)
    or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) < 1
    or jsonb_array_length(p_items) > 100
  then
    raise exception '销售订单参数无效' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.customers customer
    where customer.id = p_customer_id
      and customer.organization_id = v_actor.organization_id
      and customer.status <> 'inactive'
  ) then
    raise exception '客户不存在或已停用' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.customer_legal_entities entity
    where entity.id = p_legal_entity_id
      and entity.customer_id = p_customer_id
      and entity.organization_id = v_actor.organization_id
      and entity.status = 'active'
  ) then
    raise exception '客户法律实体无效' using errcode = '42501';
  end if;
  if p_opportunity_id is not null and not exists (
    select 1 from public.sales_opportunities opportunity
    where opportunity.id = p_opportunity_id
      and opportunity.customer_id = p_customer_id
      and opportunity.organization_id = v_actor.organization_id
  ) then
    raise exception '销售机会与客户不匹配' using errcode = '23514';
  end if;

  v_order_no := 'DXSO-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.sales_orders (
    organization_id, order_no, customer_id, legal_entity_id,
    owner_employee_id, opportunity_id, status, price_type, order_date,
    requested_delivery_on, payment_terms, delivery_terms, note,
    created_by_employee_id
  ) values (
    v_actor.organization_id, v_order_no, p_customer_id, p_legal_entity_id,
    v_actor.id, p_opportunity_id, 'draft', p_price_type, p_order_date,
    p_requested_delivery_on, nullif(btrim(coalesce(p_payment_terms, '')), ''),
    nullif(btrim(coalesce(p_delivery_terms, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    v_quantity := (v_item ->> 'quantity')::numeric;
    select * into v_product from public.products product
    where product.id = (v_item ->> 'productId')::uuid
      and product.organization_id = v_actor.organization_id
      and product.status = 'active';
    if v_product.id is null or v_quantity <= 0 or v_quantity > 999999 then
      raise exception '订单商品或数量无效' using errcode = '22023';
    end if;
    select price.amount_cny into v_unit_price
    from public.product_prices price
    where price.organization_id = v_actor.organization_id
      and price.product_id = v_product.id
      and price.price_type = p_price_type
      and price.status = 'active'
    limit 1;
    if v_unit_price is null then
      raise exception '商品 % 未配置当前价格', v_product.code using errcode = '23514';
    end if;
    v_line_total := round(v_quantity * v_unit_price, 2);
    v_total := v_total + v_line_total;
    insert into public.sales_order_items (
      organization_id, order_id, product_id, product_code, product_name,
      specification, unit, quantity, unit_price_cny, line_total_cny, position
    ) values (
      v_actor.organization_id, v_order_id, v_product.id, v_product.code,
      v_product.name, v_product.specification, '件', v_quantity,
      v_unit_price, v_line_total, v_position
    );
  end loop;
  update public.sales_orders
  set subtotal_cny = v_total, total_cny = v_total
  where id = v_order_id;
  insert into public.sales_order_profitability (
    order_id, organization_id, revenue_cny, cost_cny, cost_status
  ) values (v_order_id, v_actor.organization_id, v_total, 0, 'pending');
  insert into public.sales_order_events (
    organization_id, order_id, actor_employee_id, from_status, to_status, note
  ) values (
    v_actor.organization_id, v_order_id, v_actor.id, null, 'draft', '创建销售订单草稿'
  );
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'sales_order_created', 'sales_order',
    v_order_id, '创建销售订单：' || v_order_no,
    jsonb_build_object('order_no', v_order_no, 'customer_id', p_customer_id, 'total_cny', v_total)
  );
  return jsonb_build_object('id', v_order_id, 'orderNo', v_order_no, 'totalCny', v_total);
end;
$function$;

create or replace function public.transition_sales_order(
  p_order_id uuid,
  p_target_status text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_order public.sales_orders%rowtype;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '当前账号无权更新销售订单' using errcode = '42501';
  end if;
  select * into v_order from public.sales_orders sales_order
  where sales_order.id = p_order_id
    and sales_order.organization_id = v_actor.organization_id
  for update;
  if v_order.id is null then
    raise exception '销售订单不存在' using errcode = 'P0002';
  end if;
  if not (
    (v_order.status = 'draft' and p_target_status in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and p_target_status = 'cancelled')
  ) then
    raise exception '当前订单状态不允许此操作' using errcode = '23514';
  end if;
  if p_target_status = 'confirmed' and v_order.legal_entity_id is null then
    raise exception '确认订单前必须选择客户法律实体' using errcode = '23514';
  end if;
  if p_target_status = 'cancelled' and char_length(btrim(coalesce(p_note, ''))) < 2 then
    raise exception '取消订单必须填写原因' using errcode = '22023';
  end if;
  update public.sales_orders set
    status = p_target_status,
    confirmed_at = case when p_target_status = 'confirmed' then now() else confirmed_at end,
    cancelled_at = case when p_target_status = 'cancelled' then now() else cancelled_at end,
    cancellation_reason = case when p_target_status = 'cancelled' then btrim(p_note) else cancellation_reason end
  where id = v_order.id;
  if p_target_status = 'confirmed' and v_order.opportunity_id is not null then
    update public.sales_opportunities set stage = 'won', probability = 100
    where id = v_order.opportunity_id and stage <> 'lost';
  end if;
  insert into public.sales_order_events (
    organization_id, order_id, actor_employee_id, from_status, to_status, note
  ) values (
    v_actor.organization_id, v_order.id, v_actor.id, v_order.status,
    p_target_status, nullif(btrim(coalesce(p_note, '')), '')
  );
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'sales_order_status_changed',
    'sales_order', v_order.id, '销售订单状态更新：' || v_order.order_no,
    jsonb_build_object('from_status', v_order.status, 'to_status', p_target_status, 'note', p_note)
  );
end;
$function$;

revoke all on function public.create_sales_opportunity(uuid, uuid, text, numeric, integer, date, text, text, text) from public, anon;
grant execute on function public.create_sales_opportunity(uuid, uuid, text, numeric, integer, date, text, text, text) to authenticated;
revoke all on function public.create_sales_order(uuid, uuid, uuid, text, date, date, text, text, text, jsonb) from public, anon;
grant execute on function public.create_sales_order(uuid, uuid, uuid, text, date, date, text, text, text, jsonb) to authenticated;
revoke all on function public.transition_sales_order(uuid, text, text) from public, anon;
grant execute on function public.transition_sales_order(uuid, text, text) to authenticated;

commit;
