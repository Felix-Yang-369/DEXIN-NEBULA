-- V0.9 procurement, receiving, payable and bank reconciliation loop.

begin;

create table public.purchase_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_no text not null,
  requester_employee_id uuid not null references public.employees(id),
  title text not null,
  reason text,
  required_on date,
  status text not null default 'submitted'
    check (status in ('submitted', 'approved', 'rejected', 'converted', 'cancelled')),
  estimated_amount numeric(14, 2) not null default 0 check (estimated_amount >= 0),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by_employee_id uuid references public.employees(id),
  decision_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_no)
);

create table public.purchase_request_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_code text not null,
  product_name text not null,
  specification text,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit text not null default '件',
  estimated_unit_price numeric(14, 2) not null default 0 check (estimated_unit_price >= 0),
  estimated_line_amount numeric(14, 2) not null default 0 check (estimated_line_amount >= 0),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  unique (purchase_request_id, product_id)
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  order_no text not null,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  buyer_employee_id uuid not null references public.employees(id),
  status text not null default 'draft'
    check (status in ('draft', 'confirmed', 'partial_received', 'received', 'cancelled')),
  order_date date not null default current_date,
  expected_arrival_on date,
  currency text not null default 'CNY' check (currency = 'CNY'),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  payment_terms text,
  delivery_terms text,
  note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, order_no)
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  product_code text not null,
  product_name text not null,
  specification text,
  quantity numeric(14, 3) not null check (quantity > 0),
  received_quantity numeric(14, 3) not null default 0
    check (received_quantity >= 0 and received_quantity <= quantity),
  unit text not null default '件',
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  line_amount numeric(14, 2) not null check (line_amount >= 0),
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_order_id, product_id)
);

create table public.goods_receipts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  receipt_no text not null,
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  supplier_delivery_no text,
  received_on date not null default current_date,
  status text not null default 'posted' check (status in ('posted', 'reversed')),
  total_amount numeric(14, 2) not null default 0 check (total_amount >= 0),
  received_by_employee_id uuid not null references public.employees(id),
  note text,
  created_at timestamptz not null default now(),
  unique (organization_id, receipt_no)
);

create table public.goods_receipt_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  goods_receipt_id uuid not null references public.goods_receipts(id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items(id) on delete restrict,
  product_id uuid not null references public.products(id) on delete restrict,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  inventory_batch_id uuid references public.inventory_batches(id) on delete set null,
  inventory_movement_id uuid references public.inventory_movements(id) on delete set null,
  quantity numeric(14, 3) not null check (quantity > 0),
  unit_cost numeric(14, 2) not null check (unit_cost >= 0),
  line_amount numeric(14, 2) not null check (line_amount >= 0),
  production_date date,
  shelf_life_months integer check (shelf_life_months is null or shelf_life_months > 0),
  expiry_date date,
  created_at timestamptz not null default now(),
  unique (goods_receipt_id, purchase_order_item_id)
);

create table public.bank_statement_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_account_name text not null,
  transaction_date date not null,
  direction text not null check (direction in ('inflow', 'outflow')),
  counterparty_name text,
  summary text,
  bank_reference text,
  amount numeric(14, 2) not null check (amount > 0),
  reconciled_amount numeric(14, 2) not null default 0
    check (reconciled_amount >= 0 and reconciled_amount <= amount),
  status text not null default 'unmatched'
    check (status in ('unmatched', 'partial', 'matched', 'ignored')),
  imported_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bank_reconciliations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_statement_line_id uuid not null references public.bank_statement_lines(id) on delete restrict,
  finance_document_id uuid not null references public.finance_documents(id) on delete restrict,
  finance_settlement_id uuid not null references public.finance_settlements(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  reconciled_on date not null default current_date,
  reconciled_by_employee_id uuid not null references public.employees(id),
  note text,
  created_at timestamptz not null default now()
);

alter table public.finance_documents
  add column if not exists supplier_id uuid references public.suppliers(id) on delete restrict,
  add column if not exists purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  add column if not exists goods_receipt_id uuid references public.goods_receipts(id) on delete set null;

alter table public.finance_settlements
  add column if not exists bank_statement_line_id uuid references public.bank_statement_lines(id) on delete set null;

create index purchase_requests_org_status_idx
  on public.purchase_requests (organization_id, status, required_on);
create index purchase_orders_org_status_idx
  on public.purchase_orders (organization_id, status, expected_arrival_on);
create index purchase_orders_supplier_idx
  on public.purchase_orders (supplier_id, order_date desc);
