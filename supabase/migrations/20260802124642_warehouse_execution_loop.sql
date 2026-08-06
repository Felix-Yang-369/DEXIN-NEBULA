create table if not exists public.inventory_outbound_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  outbound_no text not null,
  warehouse_id uuid not null references public.warehouses(id),
  source_type text not null default 'manual' check (source_type in ('manual','sales','return_to_supplier')),
  source_no text,
  recipient_name text,
  recipient_phone text,
  delivery_address text,
  requested_on date,
  status text not null default 'draft' check (status in ('draft','completed','cancelled')),
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, outbound_no)
);

create table if not exists public.inventory_outbound_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  outbound_order_id uuid not null references public.inventory_outbound_orders(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  product_name text not null,
  sku text not null,
  quantity numeric(14,3) not null check (quantity > 0),
  issued_quantity numeric(14,3) not null default 0 check (issued_quantity >= 0),
  unit text not null,
  position integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_transfers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transfer_no text not null,
  source_warehouse_id uuid not null references public.warehouses(id),
  destination_warehouse_id uuid not null references public.warehouses(id),
  source_inventory_item_id uuid not null references public.inventory_items(id),
  destination_inventory_item_id uuid not null references public.inventory_items(id),
  quantity numeric(14,3) not null check (quantity > 0),
  status text not null default 'completed' check (status in ('completed','cancelled')),
  transferred_on date not null,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  unique (organization_id, transfer_no),
  check (source_warehouse_id <> destination_warehouse_id)
);

create table if not exists public.inventory_stocktakes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stocktake_no text not null,
  warehouse_id uuid not null references public.warehouses(id),
  counted_on date not null,
  status text not null default 'completed' check (status in ('completed','cancelled')),
  total_lines integer not null default 0 check (total_lines >= 0),
  difference_lines integer not null default 0 check (difference_lines >= 0),
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  unique (organization_id, stocktake_no)
);

create table if not exists public.inventory_stocktake_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  stocktake_id uuid not null references public.inventory_stocktakes(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id),
  system_quantity numeric(14,3) not null,
  counted_quantity numeric(14,3) not null check (counted_quantity >= 0),
  difference_quantity numeric(14,3) not null,
  movement_id uuid references public.inventory_movements(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.delivery_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  delivery_no text not null,
  outbound_order_id uuid not null references public.inventory_outbound_orders(id) on delete cascade,
  carrier_name text,
  driver_name text,
  driver_phone text,
  vehicle_no text,
  status text not null default 'planned' check (status in ('planned','dispatched','delivered','exception')),
  dispatched_at timestamptz,
  delivered_at timestamptz,
  exception_note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, delivery_no),
  unique (outbound_order_id)
);

create index if not exists inventory_outbound_orders_org_created_idx
  on public.inventory_outbound_orders (organization_id, created_at desc);
create index if not exists inventory_outbound_items_order_idx
  on public.inventory_outbound_items (outbound_order_id);
create index if not exists inventory_transfers_org_created_idx
  on public.inventory_transfers (organization_id, created_at desc);
create index if not exists inventory_stocktakes_org_created_idx
  on public.inventory_stocktakes (organization_id, created_at desc);
create index if not exists inventory_stocktake_items_stocktake_idx
  on public.inventory_stocktake_items (stocktake_id);
create index if not exists delivery_records_org_status_idx
  on public.delivery_records (organization_id, status, created_at desc);

create trigger set_inventory_outbound_orders_updated_at before update on public.inventory_outbound_orders
for each row execute function public.set_updated_at();
create trigger set_delivery_records_updated_at before update on public.delivery_records
for each row execute function public.set_updated_at();

alter table public.inventory_outbound_orders enable row level security;
alter table public.inventory_outbound_items enable row level security;
alter table public.inventory_transfers enable row level security;
alter table public.inventory_stocktakes enable row level security;
alter table public.inventory_stocktake_items enable row level security;
alter table public.delivery_records enable row level security;

