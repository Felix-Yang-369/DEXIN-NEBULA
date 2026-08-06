begin;

alter table public.warehouses
  add column if not exists warehouse_type text not null default 'owned',
  add column if not exists partner_name text;

alter table public.warehouses
  drop constraint if exists warehouses_warehouse_type_check;
alter table public.warehouses
  add constraint warehouses_warehouse_type_check
  check (warehouse_type in ('owned', 'third_party', 'virtual'));

alter table public.inventory_items
  add column if not exists category text not null default 'unknown',
  add column if not exists barcode text,
  add column if not exists case_specification text,
  add column if not exists source_item_key text,
  add column if not exists available_quantity numeric(14, 3) not null default 0,
  add column if not exists reserved_quantity numeric(14, 3) not null default 0,
  add column if not exists quarantined_quantity numeric(14, 3) not null default 0,
  add column if not exists last_imported_at timestamptz;

alter table public.inventory_items
  drop constraint if exists inventory_items_category_check,
  drop constraint if exists inventory_items_available_quantity_check,
  drop constraint if exists inventory_items_reserved_quantity_check,
  drop constraint if exists inventory_items_quarantined_quantity_check,
  drop constraint if exists inventory_items_quantity_balance_check;

alter table public.inventory_items
  add constraint inventory_items_category_check
    check (category in ('rice', 'oil', 'gift', 'other', 'unknown')),
  add constraint inventory_items_available_quantity_check
    check (available_quantity >= 0),
  add constraint inventory_items_reserved_quantity_check
    check (reserved_quantity >= 0),
  add constraint inventory_items_quarantined_quantity_check
    check (quarantined_quantity >= 0),
  add constraint inventory_items_quantity_balance_check
    check (
      available_quantity + reserved_quantity + quarantined_quantity <= quantity
    );

update public.inventory_items
set available_quantity = quantity
where quantity > 0
  and available_quantity = 0
  and reserved_quantity = 0
  and quarantined_quantity = 0;

create unique index if not exists inventory_items_source_key_idx
  on public.inventory_items (warehouse_id, source_item_key)
  where source_item_key is not null;

create table if not exists public.inventory_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  source_system text not null,
  source_file_name text not null,
  source_sheet_name text,
  source_fingerprint text not null,
  total_rows integer not null default 0 check (total_rows >= 0),
  positive_rows integer not null default 0 check (positive_rows >= 0),
  total_quantity numeric(14, 3) not null default 0 check (total_quantity >= 0),
  matched_product_rows integer not null default 0 check (matched_product_rows >= 0),
  unmatched_product_rows integer not null default 0 check (unmatched_product_rows >= 0),
  missing_production_date_rows integer not null default 0
    check (missing_production_date_rows >= 0),
  missing_shelf_life_rows integer not null default 0
    check (missing_shelf_life_rows >= 0),
  missing_barcode_rows integer not null default 0
    check (missing_barcode_rows >= 0),
  status text not null default 'completed'
    check (status in ('processing', 'completed', 'failed', 'reverted')),
  metadata jsonb not null default '{}'::jsonb,
  imported_by_employee_id uuid references public.employees(id),
  imported_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, source_fingerprint)
);

create table if not exists public.inventory_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  warehouse_id uuid not null references public.warehouses(id),
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  inventory_import_id uuid references public.inventory_imports(id) on delete set null,
  lot_key text not null,
  source_row_no integer,
  production_date date,
  shelf_life_months integer check (shelf_life_months > 0),
  expiry_date date,
  quantity numeric(14, 3) not null default 0 check (quantity >= 0),
  reserved_quantity numeric(14, 3) not null default 0
    check (reserved_quantity >= 0 and reserved_quantity <= quantity),
  status text not null default 'available'
    check (status in ('available', 'quarantined', 'depleted')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, inventory_item_id, lot_key)
);

create index if not exists inventory_imports_org_imported_idx
  on public.inventory_imports (organization_id, imported_at desc);