create index purchase_order_items_order_idx
  on public.purchase_order_items (purchase_order_id, position);
create index goods_receipts_order_idx
  on public.goods_receipts (purchase_order_id, received_on desc);
create index bank_statement_lines_org_status_idx
  on public.bank_statement_lines (organization_id, status, transaction_date desc);
create unique index bank_statement_lines_reference_idx
  on public.bank_statement_lines (organization_id, bank_account_name, bank_reference)
  where bank_reference is not null;
create index finance_documents_supplier_idx
  on public.finance_documents (supplier_id, issue_date desc)
  where supplier_id is not null;
create unique index finance_documents_receipt_payable_idx
  on public.finance_documents (goods_receipt_id)
  where goods_receipt_id is not null and document_type = 'payable';

create trigger purchase_requests_set_updated_at
before update on public.purchase_requests
for each row execute function public.set_updated_at();
create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();
create trigger purchase_order_items_set_updated_at
before update on public.purchase_order_items
for each row execute function public.set_updated_at();
create trigger bank_statement_lines_set_updated_at
before update on public.bank_statement_lines
for each row execute function public.set_updated_at();

create or replace function public.can_view_procurement_operations()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.id = public.current_employee_id()
      and employee.status = 'active'
      and (
        department.code in ('DX-PROC', 'DX-FIN')
        or public.has_org_role('admin')
        or public.has_org_role('chairman')
        or public.has_org_role('finance')
      )
  )
$function$;

revoke all on function public.can_view_procurement_operations() from public, anon;
grant execute on function public.can_view_procurement_operations() to authenticated;

alter table public.purchase_requests enable row level security;
alter table public.purchase_request_items enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.goods_receipts enable row level security;
alter table public.goods_receipt_items enable row level security;
alter table public.bank_statement_lines enable row level security;
alter table public.bank_reconciliations enable row level security;

create policy purchase_requests_select_authorized
on public.purchase_requests for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    requester_employee_id = (select public.current_employee_id())
    or (select public.can_view_procurement_operations())
  )
);
create policy purchase_request_items_select_authorized
on public.purchase_request_items for select to authenticated
using (
  exists (
    select 1 from public.purchase_requests request
    where request.id = purchase_request_items.purchase_request_id
      and request.organization_id = (select public.current_organization_id())
      and (
        request.requester_employee_id = (select public.current_employee_id())
        or (select public.can_view_procurement_operations())
      )
  )
);
create policy purchase_orders_select_authorized
on public.purchase_orders for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_view_procurement_prices())
);
create policy purchase_order_items_select_authorized
on public.purchase_order_items for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_view_procurement_prices())
);
create policy goods_receipts_select_authorized
on public.goods_receipts for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_view_procurement_prices())
);
create policy goods_receipt_items_select_authorized
on public.goods_receipt_items for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_view_procurement_prices())
);
create policy bank_statement_lines_select_finance
on public.bank_statement_lines for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);
create policy bank_reconciliations_select_finance
on public.bank_reconciliations for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

revoke all on table public.purchase_requests from anon, authenticated;
revoke all on table public.purchase_request_items from anon, authenticated;
revoke all on table public.purchase_orders from anon, authenticated;
revoke all on table public.purchase_order_items from anon, authenticated;
revoke all on table public.goods_receipts from anon, authenticated;
revoke all on table public.goods_receipt_items from anon, authenticated;
revoke all on table public.bank_statement_lines from anon, authenticated;
revoke all on table public.bank_reconciliations from anon, authenticated;
grant select on table public.purchase_requests to authenticated;
grant select on table public.purchase_request_items to authenticated;
grant select on table public.purchase_orders to authenticated;
grant select on table public.purchase_order_items to authenticated;
grant select on table public.goods_receipts to authenticated;
grant select on table public.goods_receipt_items to authenticated;
grant select on table public.bank_statement_lines to authenticated;
grant select on table public.bank_reconciliations to authenticated;

