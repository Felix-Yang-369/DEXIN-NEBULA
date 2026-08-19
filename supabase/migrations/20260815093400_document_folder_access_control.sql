-- Logical document folders, access requests and NAS-backed document authorization.
-- Applied to dexin-nebula-dev as migration version 20260815093400.

begin;

alter table public.approval_requests
  drop constraint if exists approval_requests_request_type_check;
alter table public.approval_requests
  add constraint approval_requests_request_type_check
  check (request_type in ('expense', 'seal', 'folder_access'));

create table public.document_folders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  parent_id uuid,
  code text not null,
  name text not null,
  description text,
  access_level smallint not null default 2 check (access_level between 1 and 4),
  sort_order integer not null default 100 check (sort_order >= 0),
  owner_employee_id uuid references public.employees(id) on delete set null,
  owner_role_code text check (
    owner_role_code is null or owner_role_code in (
      'employee', 'department_lead', 'hr', 'finance', 'admin', 'chairman'
    )
  ),
  owner_department_id uuid references public.departments(id) on delete set null,
  is_hidden boolean not null default false,
  is_requestable boolean not null default true,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (organization_id, code),
  unique (parent_id, name),
  foreign key (organization_id, parent_id)
    references public.document_folders(organization_id, id) on delete restrict
);

create table public.document_folder_role_permissions (
  folder_id uuid not null references public.document_folders(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  can_view boolean not null default false,
  can_download boolean not null default false,
  can_upload boolean not null default false,
  can_manage boolean not null default false,
  can_authorize boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (folder_id, role_id)
);

create table public.document_folder_department_permissions (
  folder_id uuid not null references public.document_folders(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  can_view boolean not null default false,
  can_download boolean not null default false,
  can_upload boolean not null default false,
  can_manage boolean not null default false,
  can_authorize boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (folder_id, department_id)
);

create table public.document_folder_employee_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  folder_id uuid not null references public.document_folders(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  source_request_id uuid unique references public.approval_requests(id) on delete set null,
  can_view boolean not null default true,
  can_download boolean not null default true,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  revoked_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);

create table public.document_folder_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null unique references public.approval_requests(id) on delete cascade,
  folder_id uuid not null references public.document_folders(id) on delete restrict,
  reason text not null check (char_length(btrim(reason)) between 10 and 1000),
  related_context text,
  duration_hours integer not null default 24
    check (duration_hours in (0, 24, 168, 720, 2160)),
  requested_can_download boolean not null default true,
  urgency text not null default 'normal' check (urgency in ('normal', 'urgent')),
  created_at timestamptz not null default now()
);

alter table public.business_documents
  add column folder_id uuid references public.document_folders(id) on delete restrict;

create index document_folders_parent_idx
  on public.document_folders (organization_id, parent_id, status, sort_order);
create index document_folder_role_permissions_role_idx
  on public.document_folder_role_permissions (role_id, folder_id);
create index document_folder_department_permissions_department_idx
  on public.document_folder_department_permissions (department_id, folder_id);
create index document_folder_employee_grants_active_idx
  on public.document_folder_employee_grants (employee_id, folder_id, expires_at)
  where revoked_at is null;
create index document_folder_access_requests_folder_idx
  on public.document_folder_access_requests (folder_id, created_at desc);
create index business_documents_folder_idx
  on public.business_documents (folder_id, status, created_at desc);

create trigger document_folders_set_updated_at
before update on public.document_folders
for each row execute function public.set_updated_at();

insert into public.document_folders (
  organization_id,
  code,
  name,
  description,
  access_level,
  sort_order,
  owner_role_code,
  owner_department_id,
  is_requestable
)
select
  organization.id,
  seed.code,
  seed.name,
  seed.description,
  seed.access_level,
  seed.sort_order,
  seed.owner_role_code,
  owner_department.id,
  seed.is_requestable
from public.organizations organization
cross join (
  values
    ('company-public', '公司公共资料', '全体员工可查看的制度、模板、品牌基础资料和操作手册。', 1, 10, 'admin', null, false),
    ('human-resources', '人力资源', '员工档案、合同、招聘、绩效、培训及人事资料。', 3, 20, 'hr', null, true),
    ('finance', '财务管理', '应收应付、收付款、发票凭证、资金、税务与报销资料。', 3, 30, 'finance', null, true),
    ('business', '业务管理', '客户档案、客户合同、报价订单、项目交付和售后资料。', 2, 40, null, 'DX-SALES', true),
    ('supply-chain', '供应链管理', '供应商、采购、仓储、物流以及质量合规资料。', 2, 50, null, 'DX-PROC', true),
    ('product-center', '产品中心', '产品主档、规格、图片、说明书、检测及研发资料。', 2, 60, 'admin', null, true),
    ('operations-brand', '运营与品牌', '新媒体、企业宣传、品牌素材和活动资料。', 2, 70, 'admin', null, true),
    ('department-spaces', '部门空间', '各部门日常资料、项目协作和临时归档入口。', 2, 80, 'admin', null, true)
) as seed(
  code,
  name,
  description,
  access_level,
  sort_order,
  owner_role_code,
  owner_department_code,
  is_requestable
)
left join public.departments owner_department
  on owner_department.organization_id = organization.id
 and owner_department.code = seed.owner_department_code
on conflict (organization_id, code) do nothing;

insert into public.document_folders (
  organization_id,
  parent_id,
  code,
  name,
  description,
  access_level,
  sort_order,
  owner_employee_id,
  owner_department_id,
  is_requestable
)
select
  department.organization_id,
  root.id,
  'department-' || lower(replace(department.code, 'DX-', '')),
  department.name,
  department.name || '内部资料与协作文件。',
  2,
  100 + row_number() over (
    partition by department.organization_id order by department.created_at, department.id
  ),
  department.manager_employee_id,
  department.id,
  true
from public.departments department
join public.document_folders root
  on root.organization_id = department.organization_id
 and root.code = 'department-spaces'
where department.status = 'active'
on conflict (organization_id, code) do nothing;

insert into public.document_folder_role_permissions (
  folder_id,
  role_id,
  can_view,
  can_download,
  can_upload,
  can_manage,
  can_authorize
)
select
  folder.id,
  role.id,
  permission.can_view,
  permission.can_download,
  permission.can_upload,
  permission.can_manage,
  permission.can_authorize
from public.document_folders folder
join (
  values
    ('company-public', 'employee', true, true, false, false, false),
    ('human-resources', 'hr', true, true, true, false, false),
    ('finance', 'finance', true, true, true, false, false),
    ('department-spaces', 'employee', true, false, false, false, false)
) as permission(
  folder_code,
  role_code,
  can_view,
  can_download,
  can_upload,
  can_manage,
  can_authorize
) on permission.folder_code = folder.code
join public.roles role
  on role.organization_id = folder.organization_id
 and role.code = permission.role_code
on conflict (folder_id, role_id) do nothing;

insert into public.document_folder_department_permissions (
  folder_id,
  department_id,
  can_view,
  can_download,
  can_upload,
  can_manage,
  can_authorize
)
select
  folder.id,
  department.id,
  true,
  true,
  true,
  false,
  false
from public.document_folders folder
join (
  values
    ('business', 'DX-SALES'),
    ('business', 'DX-CS'),
    ('supply-chain', 'DX-PROC'),
    ('supply-chain', 'DX-WH'),
    ('product-center', 'DX-SALES'),
    ('product-center', 'DX-CS'),
    ('product-center', 'DX-PROC'),
    ('product-center', 'DX-FIN')
) as permission(folder_code, department_code)
  on permission.folder_code = folder.code
join public.departments department
  on department.organization_id = folder.organization_id
 and department.code = permission.department_code
on conflict (folder_id, department_id) do nothing;

insert into public.document_folder_department_permissions (
  folder_id,
  department_id,
  can_view,
  can_download,
  can_upload,
  can_manage,
  can_authorize
)
select
  folder.id,
  folder.owner_department_id,
  true,
  true,
  true,
  false,
  false
from public.document_folders folder
where folder.parent_id is not null
  and folder.owner_department_id is not null
on conflict (folder_id, department_id) do nothing;

update public.business_documents document
set folder_id = coalesce(
  case
    when document.category in ('contract', 'customer') then (
      select folder.id
      from public.document_folders folder
      where folder.organization_id = document.organization_id
        and folder.code = 'business'
    )
    when document.category = 'supplier' then (
      select folder.id
      from public.document_folders folder
      where folder.organization_id = document.organization_id
        and folder.code = 'supply-chain'
    )
    when document.category = 'internal' and document.owner_department_id is not null then (
      select folder.id
      from public.document_folders folder
      where folder.organization_id = document.organization_id
        and folder.owner_department_id = document.owner_department_id
        and folder.parent_id is not null
      limit 1
    )
  end,
  (
    select folder.id
    from public.document_folders folder
    where folder.organization_id = document.organization_id
      and folder.code = 'department-spaces'
  )
)
where document.folder_id is null;

alter table public.business_documents alter column folder_id set not null;

create or replace function public.is_document_folder_owner(p_folder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.document_folders folder
    left join public.departments department
      on department.id = folder.owner_department_id
    left join lateral (
      select employee.id
      from public.employees employee
      join public.employee_roles employee_role on employee_role.employee_id = employee.id
      join public.roles role on role.id = employee_role.role_id
      where employee.organization_id = folder.organization_id
        and employee.status = 'active'
        and role.organization_id = folder.organization_id
        and role.code = folder.owner_role_code
      order by employee.created_at, employee.id
      limit 1
    ) owner_role_employee on true
    where folder.id = p_folder_id
      and folder.organization_id = public.current_organization_id()
      and (
        folder.owner_employee_id = public.current_employee_id()
        or owner_role_employee.id = public.current_employee_id()
        or department.manager_employee_id = public.current_employee_id()
      )
  )
$function$;

create or replace function public.document_folder_has_permission(
  p_folder_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_employee_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
begin
  if v_employee_id is null
    or p_permission not in ('view', 'download', 'upload', 'manage', 'authorize')
  then
    return false;
  end if;

  if public.has_org_role('chairman') then
    return exists (
      select 1 from public.document_folders folder
      where folder.id = p_folder_id
        and folder.organization_id = v_organization_id
        and folder.status = 'active'
    );
  end if;

  if public.has_org_role('admin') and p_permission in ('view', 'download') then
    return exists (
      select 1 from public.document_folders folder
      where folder.id = p_folder_id
        and folder.organization_id = v_organization_id
        and folder.status = 'active'
    );
  end if;

  if public.is_document_folder_owner(p_folder_id) then
    return true;
  end if;

  return exists (
    select 1
    from public.document_folders folder
    where folder.id = p_folder_id
      and folder.organization_id = v_organization_id
      and folder.status = 'active'
      and (
        exists (
          select 1
          from public.document_folder_employee_grants employee_grant
          where employee_grant.folder_id = folder.id
            and employee_grant.employee_id = v_employee_id
            and employee_grant.organization_id = v_organization_id
            and employee_grant.revoked_at is null
            and employee_grant.starts_at <= now()
            and (employee_grant.expires_at is null or employee_grant.expires_at > now())
            and case p_permission
              when 'view' then employee_grant.can_view
              when 'download' then employee_grant.can_download
              else false
            end
        )
        or exists (
          select 1
          from public.document_folder_role_permissions role_permission
          join public.roles role on role.id = role_permission.role_id
          where role_permission.folder_id = folder.id
            and role.organization_id = v_organization_id
            and public.has_org_role(role.code)
            and case p_permission
              when 'view' then role_permission.can_view
              when 'download' then role_permission.can_download
              when 'upload' then role_permission.can_upload
              when 'manage' then role_permission.can_manage
              when 'authorize' then role_permission.can_authorize
            end
        )
        or exists (
          select 1
          from public.document_folder_department_permissions department_permission
          join public.employees employee
            on employee.id = v_employee_id
           and employee.department_id = department_permission.department_id
          where department_permission.folder_id = folder.id
            and employee.organization_id = v_organization_id
            and employee.status = 'active'
            and case p_permission
              when 'view' then department_permission.can_view
              when 'download' then department_permission.can_download
              when 'upload' then department_permission.can_upload
              when 'manage' then department_permission.can_manage
              when 'authorize' then department_permission.can_authorize
            end
        )
      )
  );
end;
$function$;

create or replace function public.can_discover_document_folder(p_folder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.document_folders folder
    where folder.id = p_folder_id
      and folder.organization_id = public.current_organization_id()
      and folder.status = 'active'
      and (
        (folder.parent_id is null and not folder.is_hidden)
        or public.document_folder_has_permission(folder.id, 'view')
      )
  )
$function$;

create or replace function public.list_document_folder_tree()
returns table (
  id uuid,
  parent_id uuid,
  code text,
  name text,
  description text,
  access_level smallint,
  sort_order integer,
  owner_name text,
  is_locked boolean,
  can_download boolean,
  can_upload boolean,
  can_manage boolean,
  can_authorize boolean,
  is_requestable boolean,
  pending_request_id uuid,
  file_count bigint
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    folder.id,
    folder.parent_id,
    folder.code,
    folder.name,
    folder.description,
    folder.access_level,
    folder.sort_order,
    coalesce(owner_employee.name, owner_department_manager.name, owner_role_employee.name),
    not public.document_folder_has_permission(folder.id, 'view'),
    public.document_folder_has_permission(folder.id, 'download'),
    public.document_folder_has_permission(folder.id, 'upload'),
    public.document_folder_has_permission(folder.id, 'manage'),
    public.document_folder_has_permission(folder.id, 'authorize'),
    folder.is_requestable,
    pending_request.id,
    case
      when public.document_folder_has_permission(folder.id, 'view') then (
        select count(*)
        from public.business_documents document
        where document.folder_id = folder.id
          and document.status = 'active'
      )
      else 0
    end
  from public.document_folders folder
  left join public.employees owner_employee
    on owner_employee.id = folder.owner_employee_id
  left join public.departments owner_department
    on owner_department.id = folder.owner_department_id
  left join public.employees owner_department_manager
    on owner_department_manager.id = owner_department.manager_employee_id
  left join lateral (
    select employee.id, employee.name
    from public.employees employee
    join public.employee_roles employee_role on employee_role.employee_id = employee.id
    join public.roles role on role.id = employee_role.role_id
    where employee.organization_id = folder.organization_id
      and employee.status = 'active'
      and role.organization_id = folder.organization_id
      and role.code = folder.owner_role_code
    order by employee.created_at, employee.id
    limit 1
  ) owner_role_employee on true
  left join lateral (
    select request.id
    from public.document_folder_access_requests access_request
    join public.approval_requests request
      on request.id = access_request.approval_request_id
    where access_request.folder_id = folder.id
      and request.applicant_employee_id = public.current_employee_id()
      and request.status = 'pending'
    order by request.created_at desc
    limit 1
  ) pending_request on true
  where folder.organization_id = public.current_organization_id()
    and folder.status = 'active'
    and public.can_discover_document_folder(folder.id)
  order by folder.sort_order, folder.name
$function$;

create or replace function public.create_document_folder(
  p_parent_id uuid,
  p_name text,
  p_description text,
  p_access_level integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_parent public.document_folders%rowtype;
  v_folder_id uuid;
begin
  select * into v_parent
  from public.document_folders
  where id = p_parent_id
    and organization_id = public.current_organization_id()
    and status = 'active';

  if v_actor_id is null
    or v_parent.id is null
    or not public.document_folder_has_permission(v_parent.id, 'manage')
  then
    raise exception '无权在该位置创建文件夹' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) not between 2 and 80
    or p_access_level not between v_parent.access_level and 4
  then
    raise exception '文件夹名称或权限级别无效' using errcode = '22023';
  end if;

  insert into public.document_folders (
    organization_id,
    parent_id,
    code,
    name,
    description,
    access_level,
    sort_order,
    owner_employee_id,
    owner_role_code,
    owner_department_id,
    is_requestable
  )
  values (
    v_parent.organization_id,
    v_parent.id,
    'custom-' || replace(gen_random_uuid()::text, '-', ''),
    btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''),
    p_access_level,
    100,
    v_parent.owner_employee_id,
    v_parent.owner_role_code,
    v_parent.owner_department_id,
    true
  )
  returning id into v_folder_id;

  if p_access_level = v_parent.access_level then
    insert into public.document_folder_role_permissions (
      folder_id, role_id, can_view, can_download, can_upload, can_manage, can_authorize
    )
    select
      v_folder_id, role_id, can_view, can_download, can_upload, can_manage, can_authorize
    from public.document_folder_role_permissions
    where folder_id = v_parent.id;

    insert into public.document_folder_department_permissions (
      folder_id, department_id, can_view, can_download, can_upload, can_manage, can_authorize
    )
    select
      v_folder_id, department_id, can_view, can_download, can_upload, can_manage, can_authorize
    from public.document_folder_department_permissions
    where folder_id = v_parent.id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  )
  values (
    v_parent.organization_id,
    v_actor_id,
    'document_folder_created',
    'document_folder',
    v_folder_id,
    '创建文件夹：' || btrim(p_name),
    jsonb_build_object('parent_id', v_parent.id, 'access_level', p_access_level)
  );

  return v_folder_id;
end;
$function$;

create or replace function public.resolve_document_folder_owner(p_folder_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select coalesce(
    folder.owner_employee_id,
    owner_department.manager_employee_id,
    owner_role_employee.id,
    public.find_active_role_holder(folder.organization_id, 'admin'),
    public.find_active_role_holder(folder.organization_id, 'chairman')
  )
  from public.document_folders folder
  left join public.departments owner_department
    on owner_department.id = folder.owner_department_id
   and owner_department.status = 'active'
  left join lateral (
    select employee.id
    from public.employees employee
    join public.employee_roles employee_role on employee_role.employee_id = employee.id
    join public.roles role on role.id = employee_role.role_id
    where employee.organization_id = folder.organization_id
      and employee.status = 'active'
      and role.organization_id = folder.organization_id
      and role.code = folder.owner_role_code
    order by employee.created_at, employee.id
    limit 1
  ) owner_role_employee on true
  where folder.id = p_folder_id
    and folder.organization_id = public.current_organization_id()
$function$;

create or replace function public.submit_document_folder_access_request(
  p_folder_id uuid,
  p_reason text,
  p_related_context text,
  p_duration_hours integer default 24,
  p_requested_can_download boolean default true,
  p_urgency text default 'normal'
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_folder public.document_folders%rowtype;
  v_owner_id uuid;
  v_chairman_id uuid;
  v_approvers uuid[] := array[]::uuid[];
  v_step_codes text[] := array[]::text[];
  v_step_names text[] := array[]::text[];
  v_request_id uuid;
  v_request_no text;
  v_index integer;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  select * into v_folder
  from public.document_folders
  where id = p_folder_id
    and organization_id = v_actor.organization_id
    and status = 'active';

  if v_actor.id is null or v_folder.id is null then
    raise exception '文件夹不存在或无权申请' using errcode = '42501';
  end if;
  if not v_folder.is_requestable then
    raise exception '该文件夹不接受权限申请' using errcode = '42501';
  end if;
  if public.document_folder_has_permission(v_folder.id, 'view') then
    raise exception '当前账号已经拥有查看权限' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 10 and 1000
    or p_duration_hours not in (0, 24, 168, 720, 2160)
    or p_urgency not in ('normal', 'urgent')
  then
    raise exception '权限申请参数无效' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.document_folder_access_requests access_request
    join public.approval_requests request
      on request.id = access_request.approval_request_id
    where access_request.folder_id = v_folder.id
      and request.applicant_employee_id = v_actor.id
      and request.status = 'pending'
  ) then
    raise exception '该文件夹已有审批中的权限申请' using errcode = '23505';
  end if;

  v_owner_id := public.resolve_document_folder_owner(v_folder.id);
  if v_owner_id is null then
    raise exception '文件夹尚未配置有效负责人' using errcode = '23514';
  end if;

  if v_folder.access_level >= 3 then
    if v_actor.manager_id is null then
      raise exception '员工尚未配置直属负责人' using errcode = '23514';
    end if;
    v_approvers := array_append(v_approvers, v_actor.manager_id);
    v_step_codes := array_append(v_step_codes, 'manager_review');
    v_step_names := array_append(v_step_names, '直属负责人审批');
  end if;

  if not (v_owner_id = any(v_approvers)) then
    v_approvers := array_append(v_approvers, v_owner_id);
    v_step_codes := array_append(v_step_codes, 'folder_owner_review');
    v_step_names := array_append(v_step_names, '文件夹负责人审批');
  end if;

  if v_folder.access_level = 4
    or (v_folder.access_level >= 3 and p_duration_hours = 0)
  then
    v_chairman_id := public.find_active_role_holder(v_actor.organization_id, 'chairman');
    if v_chairman_id is null then
      raise exception '尚未配置有效董事长审批人' using errcode = '23514';
    end if;
    if not (v_chairman_id = any(v_approvers)) then
      v_approvers := array_append(v_approvers, v_chairman_id);
      v_step_codes := array_append(v_step_codes, 'chairman_review');
      v_step_names := array_append(v_step_names, '董事长审批');
    end if;
  end if;

  if cardinality(v_approvers) = 0 then
    raise exception '权限申请未生成有效审批节点' using errcode = '23514';
  end if;

  v_request_no := 'FAR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.approval_requests (
    organization_id,
    request_no,
    request_type,
    title,
    summary,
    applicant_employee_id,
    current_approver_employee_id,
    status,
    current_step_order,
    total_steps
  )
  values (
    v_actor.organization_id,
    v_request_no,
    'folder_access',
    '申请查看文件夹：' || v_folder.name,
    btrim(p_reason),
    v_actor.id,
    v_approvers[1],
    'pending',
    1,
    cardinality(v_approvers)
  )
  returning id into v_request_id;

  insert into public.document_folder_access_requests (
    organization_id,
    approval_request_id,
    folder_id,
    reason,
    related_context,
    duration_hours,
    requested_can_download,
    urgency
  )
  values (
    v_actor.organization_id,
    v_request_id,
    v_folder.id,
    btrim(p_reason),
    nullif(btrim(coalesce(p_related_context, '')), ''),
    p_duration_hours,
    p_requested_can_download,
    p_urgency
  );

  for v_index in 1..cardinality(v_approvers) loop
    insert into public.approval_steps (
      organization_id,
      approval_request_id,
      step_order,
      step_code,
      step_name,
      approver_employee_id,
      status
    )
    values (
      v_actor.organization_id,
      v_request_id,
      v_index,
      v_step_codes[v_index],
      v_step_names[v_index],
      v_approvers[v_index],
      case when v_index = 1 then 'active' else 'pending' end
    );
  end loop;

  insert into public.approval_events (
    organization_id,
    approval_request_id,
    actor_employee_id,
    action,
    opinion,
    previous_status,
    next_status
  )
  values (
    v_actor.organization_id,
    v_request_id,
    v_actor.id,
    'submitted',
    '申请查看文件夹：' || v_folder.name,
    'draft',
    'pending'
  );

  return v_request_id;
end;
$function$;

create or replace function public.grant_document_folder_access_after_approval()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_access public.document_folder_access_requests%rowtype;
begin
  if new.request_type = 'folder_access'
    and new.status = 'approved'
    and old.status is distinct from new.status
  then
    select * into v_access
    from public.document_folder_access_requests
    where approval_request_id = new.id;

    if v_access.id is not null then
      insert into public.document_folder_employee_grants (
        organization_id,
        folder_id,
        employee_id,
        source_request_id,
        can_view,
        can_download,
        starts_at,
        expires_at
      )
      values (
        new.organization_id,
        v_access.folder_id,
        new.applicant_employee_id,
        new.id,
        true,
        v_access.requested_can_download,
        now(),
        case
          when v_access.duration_hours = 0 then null
          else now() + make_interval(hours => v_access.duration_hours)
        end
      )
      on conflict (source_request_id) do nothing;

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
        new.organization_id,
        old.current_approver_employee_id,
        'document_folder_access_granted',
        'document_folder',
        v_access.folder_id,
        '文件夹查看权限已生效',
        jsonb_build_object(
          'employee_id', new.applicant_employee_id,
          'approval_request_id', new.id,
          'duration_hours', v_access.duration_hours,
          'can_download', v_access.requested_can_download
        )
      );
    end if;
  end if;
  return new;
