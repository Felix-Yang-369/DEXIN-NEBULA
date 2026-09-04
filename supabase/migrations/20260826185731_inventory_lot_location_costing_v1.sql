-- Inventory V1.0: locations, lot costing, expiry policy and valuation.
begin;
create table public.warehouse_locations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 warehouse_id uuid not null references public.warehouses(id) on delete cascade,code text not null,name text not null,
 zone text,location_type text not null default 'storage' check(location_type in('receiving','storage','picking','quarantine','shipping')),
 status text not null default 'active' check(status in('active','inactive')),created_at timestamptz not null default now(),unique(warehouse_id,code)
);
create table public.inventory_policies(
 organization_id uuid primary key references public.organizations(id) on delete cascade,
 expiry_warning_days integer not null default 90 check(expiry_warning_days between 1 and 730),
 issue_strategy text not null default 'fefo' check(issue_strategy in('fifo','fefo')),
 negative_stock_allowed boolean not null default false,updated_at timestamptz not null default now()
);
alter table public.inventory_batches add column location_id uuid references public.warehouse_locations(id) on delete set null,
 add column unit_cost numeric(14,4) not null default 0 check(unit_cost>=0),add column received_at timestamptz not null default now();
update public.inventory_batches b set unit_cost=coalesce((select i.unit_cost from public.goods_receipt_items i where i.inventory_batch_id=b.id order by i.created_at desc limit 1),0);
insert into public.inventory_policies(organization_id) select id from public.organizations on conflict do nothing;
create index warehouse_locations_warehouse_idx on public.warehouse_locations(warehouse_id,status,code);
create index inventory_batches_location_status_idx on public.inventory_batches(location_id,status,expiry_date);
create index inventory_batches_valuation_idx on public.inventory_batches(organization_id,warehouse_id,unit_cost) where quantity>reserved_quantity;
alter table public.warehouse_locations enable row level security;alter table public.inventory_policies enable row level security;
create policy warehouse_locations_org_read on public.warehouse_locations for select to authenticated using(organization_id=public.current_organization_id() and public.current_employee_id() is not null);
create policy inventory_policies_org_read on public.inventory_policies for select to authenticated using(organization_id=public.current_organization_id() and public.current_employee_id() is not null);
revoke all on table public.warehouse_locations from public,anon,authenticated;revoke all on table public.inventory_policies from public,anon,authenticated;
grant select on table public.warehouse_locations to authenticated;grant select on table public.inventory_policies to authenticated;

create or replace function public.manage_warehouse_location(p_location_id uuid,p_warehouse_id uuid,p_code text,p_name text,p_zone text,p_location_type text,p_status text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_id uuid;begin
 if not public.can_manage_inventory() then raise exception '无权管理库位' using errcode='42501';end if;
 if not exists(select 1 from public.warehouses where id=p_warehouse_id and organization_id=v_org) or p_location_type not in('receiving','storage','picking','quarantine','shipping') or p_status not in('active','inactive') or char_length(btrim(p_code)) not between 1 and 30 then raise exception '库位参数无效' using errcode='22023';end if;
 if p_location_id is null then insert into public.warehouse_locations(organization_id,warehouse_id,code,name,zone,location_type,status) values(v_org,p_warehouse_id,upper(btrim(p_code)),btrim(p_name),nullif(btrim(p_zone),''),p_location_type,p_status) returning id into v_id;
 else update public.warehouse_locations set code=upper(btrim(p_code)),name=btrim(p_name),zone=nullif(btrim(p_zone),''),location_type=p_location_type,status=p_status where id=p_location_id and organization_id=v_org and warehouse_id=p_warehouse_id returning id into v_id;end if;
 if v_id is null then raise exception '库位不存在' using errcode='P0002';end if;return v_id;
end;$f$;
create or replace function public.move_inventory_batch_location(p_batch_id uuid,p_location_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_batch public.inventory_batches%rowtype;begin
 if not public.can_manage_inventory() then raise exception '无权移动批次库位' using errcode='42501';end if;
 select * into v_batch from public.inventory_batches where id=p_batch_id and organization_id=v_org for update;
 if v_batch.id is null or not exists(select 1 from public.warehouse_locations where id=p_location_id and warehouse_id=v_batch.warehouse_id and status='active') then raise exception '批次或目标库位无效' using errcode='23514';end if;
 update public.inventory_batches set location_id=p_location_id where id=p_batch_id;
end;$f$;
create or replace function public.update_inventory_policy(p_expiry_warning_days integer,p_issue_strategy text)
returns void language plpgsql security definer set search_path=public,pg_temp as $f$
begin if not public.can_manage_inventory() or p_expiry_warning_days not between 1 and 730 or p_issue_strategy not in('fifo','fefo') then raise exception '无权操作或策略无效' using errcode='42501';end if;
 insert into public.inventory_policies(organization_id,expiry_warning_days,issue_strategy) values(public.current_organization_id(),p_expiry_warning_days,p_issue_strategy) on conflict(organization_id) do update set expiry_warning_days=excluded.expiry_warning_days,issue_strategy=excluded.issue_strategy,updated_at=now();end;$f$;
create or replace function public.inventory_valuation_summary(p_warehouse_id uuid default null)
returns table(warehouse_id uuid,warehouse_name text,sku text,product_name text,available_quantity numeric,average_cost numeric,inventory_value numeric,expiring_quantity numeric)
language sql stable security definer set search_path=public,pg_temp as $f$
 select i.warehouse_id,w.name,i.sku,i.product_name,sum(greatest(b.quantity-b.reserved_quantity,0)),
  case when sum(greatest(b.quantity-b.reserved_quantity,0))=0 then 0 else round(sum(greatest(b.quantity-b.reserved_quantity,0)*b.unit_cost)/sum(greatest(b.quantity-b.reserved_quantity,0)),4) end,
  round(sum(greatest(b.quantity-b.reserved_quantity,0)*b.unit_cost),2),
  sum(greatest(b.quantity-b.reserved_quantity,0)) filter(where b.expiry_date<=current_date+coalesce((select expiry_warning_days from public.inventory_policies where organization_id=public.current_organization_id()),90))
 from public.inventory_items i join public.warehouses w on w.id=i.warehouse_id join public.inventory_batches b on b.inventory_item_id=i.id
 where i.organization_id=public.current_organization_id()
   and (public.can_view_procurement_operations() or public.has_org_role('finance') or public.has_org_role('chairman'))
   and (p_warehouse_id is null or i.warehouse_id=p_warehouse_id)
 group by i.warehouse_id,w.name,i.sku,i.product_name order by w.name,i.sku;
$f$;
revoke all on function public.manage_warehouse_location(uuid,uuid,text,text,text,text,text) from public,anon;grant execute on function public.manage_warehouse_location(uuid,uuid,text,text,text,text,text) to authenticated;
revoke all on function public.move_inventory_batch_location(uuid,uuid) from public,anon;grant execute on function public.move_inventory_batch_location(uuid,uuid) to authenticated;
revoke all on function public.update_inventory_policy(integer,text) from public,anon;grant execute on function public.update_inventory_policy(integer,text) to authenticated;
revoke all on function public.inventory_valuation_summary(uuid) from public,anon;grant execute on function public.inventory_valuation_summary(uuid) to authenticated;
commit;