create or replace function public.warehouse_receiving_queue()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select case
    when not public.can_manage_inventory() then '[]'::jsonb
    else coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', purchase_order.id,
          'orderNo', purchase_order.order_no,
          'status', purchase_order.status,
          'orderDate', purchase_order.order_date,
          'expectedArrivalOn', purchase_order.expected_arrival_on,
          'supplierName', supplier.name,
          'warehouseName', warehouse.name,
          'buyerName', buyer.name,
          'items', (
            select coalesce(
              jsonb_agg(
                jsonb_build_object(
                  'id', item.id,
                  'productName', item.product_name,
                  'quantity', item.quantity,
                  'receivedQuantity', item.received_quantity,
                  'unit', item.unit
                ) order by item.position
              ),
              '[]'::jsonb
            )
            from public.purchase_order_items item
            where item.purchase_order_id = purchase_order.id
          )
        ) order by purchase_order.expected_arrival_on asc nulls last
      ),
      '[]'::jsonb
    )
  end
  from public.purchase_orders purchase_order
  join public.suppliers supplier on supplier.id = purchase_order.supplier_id
  join public.warehouses warehouse on warehouse.id = purchase_order.warehouse_id
  join public.employees buyer on buyer.id = purchase_order.buyer_employee_id
  where purchase_order.organization_id = public.current_organization_id()
    and purchase_order.status in ('confirmed', 'partial_received')
$function$;

revoke all on function public.warehouse_receiving_queue() from public, anon;
grant execute on function public.warehouse_receiving_queue() to authenticated;

create or replace function public.create_purchase_request(
  p_title text,
  p_reason text,
  p_required_on date,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_request_id uuid;
  v_request_no text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_quantity numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_amount numeric(14, 2);
  v_total numeric(14, 2) := 0;
  v_position integer := 0;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null then
    raise exception '当前账号未绑定在职员工' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_title, ''))) < 2
    or char_length(btrim(coalesce(p_title, ''))) > 120
    or (p_required_on is not null and p_required_on < current_date)
    or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) < 1
    or jsonb_array_length(p_items) > 100
  then
    raise exception '采购申请参数无效' using errcode = '22023';
  end if;

  v_request_no := 'DXPR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.purchase_requests (
    organization_id, request_no, requester_employee_id, title, reason, required_on
  ) values (
    v_actor.organization_id, v_request_no, v_actor.id, btrim(p_title),
    nullif(btrim(coalesce(p_reason, '')), ''), p_required_on
  ) returning id into v_request_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    v_quantity := (v_item ->> 'quantity')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception '采购申请商品数量无效' using errcode = '22023';
    end if;
    select * into v_product from public.products product
    where product.id = (v_item ->> 'productId')::uuid
      and product.organization_id = v_actor.organization_id
      and product.status = 'active';
    if v_product.id is null then
      raise exception '采购申请包含无效产品' using errcode = '42501';
    end if;
    if public.can_view_procurement_prices() then
      select price.amount_cny into v_unit_price
      from public.product_prices price
      where price.product_id = v_product.id
        and price.organization_id = v_actor.organization_id
        and price.price_type = 'procurement'
        and price.status = 'active'
        and price.valid_from <= current_date
        and (price.valid_until is null or price.valid_until >= current_date)
      order by price.valid_from desc limit 1;
    else
      v_unit_price := 0;
    end if;
    v_unit_price := coalesce(v_unit_price, 0);
    v_line_amount := round(v_quantity * v_unit_price, 2);
    v_total := v_total + v_line_amount;
    insert into public.purchase_request_items (
      organization_id, purchase_request_id, product_id, product_code,
      product_name, specification, quantity, unit, estimated_unit_price,
      estimated_line_amount, position
    ) values (
      v_actor.organization_id, v_request_id, v_product.id, v_product.code,
      v_product.name, v_product.specification, v_quantity, '件', v_unit_price,
      v_line_amount, v_position
    );
  end loop;
  update public.purchase_requests set estimated_amount = v_total where id = v_request_id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'purchase_request_submitted',
    'purchase_request', v_request_id, '提交采购申请 ' || v_request_no,
    jsonb_build_object('estimated_amount', v_total, 'item_count', v_position)
  );
  return jsonb_build_object('id', v_request_id, 'requestNo', v_request_no);
end;
$function$;

create or replace function public.transition_purchase_request(
  p_request_id uuid,
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
  v_request public.purchase_requests%rowtype;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  select * into v_request from public.purchase_requests
  where id = p_request_id and organization_id = v_actor.organization_id for update;
  if v_request.id is null then
    raise exception '采购申请不存在' using errcode = '42501';
  end if;
  if p_target_status = 'cancelled' then
    if v_request.requester_employee_id <> v_actor.id or v_request.status <> 'submitted' then
      raise exception '当前采购申请不可撤回' using errcode = '42501';
    end if;
  elsif p_target_status in ('approved', 'rejected') then
    if not public.can_manage_suppliers() or v_request.status <> 'submitted' then
      raise exception '当前账号无权审批采购申请' using errcode = '42501';
    end if;
    if p_target_status = 'rejected' and char_length(btrim(coalesce(p_note, ''))) < 2 then
      raise exception '驳回采购申请必须填写原因' using errcode = '22023';
    end if;
  else
    raise exception '采购申请目标状态无效' using errcode = '22023';
  end if;
  update public.purchase_requests set
    status = p_target_status,
    decided_at = case when p_target_status in ('approved', 'rejected') then now() else decided_at end,
    decided_by_employee_id = case when p_target_status in ('approved', 'rejected') then v_actor.id else decided_by_employee_id end,
    decision_note = nullif(btrim(coalesce(p_note, '')), '')
  where id = v_request.id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'purchase_request_' || p_target_status,
    'purchase_request', v_request.id,
    '采购申请 ' || v_request.request_no || ' 更新为 ' || p_target_status,
    jsonb_build_object('from', v_request.status, 'to', p_target_status, 'note', p_note)
  );
