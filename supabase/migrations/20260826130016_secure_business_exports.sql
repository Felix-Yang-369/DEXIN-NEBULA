begin;

create or replace function public.can_export_inventory()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.current_employee_id() is not null
    and (
      public.can_manage_inventory()
      or public.has_org_role('chairman')
    )
$function$;

create or replace function public.can_export_products()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.current_employee_id() is not null
    and (
      public.can_manage_products()
      or public.has_org_role('chairman')
    )
$function$;

create or replace function public.record_inventory_export_audit(
  p_inventory_rows integer,
  p_batch_rows integer,
  p_movement_rows integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_employee_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
begin
  if not public.can_export_inventory() then
    raise exception '当前账号无权导出仓储数据'
      using errcode = '42501';
  end if;

  if coalesce(p_inventory_rows, -1) < 0
    or coalesce(p_batch_rows, -1) < 0
    or coalesce(p_movement_rows, -1) < 0
  then
    raise exception '导出记录数无效'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    summary,
    metadata
  )
  values (
    v_organization_id,
    v_employee_id,
    'inventory_export',
    'inventory',
    '导出仓储库存 Excel',
    jsonb_build_object(
      'inventory_rows', p_inventory_rows,
      'batch_rows', p_batch_rows,
      'movement_rows', p_movement_rows,
      'format', 'xlsx'
    )
  );
end;
$function$;

create or replace function public.record_product_export_audit(
  p_product_rows integer,
  p_price_rows integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_employee_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
begin
  if not public.can_export_products() then
    raise exception '当前账号无权导出产品与价格数据'
      using errcode = '42501';
  end if;

  if coalesce(p_product_rows, -1) < 0
    or coalesce(p_price_rows, -1) < 0
  then
    raise exception '导出记录数无效'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    summary,
    metadata
  )
  values (
    v_organization_id,
    v_employee_id,
    'product_export',
    'product',
    '导出产品与价格 Excel',
    jsonb_build_object(
      'product_rows', p_product_rows,
      'price_rows', p_price_rows,
      'format', 'xlsx'
    )
  );
end;
$function$;

revoke all on function public.can_export_inventory() from public, anon;
revoke all on function public.can_export_products() from public, anon;
revoke all on function public.record_inventory_export_audit(integer, integer, integer) from public, anon;
revoke all on function public.record_product_export_audit(integer, integer) from public, anon;

grant execute on function public.can_export_inventory() to authenticated;
grant execute on function public.can_export_products() to authenticated;
grant execute on function public.record_inventory_export_audit(integer, integer, integer) to authenticated;
grant execute on function public.record_product_export_audit(integer, integer) to authenticated;

comment on function public.can_export_inventory()
is '仅仓储操作人员与董事长可导出仓储数据。';

comment on function public.can_export_products()
is '仅产品管理人员与董事长可导出产品与价格数据。';

comment on function public.record_product_export_audit(integer, integer)
is '在数据库层再次校验权限并记录产品价格导出。';

commit;
