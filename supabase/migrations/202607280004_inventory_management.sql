create table if not exists public.warehouses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  address text,
  manager_employee_id uuid references public.employees(id),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  sku text not null,
  product_name text not null,
  specification text,
  unit text not null default '件',
  location_code text,
  quantity numeric(14, 3) not null default 0 check (quantity >= 0),
  safety_stock numeric(14, 3) not null default 0 check (safety_stock >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, sku)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  inventory_item_id uuid not null references public.inventory_items(id),
  movement_no text not null,
  movement_type text not null check (movement_type in ('inbound', 'outbound')),
  quantity numeric(14, 3) not null check (quantity > 0),
  before_quantity numeric(14, 3) not null,
  after_quantity numeric(14, 3) not null check (after_quantity >= 0),
  reference_no text,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  unique (organization_id, movement_no)
);

create index if not exists warehouses_org_status_idx
  on public.warehouses (organization_id, status);

create index if not exists inventory_items_org_status_idx
  on public.inventory_items (organization_id, status);

create index if not exists inventory_items_warning_idx
  on public.inventory_items (organization_id, quantity, safety_stock)
  where status = 'active';

create index if not exists inventory_movements_org_created_idx
  on public.inventory_movements (organization_id, created_at desc);

drop trigger if exists set_warehouses_updated_at on public.warehouses;
create trigger set_warehouses_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();

drop trigger if exists set_inventory_items_updated_at on public.inventory_items;
create trigger set_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create or replace function public.can_manage_inventory()
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
        d.code = 'DX-WH'
        or public.has_org_role('admin')
      )
  )
$function$;

create or replace function public.record_inventory_movement(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reference_no text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_item public.inventory_items%rowtype;
  v_after numeric(14, 3);
  v_movement_no text;
  v_movement_id uuid;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_inventory() then
    raise exception '只有仓储人员或系统管理员可以执行出入库'
      using errcode = '42501';
  end if;

  if p_movement_type not in ('inbound', 'outbound') then
    raise exception '出入库类型无效'
      using errcode = '22023';
  end if;

  if p_quantity is null or p_quantity <= 0 then
    raise exception '出入库数量必须大于零'
      using errcode = '22023';
  end if;

  select *
  into v_item
  from public.inventory_items
  where id = p_inventory_item_id
    and organization_id = v_actor.organization_id
    and status = 'active'
  for update;

  if v_item.id is null then
    raise exception '库存商品不存在或已停用'
      using errcode = '42501';
  end if;

  if p_movement_type = 'inbound' then
    v_after := v_item.quantity + p_quantity;
  else
    v_after := v_item.quantity - p_quantity;
    if v_after < 0 then
      raise exception '出库数量超过当前可用库存'
        using errcode = '23514';
    end if;
  end if;

  v_movement_no := 'DXW-'
    || to_char(clock_timestamp(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  update public.inventory_items
  set quantity = v_after
  where id = v_item.id;

  insert into public.inventory_movements (
    organization_id,
    warehouse_id,
    inventory_item_id,
    movement_no,
    movement_type,
    quantity,
    before_quantity,
    after_quantity,
    reference_no,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_item.warehouse_id,
    v_item.id,
    v_movement_no,
    p_movement_type,
    p_quantity,
    v_item.quantity,
    v_after,
    nullif(btrim(coalesce(p_reference_no, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  )
  returning id into v_movement_id;

  return jsonb_build_object(
    'id', v_movement_id,
    'movementNo', v_movement_no,
    'beforeQuantity', v_item.quantity,
    'afterQuantity', v_after
  );
end;
$function$;

alter table public.warehouses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists "warehouses visible to active employees" on public.warehouses;
create policy "warehouses visible to active employees"
on public.warehouses for select
using (
  organization_id = public.current_organization_id()
  and public.current_employee_id() is not null
);

drop policy if exists "warehouses manageable by inventory operators" on public.warehouses;
create policy "warehouses manageable by inventory operators"
on public.warehouses for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
);

drop policy if exists "inventory visible to active employees" on public.inventory_items;
create policy "inventory visible to active employees"
on public.inventory_items for select
using (
  organization_id = public.current_organization_id()
  and public.current_employee_id() is not null
);

drop policy if exists "inventory manageable by inventory operators" on public.inventory_items;
create policy "inventory manageable by inventory operators"
on public.inventory_items for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
);

drop policy if exists "movements visible to authorized operators" on public.inventory_movements;
create policy "movements visible to authorized operators"
on public.inventory_movements for select
using (
  organization_id = public.current_organization_id()
  and (
    public.can_manage_inventory()
    or public.has_org_role('chairman')
  )
);

comment on table public.warehouses is
  '德馨星云仓储中心仓库档案。';
comment on table public.inventory_items is
  '按仓库和 SKU 维护的实时库存及安全库存。';
comment on table public.inventory_movements is
  '通过原子出入库函数生成的不可变库存流水。';