end;
$function$;

create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_warehouse_id uuid,
  p_purchase_request_id uuid,
  p_order_date date,
  p_expected_arrival_on date,
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
  v_quantity numeric(14, 3);
  v_unit_price numeric(14, 2);
  v_line_amount numeric(14, 2);
  v_total numeric(14, 2) := 0;
  v_position integer := 0;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_suppliers() then
    raise exception '只有采购、管理员或董事长可以创建采购订单' using errcode = '42501';
  end if;
  if p_order_date is null
    or (p_expected_arrival_on is not null and p_expected_arrival_on < p_order_date)
    or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) < 1
    or jsonb_array_length(p_items) > 100
  then
    raise exception '采购订单参数无效' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.suppliers supplier
    where supplier.id = p_supplier_id
      and supplier.organization_id = v_actor.organization_id
      and supplier.cooperation_status = 'active'
  ) then
    raise exception '供应商未处于合作状态' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.warehouses warehouse
    where warehouse.id = p_warehouse_id
      and warehouse.organization_id = v_actor.organization_id
      and warehouse.status = 'active'
  ) then
    raise exception '收货仓库无效' using errcode = '42501';
  end if;
  if p_purchase_request_id is not null and not exists (
    select 1 from public.purchase_requests request
    where request.id = p_purchase_request_id
      and request.organization_id = v_actor.organization_id
      and request.status = 'approved'
  ) then
    raise exception '关联采购申请未通过审批' using errcode = '23514';
  end if;

  v_order_no := 'DXPO-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.purchase_orders (
    organization_id, order_no, supplier_id, warehouse_id, purchase_request_id,
    buyer_employee_id, order_date, expected_arrival_on, payment_terms,
    delivery_terms, note
  ) values (
    v_actor.organization_id, v_order_no, p_supplier_id, p_warehouse_id,
    p_purchase_request_id, v_actor.id, p_order_date, p_expected_arrival_on,
    nullif(btrim(coalesce(p_payment_terms, '')), ''),
    nullif(btrim(coalesce(p_delivery_terms, '')), ''),
    nullif(btrim(coalesce(p_note, '')), '')
  ) returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_position := v_position + 1;
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_unit_price := (v_item ->> 'unitPrice')::numeric;
    if v_quantity is null or v_quantity <= 0 or v_unit_price is null or v_unit_price <= 0 then
      raise exception '采购订单商品数量或单价无效' using errcode = '22023';
    end if;
    select * into v_product from public.products product
    where product.id = (v_item ->> 'productId')::uuid
      and product.organization_id = v_actor.organization_id
      and product.status = 'active';
    if v_product.id is null then
      raise exception '采购订单包含无效产品' using errcode = '42501';
    end if;
    v_line_amount := round(v_quantity * v_unit_price, 2);
    v_total := v_total + v_line_amount;
    insert into public.purchase_order_items (
      organization_id, purchase_order_id, product_id, product_code,
      product_name, specification, quantity, unit, unit_price, line_amount, position
    ) values (
      v_actor.organization_id, v_order_id, v_product.id, v_product.code,
      v_product.name, v_product.specification, v_quantity, '件', v_unit_price,
      v_line_amount, v_position
    );
  end loop;
  update public.purchase_orders set total_amount = v_total where id = v_order_id;
  if p_purchase_request_id is not null then
    update public.purchase_requests set status = 'converted'
    where id = p_purchase_request_id;
  end if;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'purchase_order_created', 'purchase_order',
    v_order_id, '创建采购订单 ' || v_order_no,
    jsonb_build_object('total_amount', v_total, 'supplier_id', p_supplier_id)
  );
  return jsonb_build_object('id', v_order_id, 'orderNo', v_order_no);
end;
$function$;

