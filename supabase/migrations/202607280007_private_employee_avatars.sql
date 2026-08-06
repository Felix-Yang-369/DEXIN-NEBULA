begin;

alter table public.employees
  add column if not exists avatar_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists avatars_select_active_employee on storage.objects;
create policy avatars_select_active_employee
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and public.current_employee_id() is not null
);

drop policy if exists avatars_insert_hr_admin on storage.objects;
create policy avatars_insert_hr_admin
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
  )
);

drop policy if exists avatars_update_hr_admin on storage.objects;
create policy avatars_update_hr_admin
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
  )
)
with check (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
  )
);

drop policy if exists avatars_delete_hr_admin on storage.objects;
create policy avatars_delete_hr_admin
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and (
    public.has_org_role('hr')
    or public.has_org_role('admin')
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
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_organization_slug text;
begin
  if public.current_employee_id() is null
    or not (
      public.has_org_role('hr')
      or public.has_org_role('admin')
    )
  then
    raise exception '只有人事或管理员可以维护员工职业照'
      using errcode = '42501';
  end if;

  select slug
  into v_organization_slug
  from public.organizations
  where id = v_organization_id;

  if p_avatar_path is null
    or p_avatar_path like '%..%'
    or p_avatar_path not like v_organization_slug || '/%'
  then
    raise exception '头像文件路径无效'
      using errcode = '22023';
  end if;

  update public.employees
  set avatar_path = p_avatar_path
  where id = p_employee_id
    and organization_id = v_organization_id;

  if not found then
    raise exception '员工不存在或不属于当前组织'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.set_employee_avatar(uuid, text) from public;
grant execute on function public.set_employee_avatar(uuid, text)
  to authenticated;

commit;