do $policies$
declare t text;
begin
  foreach t in array array[
    'inventory_outbound_orders','inventory_outbound_items','inventory_transfers',
    'inventory_stocktakes','inventory_stocktake_items','delivery_records'
  ] loop
    execute format('create policy %I on public.%I for select to authenticated using (organization_id = public.current_organization_id() and public.current_employee_id() is not null)',
      t || '_org_read', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end
$policies$;

create or replace function public.create_inventory_outbound(
  p_warehouse_id uuid, p_source_type text, p_source_no text, p_requested_on date,
  p_recipient_name text, p_recipient_phone text, p_delivery_address text,
  p_note text, p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $f$
declare
  v_actor public.employees%rowtype; v_no text; v_id uuid; v_item jsonb;
  v_stock public.inventory_items%rowtype; v_position int := 0;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_inventory() then raise exception '只有仓储人员或管理员可以创建出库单' using errcode='42501'; end if;
  if p_source_type not in ('manual','sales','return_to_supplier') or jsonb_typeof(coalesce(p_items,'[]')) <> 'array'
    or jsonb_array_length(coalesce(p_items,'[]')) < 1 then raise exception '出库单参数无效' using errcode='22023'; end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and organization_id=v_actor.organization_id and status='active')
    then raise exception '出库仓库无效' using errcode='42501'; end if;
  v_no := 'DXOB-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.inventory_outbound_orders(
    organization_id,outbound_no,warehouse_id,source_type,source_no,requested_on,
    recipient_name,recipient_phone,delivery_address,note,created_by_employee_id
  ) values(v_actor.organization_id,v_no,p_warehouse_id,p_source_type,nullif(btrim(coalesce(p_source_no,'')),''),
    p_requested_on,nullif(btrim(coalesce(p_recipient_name,'')),''),nullif(btrim(coalesce(p_recipient_phone,'')),''),
    nullif(btrim(coalesce(p_delivery_address,'')),''),nullif(btrim(coalesce(p_note,'')),''),v_actor.id) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_position := v_position+1;
    select * into v_stock from public.inventory_items where id=(v_item->>'inventoryItemId')::uuid
      and warehouse_id=p_warehouse_id and organization_id=v_actor.organization_id and status='active';
    if v_stock.id is null or (v_item->>'quantity')::numeric <= 0 or v_stock.available_quantity < (v_item->>'quantity')::numeric
      then raise exception '出库商品无效或可用库存不足' using errcode='23514'; end if;
    insert into public.inventory_outbound_items(
      organization_id,outbound_order_id,inventory_item_id,product_name,sku,quantity,unit,position
    ) values(v_actor.organization_id,v_id,v_stock.id,v_stock.product_name,v_stock.sku,(v_item->>'quantity')::numeric,v_stock.unit,v_position);
  end loop;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'inventory_outbound_created','inventory_outbound',v_id,'创建出库单 '||v_no);
  return jsonb_build_object('id',v_id,'outboundNo',v_no);
end $f$;

create or replace function public.complete_inventory_outbound(p_outbound_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $f$
declare
  v_actor public.employees%rowtype; v_order public.inventory_outbound_orders%rowtype;
  v_line record; v_result jsonb; v_delivery_no text; v_delivery_id uuid;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_inventory() then raise exception '当前账号无权办理出库' using errcode='42501'; end if;
  select * into v_order from public.inventory_outbound_orders where id=p_outbound_id and organization_id=v_actor.organization_id for update;
  if v_order.id is null or v_order.status <> 'draft' then raise exception '出库单当前不可执行' using errcode='23514'; end if;
  for v_line in select * from public.inventory_outbound_items where outbound_order_id=v_order.id order by position for update loop
    v_result := public.record_inventory_movement(v_line.inventory_item_id,'outbound',v_line.quantity,v_order.outbound_no,'出库单执行',null,null);
    update public.inventory_outbound_items set issued_quantity=v_line.quantity where id=v_line.id;
  end loop;
  update public.inventory_outbound_orders set status='completed',completed_at=now() where id=v_order.id;
  v_delivery_no := 'DXDL-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.delivery_records(organization_id,delivery_no,outbound_order_id,created_by_employee_id)
  values(v_actor.organization_id,v_delivery_no,v_order.id,v_actor.id) returning id into v_delivery_id;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'inventory_outbound_completed','inventory_outbound',v_order.id,'完成出库 '||v_order.outbound_no);
  return jsonb_build_object('outboundNo',v_order.outbound_no,'deliveryId',v_delivery_id,'deliveryNo',v_delivery_no);