create index if not exists inventory_batches_org_expiry_idx
  on public.inventory_batches (organization_id, expiry_date)
  where status = 'available' and quantity > reserved_quantity;

create index if not exists inventory_batches_item_status_idx
  on public.inventory_batches (inventory_item_id, status);

drop trigger if exists set_inventory_batches_updated_at on public.inventory_batches;
create trigger set_inventory_batches_updated_at
before update on public.inventory_batches
for each row execute function public.set_updated_at();

insert into public.inventory_batches (
  organization_id,
  warehouse_id,
  inventory_item_id,
  lot_key,
  quantity,
  status,
  note
)
select
  item.organization_id,
  item.warehouse_id,
  item.id,
  'legacy-opening-balance',
  item.quantity,
  case when item.quantity = 0 then 'depleted' else 'available' end,
  '批次能力上线前的历史库存结转'
from public.inventory_items item
where item.quantity > 0
  and not exists (
    select 1
    from public.inventory_batches batch
    where batch.inventory_item_id = item.id
  )
on conflict (warehouse_id, inventory_item_id, lot_key) do nothing;

alter table public.inventory_movements
  add column if not exists inventory_batch_id uuid
    references public.inventory_batches(id) on delete set null,
  add column if not exists inventory_import_id uuid
    references public.inventory_imports(id) on delete set null;

alter table public.inventory_movements
  drop constraint if exists inventory_movements_movement_type_check;
alter table public.inventory_movements
  add constraint inventory_movements_movement_type_check
  check (
    movement_type in (
      'inbound',
      'outbound',
      'opening_balance',
      'adjustment_in',
      'adjustment_out'
    )
  );

alter table public.inventory_imports enable row level security;
alter table public.inventory_batches enable row level security;

drop policy if exists "inventory imports visible to inventory readers"
  on public.inventory_imports;
create policy "inventory imports visible to inventory readers"
on public.inventory_imports for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_employee_id() is not null
);

drop policy if exists "inventory imports manageable by inventory operators"
  on public.inventory_imports;
create policy "inventory imports manageable by inventory operators"
on public.inventory_imports for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
);

drop policy if exists "inventory batches visible to active employees"
  on public.inventory_batches;
create policy "inventory batches visible to active employees"
on public.inventory_batches for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.current_employee_id() is not null
);

drop policy if exists "inventory batches manageable by inventory operators"
  on public.inventory_batches;
create policy "inventory batches manageable by inventory operators"
on public.inventory_batches for all
to authenticated
using (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_inventory()
);

revoke all on table public.inventory_imports from anon;
revoke all on table public.inventory_batches from anon;
grant select, insert, update on table public.inventory_imports to authenticated;
grant select, insert, update on table public.inventory_batches to authenticated;

drop function if exists public.record_inventory_movement(
  uuid,
  text,
  numeric,
  text,
  text
);

