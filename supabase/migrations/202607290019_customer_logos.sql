-- Private customer logo storage and audited CRM logo updates.

begin;

alter table public.customers
  add column if not exists logo_path text;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'customer-logos',
  'customer-logos',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists customer_logos_select_crm on storage.objects;
create policy customer_logos_select_crm
on storage.objects
for select
to authenticated
using (
  bucket_id = 'customer-logos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and (
    public.can_manage_customers()
    or public.has_org_role('chairman')
  )
);

drop policy if exists customer_logos_insert_crm on storage.objects;
create policy customer_logos_insert_crm
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'customer-logos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.can_manage_customers()
);

drop policy if exists customer_logos_update_crm on storage.objects;
create policy customer_logos_update_crm
on storage.objects
for update
to authenticated
using (
  bucket_id = 'customer-logos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.can_manage_customers()
)
with check (
  bucket_id = 'customer-logos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.can_manage_customers()
);

drop policy if exists customer_logos_delete_crm on storage.objects;
create policy customer_logos_delete_crm
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'customer-logos'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.can_manage_customers()
);

create or replace function public.set_customer_logo(
  p_customer_id uuid,
  p_logo_path text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_customer public.customers%rowtype;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '只有销售、客服或系统管理员可以维护企业 Logo'
      using errcode = '42501';
  end if;

  if p_logo_path is null
    or p_logo_path like '%..%'
    or p_logo_path not like v_actor.organization_id::text || '/%'
  then
    raise exception '企业 Logo 文件路径无效'
      using errcode = '22023';
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id
    and organization_id = v_actor.organization_id
  for update;

  if v_customer.id is null then
    raise exception '客户不存在或不属于当前组织'
      using errcode = '42501';
  end if;

  update public.customers
  set logo_path = p_logo_path
  where id = v_customer.id;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'customer_logo_updated',
    'customer',
    v_customer.id,
    '更新企业 Logo：' || v_customer.name,
    jsonb_build_object(
      'customer_no', v_customer.customer_no,
      'logo_path', p_logo_path
    )
  );
end;
$function$;

revoke all on function public.set_customer_logo(uuid, text) from public;
grant execute on function public.set_customer_logo(uuid, text)
  to authenticated;

commit;
