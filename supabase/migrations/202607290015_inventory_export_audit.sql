begin;

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
  if v_employee_id is null or v_organization_id is null then
    raise exception '当前账号不是有效的在职员工'
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

revoke all on function public.record_inventory_export_audit(
  integer,
  integer,
  integer
) from public;
grant execute on function public.record_inventory_export_audit(
  integer,
  integer,
  integer
) to authenticated;

comment on function public.record_inventory_export_audit(integer, integer, integer)
is '记录在职员工导出仓储库存 Excel 的审计事件。';

commit;