end;
$function$;

create trigger approval_requests_grant_folder_access
after update of status on public.approval_requests
for each row execute function public.grant_document_folder_access_after_approval();

create or replace function public.process_document_folder_access_request(
  p_request_id uuid,
  p_action text,
  p_opinion text,
  p_expected_version integer,
  p_duration_hours integer,
  p_can_download boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_request public.approval_requests%rowtype;
  v_access public.document_folder_access_requests%rowtype;
begin
  select * into v_request
  from public.approval_requests
  where id = p_request_id
    and request_type = 'folder_access'
    and organization_id = public.current_organization_id();

  select * into v_access
  from public.document_folder_access_requests
  where approval_request_id = p_request_id;

  if v_actor_id is null or v_request.id is null or v_access.id is null then
    raise exception '申请不存在或无权访问' using errcode = '42501';
  end if;

  if p_action = 'approve' then
    if v_request.status <> 'pending'
      or v_request.current_approver_employee_id <> v_actor_id
      or p_duration_hours not in (0, 24, 168, 720, 2160)
      or (v_access.duration_hours <> 0 and (p_duration_hours = 0 or p_duration_hours > v_access.duration_hours))
      or (not v_access.requested_can_download and p_can_download)
    then
      raise exception '只能缩短申请期限或取消下载权限' using errcode = '22023';
    end if;

    update public.document_folder_access_requests
    set
      duration_hours = p_duration_hours,
      requested_can_download = p_can_download
    where id = v_access.id;
  end if;

  return public.process_approval_request(
    p_request_id,
    p_action,
    p_opinion,
    p_expected_version
  );
end;
$function$;

create or replace function public.can_view_approval_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.approval_requests request
    where request.id = target_request_id
      and request.organization_id = public.current_organization_id()
      and (
        request.applicant_employee_id = public.current_employee_id()
        or request.current_approver_employee_id = public.current_employee_id()
        or public.has_org_role('admin')
        or exists (
          select 1
          from public.approval_steps step
          where step.approval_request_id = request.id
            and step.approver_employee_id = public.current_employee_id()
        )
        or (
          request.request_type = 'expense'
          and (public.has_org_role('finance') or public.has_org_role('chairman'))
        )
        or (
          request.request_type = 'seal'
          and (public.has_org_role('hr') or public.has_org_role('chairman'))
        )
      )
  )