create or replace function public.transition_purchase_order(
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
  v_order public.purchase_orders%rowtype;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_suppliers() then
    raise exception '当前账号无权操作采购订单' using errcode = '42501';
  end if;
  select * into v_order from public.purchase_orders
  where id = p_order_id and organization_id = v_actor.organization_id for update;
  if v_order.id is null then
    raise exception '采购订单不存在' using errcode = '42501';
  end if;
  if not (
    (v_order.status = 'draft' and p_target_status in ('confirmed', 'cancelled'))
    or (v_order.status = 'confirmed' and p_target_status = 'cancelled')
  ) then
    raise exception '采购订单状态流转无效' using errcode = '23514';
  end if;
  if p_target_status = 'cancelled' and char_length(btrim(coalesce(p_note, ''))) < 2 then
    raise exception '取消采购订单必须填写原因' using errcode = '22023';
  end if;
  update public.purchase_orders set
    status = p_target_status,
    confirmed_at = case when p_target_status = 'confirmed' then now() else confirmed_at end,
    note = case when p_target_status = 'cancelled' then btrim(p_note) else note end
  where id = v_order.id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'purchase_order_' || p_target_status,
    'purchase_order', v_order.id,
    '采购订单 ' || v_order.order_no || ' 更新为 ' || p_target_status,
    jsonb_build_object('from', v_order.status, 'to', p_target_status, 'note', p_note)
  );
end;
$function$;

