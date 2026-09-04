begin;

create or replace function public.rename_business_view(
  p_id uuid,
  p_view_key text,
  p_name text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_updated integer;
begin
  if p_view_key !~ '^[a-z][a-z0-9_.-]{2,79}$'
    or char_length(btrim(coalesce(p_name, ''))) not between 2 and 40 then
    raise exception '保存视图参数无效' using errcode = '22023';
  end if;

  update public.business_saved_views
  set name = btrim(p_name), updated_at = now()
  where id = p_id
    and view_key = p_view_key
    and organization_id = public.current_organization_id()
    and employee_id = public.current_employee_id();
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$function$;

create or replace function public.delete_business_view(
  p_id uuid,
  p_view_key text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_deleted integer;
begin
  if p_view_key !~ '^[a-z][a-z0-9_.-]{2,79}$' then
    raise exception '保存视图参数无效' using errcode = '22023';
  end if;

  delete from public.business_saved_views
  where id = p_id
    and view_key = p_view_key
    and organization_id = public.current_organization_id()
    and employee_id = public.current_employee_id();
  get diagnostics v_deleted = row_count;
  return v_deleted = 1;
end;
$function$;

revoke all on function public.rename_business_view(uuid, text, text) from public, anon;
revoke all on function public.delete_business_view(uuid, text) from public, anon;
grant execute on function public.rename_business_view(uuid, text, text) to authenticated;
grant execute on function public.delete_business_view(uuid, text) to authenticated;

commit;