$function$;

create or replace function public.can_view_business_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.business_documents document
    where document.id = p_document_id
      and document.organization_id = public.current_organization_id()
      and (
        document.uploaded_by_employee_id = public.current_employee_id()
        or public.has_org_role('admin')
        or public.document_folder_has_permission(document.folder_id, 'view')
      )
  )
$function$;

create or replace function public.can_download_business_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.business_documents document
    where document.id = p_document_id
      and document.organization_id = public.current_organization_id()
      and (
        document.uploaded_by_employee_id = public.current_employee_id()
        or public.has_org_role('admin')
        or public.document_folder_has_permission(document.folder_id, 'download')
      )
  )
$function$;

create or replace function public.can_manage_business_document(p_document_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.business_documents document
    where document.id = p_document_id
      and document.organization_id = public.current_organization_id()
      and (
        document.uploaded_by_employee_id = public.current_employee_id()
        or public.has_org_role('chairman')
        or public.document_folder_has_permission(document.folder_id, 'manage')
      )
  )
$function$;

create or replace function public.create_folder_business_document(
  p_folder_id uuid,
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
  v_folder public.document_folders%rowtype;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  select * into v_folder
  from public.document_folders
  where id = p_folder_id
    and organization_id = v_actor.organization_id
    and status = 'active';

  if v_actor.id is null
    or v_folder.id is null
    or not public.document_folder_has_permission(v_folder.id, 'upload')
  then
    raise exception '当前账号无权上传到该文件夹' using errcode = '42501';
  end if;

  if p_category not in ('contract', 'customer', 'supplier', 'internal')
    or char_length(btrim(coalesce(p_title, ''))) not between 2 and 160
    or p_visibility not in ('organization', 'department', 'restricted')
    or p_file_size <= 0
    or p_file_size > 20971520
    or p_storage_path like '%..%'
    or p_storage_path not like v_actor.organization_id::text || '/' || v_folder.id::text || '/%'
  then
    raise exception '文件资料参数无效' using errcode = '22023';
  end if;

  if p_customer_id is not null and not exists (
    select 1 from public.customers customer
    where customer.id = p_customer_id
      and customer.organization_id = v_actor.organization_id
  ) then
    raise exception '关联客户不存在或无权访问' using errcode = '42501';
  end if;

  v_document_no := 'DXD-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.business_documents (
    organization_id,
    folder_id,
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
    v_folder.id,
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
    coalesce(p_viewer_role_codes, array[]::text[]),
    v_actor.id
  )
  returning id into v_document_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'business_document_uploaded',
    'business_document',
    v_document_id,
    '上传文件：' || btrim(p_title),
    jsonb_build_object(
      'document_no', v_document_no,
      'category', p_category,
      'folder_id', v_folder.id
    )
  );

  return v_document_id;