create or replace function public.receive_purchase_order(
  p_order_id uuid,
  p_received_on date,
  p_supplier_delivery_no text,
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
  v_order public.purchase_orders%rowtype;
  v_supplier public.suppliers%rowtype;
  v_receipt_id uuid;
  v_receipt_no text;
  v_document_no text;
  v_document_id uuid;
  v_item jsonb;
  v_order_item public.purchase_order_items%rowtype;
  v_product public.products%rowtype;
  v_inventory_item public.inventory_items%rowtype;
  v_quantity numeric(14, 3);
  v_production_date date;
  v_shelf_life_months integer;
  v_expiry_date date;
  v_batch_id uuid;
  v_movement_id uuid;
  v_movement_no text;
  v_lot_key text;
  v_line_amount numeric(14, 2);
  v_total numeric(14, 2) := 0;
  v_all_received boolean;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_inventory() then
    raise exception '只有仓储人员或管理员可以办理到货入库' using errcode = '42501';
  end if;
  if p_received_on is null
    or jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array'
    or jsonb_array_length(coalesce(p_items, '[]'::jsonb)) < 1
    or jsonb_array_length(p_items) > 100
  then
    raise exception '到货入库参数无效' using errcode = '22023';
  end if;
  select * into v_order from public.purchase_orders
  where id = p_order_id and organization_id = v_actor.organization_id for update;
  if v_order.id is null or v_order.status not in ('confirmed', 'partial_received') then
    raise exception '采购订单不存在或当前不可入库' using errcode = '23514';
  end if;
  select * into v_supplier from public.suppliers where id = v_order.supplier_id;
  v_receipt_no := 'DXGR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.goods_receipts (
    organization_id, receipt_no, purchase_order_id, supplier_id, warehouse_id,
    supplier_delivery_no, received_on, received_by_employee_id, note
  ) values (
    v_actor.organization_id, v_receipt_no, v_order.id, v_order.supplier_id,
    v_order.warehouse_id, nullif(btrim(coalesce(p_supplier_delivery_no, '')), ''),
    p_received_on, v_actor.id, nullif(btrim(coalesce(p_note, '')), '')
  ) returning id into v_receipt_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := (v_item ->> 'quantity')::numeric;
    v_production_date := nullif(v_item ->> 'productionDate', '')::date;
    v_shelf_life_months := nullif(v_item ->> 'shelfLifeMonths', '')::integer;
    if v_quantity is null or v_quantity <= 0
      or (v_shelf_life_months is not null and v_shelf_life_months <= 0)
    then
      raise exception '到货商品数量或效期参数无效' using errcode = '22023';
    end if;
    select * into v_order_item from public.purchase_order_items item
    where item.id = (v_item ->> 'purchaseOrderItemId')::uuid
      and item.purchase_order_id = v_order.id
      and item.organization_id = v_actor.organization_id
    for update;
    if v_order_item.id is null
      or v_order_item.received_quantity + v_quantity > v_order_item.quantity
    then
      raise exception '到货数量超过采购订单未收数量' using errcode = '23514';
    end if;
    select * into v_product from public.products where id = v_order_item.product_id;
    select * into v_inventory_item from public.inventory_items item
    where item.warehouse_id = v_order.warehouse_id
      and (
        item.product_id = v_order_item.product_id
        or (item.product_id is null and item.sku = v_product.code)
      )
      and item.organization_id = v_actor.organization_id
      and item.status = 'active'
    order by (item.product_id = v_order_item.product_id) desc
    limit 1
    for update;
    if v_inventory_item.id is null then
      insert into public.inventory_items (
        organization_id, warehouse_id, product_id, sku, product_name,
        specification, unit, category, barcode, case_specification,
        quantity, available_quantity, reserved_quantity, quarantined_quantity,
        safety_stock, status
      ) values (
        v_actor.organization_id, v_order.warehouse_id, v_product.id,
        v_product.code, v_product.name, v_product.specification, '件',
        v_product.category, v_product.barcode, v_product.case_specification,
        0, 0, 0, 0, 0, 'active'
      ) returning * into v_inventory_item;
    elsif v_inventory_item.product_id is null then
      update public.inventory_items
      set product_id = v_product.id
      where id = v_inventory_item.id
      returning * into v_inventory_item;
    end if;
    v_expiry_date := case
      when v_production_date is not null and v_shelf_life_months is not null
        then (v_production_date + make_interval(months => v_shelf_life_months))::date
      else null
    end;
    v_lot_key := 'purchase:' || v_receipt_no || ':' || v_order_item.id::text;
    insert into public.inventory_batches (
      organization_id, warehouse_id, inventory_item_id, lot_key,
      production_date, shelf_life_months, expiry_date, quantity, status, note
    ) values (
      v_actor.organization_id, v_order.warehouse_id, v_inventory_item.id,
      v_lot_key, v_production_date, v_shelf_life_months, v_expiry_date,
      v_quantity, 'available', '采购入库 ' || v_receipt_no
    ) returning id into v_batch_id;
    update public.inventory_items set
      quantity = quantity + v_quantity,
      available_quantity = available_quantity + v_quantity
    where id = v_inventory_item.id;
    v_movement_no := 'DXW-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    insert into public.inventory_movements (
      organization_id, warehouse_id, inventory_item_id, inventory_batch_id,
      movement_no, movement_type, quantity, before_quantity, after_quantity,
      reference_no, note, created_by_employee_id
    ) values (
      v_actor.organization_id, v_order.warehouse_id, v_inventory_item.id,
      v_batch_id, v_movement_no, 'inbound', v_quantity,
      v_inventory_item.quantity, v_inventory_item.quantity + v_quantity,
      v_receipt_no, '采购到货入库', v_actor.id
    ) returning id into v_movement_id;
    v_line_amount := round(v_quantity * v_order_item.unit_price, 2);
    v_total := v_total + v_line_amount;
    insert into public.goods_receipt_items (
      organization_id, goods_receipt_id, purchase_order_item_id, product_id,
      inventory_item_id, inventory_batch_id, inventory_movement_id, quantity,
      unit_cost, line_amount, production_date, shelf_life_months, expiry_date
    ) values (
      v_actor.organization_id, v_receipt_id, v_order_item.id,
      v_order_item.product_id, v_inventory_item.id, v_batch_id, v_movement_id,
      v_quantity, v_order_item.unit_price, v_line_amount, v_production_date,
      v_shelf_life_months, v_expiry_date
    );
    update public.purchase_order_items set
      received_quantity = received_quantity + v_quantity
    where id = v_order_item.id;
  end loop;
  update public.goods_receipts set total_amount = v_total where id = v_receipt_id;
  select bool_and(item.received_quantity = item.quantity) into v_all_received
  from public.purchase_order_items item where item.purchase_order_id = v_order.id;
  update public.purchase_orders set
    status = case when v_all_received then 'received' else 'partial_received' end
  where id = v_order.id;

  v_document_no := 'DXP-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.finance_documents (
    organization_id, document_no, document_type, customer_id, legal_entity_id,
    supplier_id, purchase_order_id, goods_receipt_id, counterparty_name,
    source_type, source_no, issue_date, due_date, total_amount, summary,
    note, created_by_employee_id
  ) values (
    v_actor.organization_id, v_document_no, 'payable', null, null,
    v_order.supplier_id, v_order.id, v_receipt_id, v_supplier.name,
    'purchase', v_receipt_no, p_received_on, p_received_on + 30,
    v_total, '采购到货应付 ' || v_receipt_no,
    coalesce(v_order.payment_terms, '默认到货后 30 天'), v_actor.id
  ) returning id into v_document_id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'purchase_goods_received',
    'goods_receipt', v_receipt_id, '采购入库 ' || v_receipt_no,
    jsonb_build_object(
      'purchase_order_no', v_order.order_no,
      'payable_document_no', v_document_no,
      'amount', v_total
    )
  );
  return jsonb_build_object(
    'receiptId', v_receipt_id,
    'receiptNo', v_receipt_no,
    'payableDocumentId', v_document_id,
    'payableDocumentNo', v_document_no,
    'amount', v_total
  );
