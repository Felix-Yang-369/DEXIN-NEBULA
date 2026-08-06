-- Allow active employees to manage only their own private avatar object.

begin;

create or replace function public.current_employee_avatar_prefix()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select organization.slug || '/' || employee.employee_no
  from public.employees employee
  join public.organizations organization
    on organization.id = employee.organization_id
  where employee.auth_user_id = (select auth.uid())
    and employee.status = 'active'
  limit 1
$function$;

revoke all on function public.current_employee_avatar_prefix()
  from public, anon;
grant execute on function public.current_employee_avatar_prefix()
  to authenticated;

drop policy if exists avatars_insert_hr_admin on storage.objects;
create policy avatars_insert_authorized
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
    or name like (select public.current_employee_avatar_prefix()) || '/%'
  )
);

drop policy if exists avatars_update_hr_admin on storage.objects;
create policy avatars_update_authorized
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
    or name like (select public.current_employee_avatar_prefix()) || '/%'
  )
)
with check (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
    or name like (select public.current_employee_avatar_prefix()) || '/%'
  )
);

drop policy if exists avatars_delete_hr_admin on storage.objects;
create policy avatars_delete_authorized
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
    or name like (select public.current_employee_avatar_prefix()) || '/%'
  )
);

create or replace function public.set_employee_avatar(
  p_employee_id uuid,
  p_avatar_path text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_actor_organization_id uuid := public.current_organization_id();
  v_target_prefix text;
begin
  if v_actor_id is null
    or not (
      p_employee_id = v_actor_id
      or public.has_org_role('hr')
      or public.has_org_role('admin')
    )
  then
    raise exception '只能维护本人头像，或由人事和管理员维护'
      using errcode = '42501';
  end if;

  select organization.slug || '/' || employee.employee_no
  into v_target_prefix
  from public.employees employee
  join public.organizations organization
    on organization.id = employee.organization_id
  where employee.id = p_employee_id
    and employee.organization_id = v_actor_organization_id;

  if v_target_prefix is null
    or p_avatar_path is null
    or p_avatar_path like '%..%'
    or p_avatar_path not like v_target_prefix || '/%'
  then
    raise exception '头像文件路径无效'
      using errcode = '22023';
  end if;

  update public.employees
  set avatar_path = p_avatar_path
  where id = p_employee_id
    and organization_id = v_actor_organization_id;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  ) values (
    v_actor_organization_id,
    v_actor_id,
    'employee_avatar_updated',
    'employee',
    p_employee_id,
    case when p_employee_id = v_actor_id
      then '员工更新本人头像'
      else '人事或管理员更新员工头像'
    end,
    '{}'::jsonb
  );
end;
$function$;

revoke all on function public.set_employee_avatar(uuid, text)
  from public, anon;
grant execute on function public.set_employee_avatar(uuid, text)
  to authenticated;

commit;