end;
$function$;

create or replace function public.archive_business_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_title text;
begin
  if not public.can_manage_business_document(p_document_id) then
    raise exception '无权归档此文件' using errcode = '42501';
  end if;

  update public.business_documents
  set status = 'archived'
  where id = p_document_id
    and organization_id = public.current_organization_id()
  returning title into v_title;

  if not found then
    raise exception '文件不存在' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  )
  values (
    public.current_organization_id(),
    v_actor_id,
    'business_document_archived',
    'business_document',
    p_document_id,
    '归档文件：' || v_title
  );
end;
$function$;

create or replace function public.record_business_document_download(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_title text;
begin
  if not public.can_download_business_document(p_document_id) then
    raise exception '无权下载此文件' using errcode = '42501';
  end if;

  select title into v_title
  from public.business_documents
  where id = p_document_id
    and organization_id = public.current_organization_id();

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  )
  values (
    public.current_organization_id(),
    public.current_employee_id(),
    'business_document_downloaded',
    'business_document',
    p_document_id,
    '下载文件：' || v_title
  );
end;
$function$;

alter table public.document_folders enable row level security;
alter table public.document_folder_role_permissions enable row level security;
alter table public.document_folder_department_permissions enable row level security;
alter table public.document_folder_employee_grants enable row level security;
alter table public.document_folder_access_requests enable row level security;