end;
$function$;

create or replace function public.register_bank_statement_line(
  p_bank_account_name text,
  p_transaction_date date,
  p_direction text,
  p_counterparty_name text,
  p_summary text,
  p_bank_reference text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_id uuid;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以登记银行流水' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_bank_account_name, ''))) < 2
    or p_transaction_date is null
    or p_direction not in ('inflow', 'outflow')
    or p_amount is null or p_amount <= 0 or p_amount > 100000000
  then
    raise exception '银行流水参数无效' using errcode = '22023';
  end if;
  insert into public.bank_statement_lines (
    organization_id, bank_account_name, transaction_date, direction,
    counterparty_name, summary, bank_reference, amount, imported_by_employee_id
  ) values (
    v_actor.organization_id, btrim(p_bank_account_name), p_transaction_date,
    p_direction, nullif(btrim(coalesce(p_counterparty_name, '')), ''),
    nullif(btrim(coalesce(p_summary, '')), ''),
    nullif(btrim(coalesce(p_bank_reference, '')), ''), p_amount, v_actor.id
  ) returning id into v_id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'bank_statement_line_registered',
    'bank_statement_line', v_id, '登记银行流水',
    jsonb_build_object('direction', p_direction, 'amount', p_amount)
  );
  return jsonb_build_object('id', v_id);
end;
$function$;

create or replace function public.reconcile_bank_statement_line(
  p_bank_statement_line_id uuid,
  p_finance_document_id uuid,
  p_amount numeric,
  p_reconciled_on date,
  p_debit_account text,
  p_credit_account text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_line public.bank_statement_lines%rowtype;
  v_document public.finance_documents%rowtype;
  v_bank_remaining numeric(14, 2);
  v_document_remaining numeric(14, 2);
  v_settlement_type text;
  v_transaction_type text;
  v_settlement_no text;
  v_transaction_no text;
  v_voucher_no text;
  v_transaction_id uuid;
  v_voucher_id uuid;
  v_settlement_id uuid;
  v_reconciliation_id uuid;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以执行银行核销' using errcode = '42501';
  end if;
  select * into v_line from public.bank_statement_lines
  where id = p_bank_statement_line_id
    and organization_id = v_actor.organization_id for update;
  select * into v_document from public.finance_documents
  where id = p_finance_document_id
    and organization_id = v_actor.organization_id for update;
  if v_line.id is null or v_line.status in ('matched', 'ignored')
    or v_document.id is null or v_document.status in ('settled', 'void')
  then
    raise exception '银行流水或往来单据当前不可核销' using errcode = '23514';
  end if;
  if (v_document.document_type = 'payable' and v_line.direction <> 'outflow')
    or (v_document.document_type = 'receivable' and v_line.direction <> 'inflow')
  then
    raise exception '银行流水方向与应收应付类型不匹配' using errcode = '23514';
  end if;
  v_bank_remaining := v_line.amount - v_line.reconciled_amount;
  v_document_remaining := v_document.total_amount - v_document.settled_amount;
  if p_amount is null or p_amount <= 0
    or p_amount > v_bank_remaining or p_amount > v_document_remaining
    or p_reconciled_on is null
    or char_length(btrim(coalesce(p_debit_account, ''))) < 2
    or char_length(btrim(coalesce(p_credit_account, ''))) < 2
  then
    raise exception '核销金额或会计科目无效' using errcode = '22023';
  end if;
  v_settlement_type := case when v_document.document_type = 'receivable' then 'receipt' else 'payment' end;
  v_transaction_type := case when v_document.document_type = 'receivable' then 'income' else 'expense' end;
  v_settlement_no := 'DXS-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_transaction_no := 'DXF-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_voucher_no := 'DXV-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  insert into public.finance_transactions (
    organization_id, transaction_no, transaction_type, category, counterparty,
    amount, occurred_on, payment_channel, account_name, voucher_no, status,
    note, created_by_employee_id
  ) values (
    v_actor.organization_id, v_transaction_no, v_transaction_type,
    case when v_transaction_type = 'income' then '银行收款核销' else '银行付款核销' end,
    v_document.counterparty_name, p_amount, p_reconciled_on, 'bank',
    v_line.bank_account_name, v_voucher_no, 'confirmed',
    '银行流水核销 ' || v_document.document_no, v_actor.id
  ) returning id into v_transaction_id;
  insert into public.finance_vouchers (
    organization_id, voucher_no, voucher_date, voucher_type, summary,
    debit_account, credit_account, amount, attachment_count, status,
    created_by_employee_id
  ) values (
    v_actor.organization_id, v_voucher_no, p_reconciled_on, v_settlement_type,
    case when v_settlement_type = 'receipt' then '收到' else '支付' end
      || v_document.counterparty_name || '往来款',
    btrim(p_debit_account), btrim(p_credit_account), p_amount, 0, 'posted', v_actor.id
  ) returning id into v_voucher_id;
  insert into public.finance_settlements (
    organization_id, settlement_no, document_id, transaction_id, voucher_id,
    bank_statement_line_id, settlement_type, amount, settled_on,
    payment_channel, account_name, note, created_by_employee_id
  ) values (
    v_actor.organization_id, v_settlement_no, v_document.id, v_transaction_id,
    v_voucher_id, v_line.id, v_settlement_type, p_amount, p_reconciled_on,
    'bank', v_line.bank_account_name,
    nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
  ) returning id into v_settlement_id;
  insert into public.bank_reconciliations (
    organization_id, bank_statement_line_id, finance_document_id,
    finance_settlement_id, amount, reconciled_on, reconciled_by_employee_id, note
  ) values (
    v_actor.organization_id, v_line.id, v_document.id, v_settlement_id,
    p_amount, p_reconciled_on, v_actor.id,
    nullif(btrim(coalesce(p_note, '')), '')
  ) returning id into v_reconciliation_id;
  update public.finance_documents set
    settled_amount = settled_amount + p_amount,
    status = case when settled_amount + p_amount = total_amount then 'settled' else 'partial' end
  where id = v_document.id;
  update public.bank_statement_lines set
    reconciled_amount = reconciled_amount + p_amount,
    status = case when reconciled_amount + p_amount = amount then 'matched' else 'partial' end
  where id = v_line.id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'bank_statement_reconciled',
    'bank_reconciliation', v_reconciliation_id,
    '银行流水核销 ' || v_document.document_no,
    jsonb_build_object(
      'amount', p_amount,
      'settlement_no', v_settlement_no,
      'voucher_no', v_voucher_no
    )
  );
  return jsonb_build_object(
    'reconciliationId', v_reconciliation_id,
    'settlementNo', v_settlement_no,
    'voucherNo', v_voucher_no,
    'documentRemaining', v_document_remaining - p_amount,
    'bankRemaining', v_bank_remaining - p_amount
  );