end $f$;

create or replace function public.execute_inventory_transfer(
  p_source_item_id uuid, p_destination_warehouse_id uuid, p_quantity numeric,
  p_transferred_on date, p_note text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $f$
declare
  v_actor public.employees%rowtype; v_source public.inventory_items%rowtype;
  v_destination public.inventory_items%rowtype; v_no text; v_id uuid;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_inventory() then raise exception '当前账号无权办理调拨' using errcode='42501'; end if;
  if p_quantity is null or p_quantity<=0 or p_transferred_on is null then raise exception '调拨参数无效' using errcode='22023'; end if;
  select * into v_source from public.inventory_items where id=p_source_item_id and organization_id=v_actor.organization_id and status='active' for update;
  if v_source.id is null or v_source.available_quantity<p_quantity or v_source.warehouse_id=p_destination_warehouse_id
    then raise exception '调拨库存或目标仓库无效' using errcode='23514'; end if;
  if not exists(select 1 from public.warehouses where id=p_destination_warehouse_id and organization_id=v_actor.organization_id and status='active')
    then raise exception '目标仓库无效' using errcode='42501'; end if;
  select * into v_destination from public.inventory_items where warehouse_id=p_destination_warehouse_id
    and organization_id=v_actor.organization_id and (product_id=v_source.product_id or (product_id is null and sku=v_source.sku)) and status='active' limit 1 for update;
  if v_destination.id is null then
    insert into public.inventory_items(organization_id,warehouse_id,product_id,sku,product_name,specification,unit,category,barcode,case_specification,
      quantity,available_quantity,reserved_quantity,quarantined_quantity,safety_stock,status)
    values(v_actor.organization_id,p_destination_warehouse_id,v_source.product_id,v_source.sku,v_source.product_name,v_source.specification,
      v_source.unit,v_source.category,v_source.barcode,v_source.case_specification,0,0,0,0,v_source.safety_stock,'active') returning * into v_destination;
  end if;
  v_no := 'DXTR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  perform public.record_inventory_movement(v_source.id,'outbound',p_quantity,v_no,'调拨出库',null,null);
  perform public.record_inventory_movement(v_destination.id,'inbound',p_quantity,v_no,'调拨入库',null,null);
  insert into public.inventory_transfers(organization_id,transfer_no,source_warehouse_id,destination_warehouse_id,
    source_inventory_item_id,destination_inventory_item_id,quantity,transferred_on,note,created_by_employee_id)
  values(v_actor.organization_id,v_no,v_source.warehouse_id,p_destination_warehouse_id,v_source.id,v_destination.id,p_quantity,p_transferred_on,
    nullif(btrim(coalesce(p_note,'')),''),v_actor.id) returning id into v_id;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'inventory_transfer_completed','inventory_transfer',v_id,'完成调拨 '||v_no);
  return jsonb_build_object('id',v_id,'transferNo',v_no);
end $f$;