create policy document_folders_select_discoverable
on public.document_folders
for select
to authenticated
using (public.can_discover_document_folder(id));

create policy document_folder_employee_grants_select_authorized
on public.document_folder_employee_grants
for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    employee_id = public.current_employee_id()
    or public.has_org_role('admin')
  )
);

create policy document_folder_access_requests_select_authorized
on public.document_folder_access_requests
for select
to authenticated
using (public.can_view_approval_request(approval_request_id));

revoke all on table public.document_folders from anon, authenticated;
revoke all on table public.document_folder_role_permissions from anon, authenticated;
revoke all on table public.document_folder_department_permissions from anon, authenticated;
revoke all on table public.document_folder_employee_grants from anon, authenticated;
revoke all on table public.document_folder_access_requests from anon, authenticated;
grant select on table public.document_folders to authenticated;
grant select on table public.document_folder_employee_grants to authenticated;
grant select on table public.document_folder_access_requests to authenticated;

revoke all on function public.is_document_folder_owner(uuid) from public, anon;
revoke all on function public.document_folder_has_permission(uuid, text) from public, anon;
revoke all on function public.can_discover_document_folder(uuid) from public, anon;
revoke all on function public.list_document_folder_tree() from public, anon;
revoke all on function public.create_document_folder(uuid, text, text, integer) from public, anon;
revoke all on function public.resolve_document_folder_owner(uuid) from public, anon;
revoke all on function public.submit_document_folder_access_request(
  uuid, text, text, integer, boolean, text
) from public, anon;
revoke all on function public.grant_document_folder_access_after_approval()
from public, anon, authenticated;
revoke all on function public.process_document_folder_access_request(
  uuid, text, text, integer, integer, boolean
) from public, anon;
revoke all on function public.can_download_business_document(uuid) from public, anon;
revoke all on function public.create_folder_business_document(
  uuid, text, text, text, text, text, text, bigint, uuid, text, text, date, date, text, text[]
) from public, anon;

grant execute on function public.document_folder_has_permission(uuid, text) to authenticated;
grant execute on function public.list_document_folder_tree() to authenticated;
grant execute on function public.create_document_folder(uuid, text, text, integer) to authenticated;
grant execute on function public.submit_document_folder_access_request(
  uuid, text, text, integer, boolean, text
) to authenticated;
grant execute on function public.process_document_folder_access_request(
  uuid, text, text, integer, integer, boolean
) to authenticated;
grant execute on function public.can_download_business_document(uuid) to authenticated;
grant execute on function public.create_folder_business_document(
  uuid, text, text, text, text, text, text, bigint, uuid, text, text, date, date, text, text[]
) to authenticated;

revoke execute on function public.create_business_document(
  text, text, text, text, text, text, bigint, uuid, text, text, date, date, text, text[]
) from authenticated;

commit;
