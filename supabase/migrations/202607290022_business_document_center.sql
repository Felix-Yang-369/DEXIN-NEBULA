-- Private business document center with metadata-level access control.

begin;

create table if not exists public.business_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_no text not null,
  category text not null
    check (category in ('contract', 'customer', 'supplier', 'internal')),
  title text not null,
  description text,
  original_file_name text not null,
  storage_path text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 20971520),
  customer_id uuid references public.customers(id) on delete set null,
  related_party_name text,
  reference_no text,
  effective_on date,
  expires_on date,
  visibility text not null default 'department'
    check (visibility in ('organization', 'department', 'restricted')),
  owner_department_id uuid references public.departments(id) on delete set null,
  viewer_role_codes text[] not null default array[]::text[],
  uploaded_by_employee_id uuid not null references public.employees(id),
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_no),
  unique (organization_id, storage_path)
);

create index if not exists business_documents_org_category_idx
  on public.business_documents (organization_id, status, category, created_at desc);
create index if not exists business_documents_customer_idx
  on public.business_documents (customer_id, created_at desc)
  where customer_id is not null;
create index if not exists business_documents_expiry_idx
  on public.business_documents (organization_id, expires_on)
  where status = 'active' and expires_on is not null;

drop trigger if exists business_documents_set_updated_at
  on public.business_documents;
create trigger business_documents_set_updated_at
before update on public.business_documents
for each row execute function public.set_updated_at();

create or replace function public.can_upload_business_document(
  p_category text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees employee
    left join public.departments department
      on department.id = employee.department_id
    where employee.auth_user_id = (select auth.uid())
      and employee.status = 'active'
      and (
        p_category = 'internal'
        or public.has_org_role('admin')
        or public.has_org_role('chairman')
        or (
          p_category = 'contract'
          and (
            public.has_org_role('hr')
            or public.has_org_role('finance')
          )
        )
        or (
          p_category = 'customer'
          and department.code in ('DX-SALES', 'DX-CS')
        )
        or (
          p_category = 'supplier'
          and (
            department.code = 'DX-PROC'
            or public.has_org_role('finance')
          )
        )
      )
  )
$function$;

create or replace function public.can_view_business_document(
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.business_documents document
    join public.employees employee
      on employee.auth_user_id = (select auth.uid())
      and employee.organization_id = document.organization_id
      and employee.status = 'active'
    where document.id = p_document_id
      and (
        document.uploaded_by_employee_id = employee.id
        or public.has_org_role('admin')
        or public.has_org_role('chairman')
        or document.visibility = 'organization'
        or (
          document.visibility = 'department'
          and document.owner_department_id = employee.department_id
        )
        or (
          document.visibility = 'restricted'
          and exists (
            select 1
            from public.employee_roles employee_role
            join public.roles role on role.id = employee_role.role_id
            where employee_role.employee_id = employee.id
              and role.code = any(document.viewer_role_codes)
          )
        )
      )
  )
$function$;

create or replace function public.can_manage_business_document(
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.business_documents document
    join public.employees employee
      on employee.auth_user_id = (select auth.uid())
      and employee.organization_id = document.organization_id
      and employee.status = 'active'
    left join public.departments department
      on department.id = employee.department_id
    where document.id = p_document_id
      and (
        document.uploaded_by_employee_id = employee.id
        or public.has_org_role('admin')
        or (
          document.category = 'contract'
          and public.has_org_role('hr')
        )
        or (
          document.category = 'customer'
          and department.code in ('DX-SALES', 'DX-CS')
        )
        or (
          document.category = 'supplier'
          and department.code = 'DX-PROC'
        )
      )
  )
$function$;

alter table public.business_documents enable row level security;

drop policy if exists business_documents_select_authorized
  on public.business_documents;
create policy business_documents_select_authorized
on public.business_documents
for select
to authenticated
using (public.can_view_business_document(id));

revoke all on table public.business_documents from anon, authenticated;
grant select on table public.business_documents to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'business-documents',
  'business-documents',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists business_documents_storage_insert
  on storage.objects;
create policy business_documents_storage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'business-documents'
  and (storage.foldername(name))[1] = public.current_organization_id()::text
  and public.current_employee_id() is not null
);

drop policy if exists business_documents_storage_select
  on storage.objects;
create policy business_documents_storage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'business-documents'
  and exists (
    select 1
    from public.business_documents document
    where document.storage_path = name
      and public.can_view_business_document(document.id)
  )
);

drop policy if exists business_documents_storage_delete
  on storage.objects;
create policy business_documents_storage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'business-documents'
  and exists (
    select 1
    from public.business_documents document
    where document.storage_path = name
      and public.can_manage_business_document(document.id)
  )
);