end;
$function$;

revoke all on function public.create_purchase_request(text, text, date, jsonb) from public, anon;
grant execute on function public.create_purchase_request(text, text, date, jsonb) to authenticated;
revoke all on function public.transition_purchase_request(uuid, text, text) from public, anon;
grant execute on function public.transition_purchase_request(uuid, text, text) to authenticated;
revoke all on function public.create_purchase_order(uuid, uuid, uuid, date, date, text, text, text, jsonb) from public, anon;
grant execute on function public.create_purchase_order(uuid, uuid, uuid, date, date, text, text, text, jsonb) to authenticated;
revoke all on function public.transition_purchase_order(uuid, text, text) from public, anon;
grant execute on function public.transition_purchase_order(uuid, text, text) to authenticated;
revoke all on function public.receive_purchase_order(uuid, date, text, text, jsonb) from public, anon;
grant execute on function public.receive_purchase_order(uuid, date, text, text, jsonb) to authenticated;
revoke all on function public.register_bank_statement_line(text, date, text, text, text, text, numeric) from public, anon;
grant execute on function public.register_bank_statement_line(text, date, text, text, text, text, numeric) to authenticated;
revoke all on function public.reconcile_bank_statement_line(uuid, uuid, numeric, date, text, text, text) from public, anon;
grant execute on function public.reconcile_bank_statement_line(uuid, uuid, numeric, date, text, text, text) to authenticated;

comment on table public.purchase_requests is '内部采购需求及审批结果。';
comment on table public.purchase_orders is '连接供应商、采购价、收货仓和履约状态的采购订单。';
comment on table public.goods_receipts is '按实际到货登记的入库单；过账后同步批次库存和采购应付。';
comment on table public.bank_statement_lines is '银行流水导入或手工登记台账，按可核销余额追踪匹配状态。';

commit;