create or replace function public.complete_inventory_stocktake(
  p_warehouse_id uuid, p_counted_on date, p_note text, p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $f$
declare
  v_actor public.employees%rowtype; v_no text; v_id uuid; v_item jsonb;
  v_stock public.inventory_items%rowtype; v_counted numeric; v_diff numeric; v_result jsonb;
  v_lines int:=0; v_differences int:=0;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_inventory() then raise exception '当前账号无权办理盘点' using errcode='42501'; end if;
  if p_counted_on is null or jsonb_typeof(coalesce(p_items,'[]'))<>'array' or jsonb_array_length(coalesce(p_items,'[]'))<1
    then raise exception '盘点参数无效' using errcode='22023'; end if;
  v_no := 'DXST-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.inventory_stocktakes(organization_id,stocktake_no,warehouse_id,counted_on,note,created_by_employee_id)
  values(v_actor.organization_id,v_no,p_warehouse_id,p_counted_on,nullif(btrim(coalesce(p_note,'')),''),v_actor.id) returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_items) loop
    select * into v_stock from public.inventory_items where id=(v_item->>'inventoryItemId')::uuid and warehouse_id=p_warehouse_id
      and organization_id=v_actor.organization_id and status='active' for update;
    v_counted := (v_item->>'countedQuantity')::numeric;
    if v_stock.id is null or v_counted<0 then raise exception '盘点商品或实盘数量无效' using errcode='22023'; end if;
    v_lines:=v_lines+1; v_diff:=v_counted-v_stock.quantity; v_result:=null;
    if v_diff>0 then
      v_differences:=v_differences+1;
      v_result:=public.record_inventory_movement(v_stock.id,'inbound',v_diff,v_no,'盘盈调整',null,null);
      update public.inventory_movements set movement_type='adjustment_in' where id=(v_result->>'id')::uuid;
    elsif v_diff<0 then
      if v_stock.available_quantity < abs(v_diff) then raise exception '盘亏数量超过可用库存，请先处理预留或隔离库存' using errcode='23514'; end if;
      v_differences:=v_differences+1;
      v_result:=public.record_inventory_movement(v_stock.id,'outbound',abs(v_diff),v_no,'盘亏调整',null,null);
      update public.inventory_movements set movement_type='adjustment_out' where id=(v_result->>'id')::uuid;
    end if;
    insert into public.inventory_stocktake_items(organization_id,stocktake_id,inventory_item_id,system_quantity,counted_quantity,difference_quantity,movement_id)
    values(v_actor.organization_id,v_id,v_stock.id,v_stock.quantity,v_counted,v_diff,nullif(v_result->>'id','')::uuid);
  end loop;
  update public.inventory_stocktakes set total_lines=v_lines,difference_lines=v_differences where id=v_id;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'inventory_stocktake_completed','inventory_stocktake',v_id,'完成盘点 '||v_no);
  return jsonb_build_object('id',v_id,'stocktakeNo',v_no,'differenceLines',v_differences);
end $f$;

create or replace function public.update_delivery_record(
  p_delivery_id uuid,p_status text,p_carrier_name text,p_driver_name text,p_driver_phone text,p_vehicle_no text,p_exception_note text
) returns void language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_actor public.employees%rowtype; v_delivery public.delivery_records%rowtype;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_inventory() then raise exception '当前账号无权更新配送' using errcode='42501'; end if;
  select * into v_delivery from public.delivery_records where id=p_delivery_id and organization_id=v_actor.organization_id for update;
  if v_delivery.id is null or p_status not in ('planned','dispatched','delivered','exception')
    then raise exception '配送记录参数无效' using errcode='22023'; end if;
  if p_status='exception' and char_length(btrim(coalesce(p_exception_note,'')))<2
    then raise exception '配送异常必须填写说明' using errcode='22023'; end if;
  update public.delivery_records set status=p_status,carrier_name=nullif(btrim(coalesce(p_carrier_name,'')),''),
    driver_name=nullif(btrim(coalesce(p_driver_name,'')),''),driver_phone=nullif(btrim(coalesce(p_driver_phone,'')),''),
    vehicle_no=nullif(btrim(coalesce(p_vehicle_no,'')),''),exception_note=nullif(btrim(coalesce(p_exception_note,'')),''),
    dispatched_at=case when p_status='dispatched' then coalesce(dispatched_at,now()) else dispatched_at end,
    delivered_at=case when p_status='delivered' then coalesce(delivered_at,now()) else delivered_at end where id=v_delivery.id;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'delivery_'||p_status,'delivery_record',v_delivery.id,'配送单 '||v_delivery.delivery_no||' 更新为 '||p_status);
end $f$;

revoke all on function public.create_inventory_outbound(uuid,text,text,date,text,text,text,text,jsonb) from public,anon;
grant execute on function public.create_inventory_outbound(uuid,text,text,date,text,text,text,text,jsonb) to authenticated;
revoke all on function public.complete_inventory_outbound(uuid) from public,anon;
grant execute on function public.complete_inventory_outbound(uuid) to authenticated;
revoke all on function public.execute_inventory_transfer(uuid,uuid,numeric,date,text) from public,anon;
grant execute on function public.execute_inventory_transfer(uuid,uuid,numeric,date,text) to authenticated;
revoke all on function public.complete_inventory_stocktake(uuid,date,text,jsonb) from public,anon;
grant execute on function public.complete_inventory_stocktake(uuid,date,text,jsonb) to authenticated;
revoke all on function public.update_delivery_record(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.update_delivery_record(uuid,text,text,text,text,text,text) to authenticated;