create or replace function public.create_business_document(
  p_category text,
  p_title text,
  p_description text,
  p_original_file_name text,
  p_storage_path text,
  p_mime_type text,
  p_file_size bigint,
  p_customer_id uuid,
  p_related_party_name text,
  p_reference_no text,
  p_effective_on date,
  p_expires_on date,
  p_visibility text,
  p_viewer_role_codes text[]
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_document_id uuid;
  v_document_no text;
  v_roles text[];
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_upload_business_document(p_category) then
    raise exception '当前账号无权上传此类文件'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) < 2
    or char_length(btrim(coalesce(p_title, ''))) > 160
    or p_visibility not in ('organization', 'department', 'restricted')
    or p_file_size <= 0
    or p_file_size > 20971520
    or p_storage_path like '%..%'
    or p_storage_path not like v_actor.organization_id::text || '/%'
  then
    raise exception '文件资料参数无效'
      using errcode = '22023';
  end if;

  if p_visibility = 'department' and v_actor.department_id is null then
    raise exception '未设置部门的员工不能创建部门文件'
      using errcode = '22023';
  end if;

  if p_customer_id is not null
    and not exists (
      select 1
      from public.customers
      where id = p_customer_id
        and organization_id = v_actor.organization_id
    )
  then
    raise exception '关联客户不存在或无权访问'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct role_code), array[]::text[])
  into v_roles
  from unnest(coalesce(p_viewer_role_codes, array[]::text[])) role_code
  where role_code in (
    'employee',
    'department_lead',
    'hr',
    'finance',
    'admin',
    'chairman'
  );

  v_document_no := 'DXD-'
    || to_char(clock_timestamp(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.business_documents (
    organization_id,
    document_no,
    category,
    title,
    description,
    original_file_name,
    storage_path,
    mime_type,
    file_size,
    customer_id,
    related_party_name,
    reference_no,
    effective_on,
    expires_on,
    visibility,
    owner_department_id,
    viewer_role_codes,
    uploaded_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_document_no,
    p_category,
    btrim(p_title),
    nullif(btrim(coalesce(p_description, '')), ''),
    btrim(p_original_file_name),
    p_storage_path,
    p_mime_type,
    p_file_size,
    p_customer_id,
    nullif(btrim(coalesce(p_related_party_name, '')), ''),
    nullif(btrim(coalesce(p_reference_no, '')), ''),
    p_effective_on,
    p_expires_on,
    p_visibility,
    v_actor.department_id,
    v_roles,
    v_actor.id
  )
  returning id into v_document_id;

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
    'business_document_uploaded',
    'business_document',
    v_document_id,
    '上传文件：' || btrim(p_title),
    jsonb_build_object('document_no', v_document_no, 'category', p_category)
  );

  return v_document_id;
end;
$function$;

create or replace function public.archive_business_document(
  p_document_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_title text;
begin
  if not public.can_manage_business_document(p_document_id) then
    raise exception '无权归档此文件'
      using errcode = '42501';
  end if;

  update public.business_documents
  set status = 'archived'
  where id = p_document_id
    and organization_id = v_organization_id
  returning title into v_title;

  if not found then
    raise exception '文件不存在'
      using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary
  )
  values (
    v_organization_id,
    v_actor_id,
    'business_document_archived',
    'business_document',
    p_document_id,
    '归档文件：' || v_title
  );
end;
$function$;

create or replace function public.record_business_document_download(
  p_document_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_title text;
begin
  if not public.can_view_business_document(p_document_id) then
    raise exception '无权下载此文件'
      using errcode = '42501';
  end if;

  select title
  into v_title
  from public.business_documents
  where id = p_document_id
    and organization_id = v_organization_id;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary
  )
  values (
    v_organization_id,
    v_actor_id,
    'business_document_downloaded',
    'business_document',
    p_document_id,
    '下载文件：' || v_title
  );
end;
$function$;

revoke all on function public.can_upload_business_document(text) from public;
revoke all on function public.can_view_business_document(uuid) from public;
revoke all on function public.can_manage_business_document(uuid) from public;
revoke all on function public.create_business_document(
  text, text, text, text, text, text, bigint, uuid, text, text, date, date, text, text[]
) from public;
revoke all on function public.archive_business_document(uuid) from public;
revoke all on function public.record_business_document_download(uuid) from public;

grant execute on function public.can_upload_business_document(text) to authenticated;
grant execute on function public.can_view_business_document(uuid) to authenticated;
grant execute on function public.can_manage_business_document(uuid) to authenticated;
grant execute on function public.create_business_document(
  text, text, text, text, text, text, bigint, uuid, text, text, date, date, text, text[]
) to authenticated;
grant execute on function public.archive_business_document(uuid) to authenticated;
grant execute on function public.record_business_document_download(uuid) to authenticated;

commit;