create or replace function public.record_inventory_movement(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_quantity numeric,
  p_reference_no text default null,
  p_note text default null,
  p_production_date date default null,
  p_shelf_life_months integer default null
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
  v_available_after numeric(14, 3);
  v_movement_no text;
  v_movement_id uuid;
  v_batch_id uuid;
  v_batch record;
  v_remaining numeric(14, 3);
  v_take numeric(14, 3);
  v_batch_available numeric(14, 3);
  v_lot_key text;
  v_expiry_date date;
  v_batch_available_total numeric(14, 3);
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

  if p_shelf_life_months is not null and p_shelf_life_months <= 0 then
    raise exception '保质期月数必须大于零'
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
    v_available_after := v_item.available_quantity + p_quantity;
    v_lot_key := 'manual:'
      || coalesce(to_char(p_production_date, 'YYYYMMDD'), 'undated');
    v_expiry_date := case
      when p_production_date is not null and p_shelf_life_months is not null
        then (p_production_date + make_interval(months => p_shelf_life_months))::date
      else null
    end;

    insert into public.inventory_batches (
      organization_id,
      warehouse_id,
      inventory_item_id,
      lot_key,
      production_date,
      shelf_life_months,
      expiry_date,
      quantity,
      status,
      note
    )
    values (
      v_item.organization_id,
      v_item.warehouse_id,
      v_item.id,
      v_lot_key,
      p_production_date,
      p_shelf_life_months,
      v_expiry_date,
      p_quantity,
      'available',
      '手工入库'
    )
    on conflict (warehouse_id, inventory_item_id, lot_key)
    do update set
      quantity = public.inventory_batches.quantity + excluded.quantity,
      production_date = coalesce(
        excluded.production_date,
        public.inventory_batches.production_date
      ),
      shelf_life_months = coalesce(
        excluded.shelf_life_months,
        public.inventory_batches.shelf_life_months
      ),
      expiry_date = coalesce(
        excluded.expiry_date,
        public.inventory_batches.expiry_date
      ),
      status = 'available'
    returning id into v_batch_id;
  else
    if v_item.available_quantity < p_quantity then
      raise exception '出库数量超过当前可用库存'
        using errcode = '23514';
    end if;

    select coalesce(sum(batch.quantity - batch.reserved_quantity), 0)
    into v_batch_available_total
    from public.inventory_batches batch
    where batch.inventory_item_id = v_item.id
      and batch.status = 'available';

    if v_batch_available_total < v_item.available_quantity then
      insert into public.inventory_batches (
        organization_id,
        warehouse_id,
        inventory_item_id,
        lot_key,
        quantity,
        status,
        note
      )
      values (
        v_item.organization_id,
        v_item.warehouse_id,
        v_item.id,
        'reconciled-unassigned',
        v_item.available_quantity - v_batch_available_total,
        'available',
        '为历史可用库存自动补建的未分批次'
      )
      on conflict (warehouse_id, inventory_item_id, lot_key)
      do update set
        quantity = excluded.quantity,
        status = 'available';
    end if;

    v_remaining := p_quantity;
    for v_batch in
      select batch.*
      from public.inventory_batches batch
      where batch.inventory_item_id = v_item.id
        and batch.status = 'available'
        and batch.quantity > batch.reserved_quantity
      order by batch.expiry_date asc nulls last, batch.production_date asc nulls last
      for update
    loop
      exit when v_remaining <= 0;
      v_batch_available := v_batch.quantity - v_batch.reserved_quantity;
      v_take := least(v_batch_available, v_remaining);

      update public.inventory_batches
      set
        quantity = quantity - v_take,
        status = case
          when quantity - v_take = 0 then 'depleted'
          else status
        end
      where id = v_batch.id;

      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception '可用批次库存不足，无法完成出库'
        using errcode = '23514';
    end if;

    v_after := v_item.quantity - p_quantity;
    v_available_after := v_item.available_quantity - p_quantity;
  end if;

  update public.inventory_items
  set
    quantity = v_after,
    available_quantity = v_available_after
  where id = v_item.id;

  v_movement_no := 'DXW-'
    || to_char(clock_timestamp(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.inventory_movements (
    organization_id,
    warehouse_id,
    inventory_item_id,
    inventory_batch_id,
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
    v_batch_id,
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
    'afterQuantity', v_after,
    'availableQuantity', v_available_after
  );
end;
$function$;

revoke all on function public.record_inventory_movement(
  uuid,
  text,
  numeric,
  text,
  text,
  date,
  integer
) from public;
grant execute on function public.record_inventory_movement(
  uuid,
  text,
  numeric,
  text,
  text,
  date,
  integer
) to authenticated;

comment on table public.inventory_imports is
  '外部仓储库存快照的导入批次、质量指标和来源追踪。';
comment on table public.inventory_batches is
  '按生产日期和效期维护的库存批次；出库时按先到期先出扣减。';
comment on column public.inventory_items.quantity is
  '物理库存总量，包含可用、预留和隔离库存。';
comment on column public.inventory_items.available_quantity is
  '通过效期和隔离校验后可直接出库的数量。';

commit;
