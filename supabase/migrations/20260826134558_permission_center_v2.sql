-- Permission Center V2: configurable roles and explainable effective access.
-- This runs beside the legacy fixed roles so existing workflows remain stable.

begin;

create table public.access_permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,4}$'),
  module text not null check (module ~ '^[a-z][a-z0-9_]{1,39}$'),
  resource text not null,
  action text not null,
  name text not null,
  description text,
  risk_level text not null default 'normal'
    check (risk_level in ('normal', 'sensitive', 'high')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.access_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]{2,39}$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  description text,
  source_role_code text check (
    source_role_code is null or source_role_code in
      ('employee', 'department_lead', 'hr', 'finance', 'admin', 'chairman')
  ),
  is_system boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, source_role_code)
);

create table public.access_role_permissions (
  role_id uuid not null references public.access_roles(id) on delete cascade,
  permission_id uuid not null references public.access_permissions(id) on delete cascade,
  effect text not null default 'allow' check (effect in ('allow', 'deny')),
  data_scope text not null default 'organization'
    check (data_scope in ('self', 'department', 'department_tree', 'assigned', 'organization')),
  field_access text not null default 'full'
    check (field_access in ('masked', 'read', 'full')),
  created_at timestamptz not null default now(),
  primary key (role_id, permission_id)
);

create table public.employee_access_roles (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid not null references public.access_roles(id) on delete cascade,
  assigned_by_employee_id uuid references public.employees(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (employee_id, role_id)
);

create index access_roles_org_status_idx
  on public.access_roles (organization_id, status, name);
create index access_role_permissions_permission_idx
  on public.access_role_permissions (permission_id, role_id);
create index employee_access_roles_org_employee_idx
  on public.employee_access_roles (organization_id, employee_id);

create trigger access_roles_set_updated_at
before update on public.access_roles
for each row execute function public.set_updated_at();

alter table public.access_permissions enable row level security;
alter table public.access_roles enable row level security;
alter table public.access_role_permissions enable row level security;
alter table public.employee_access_roles enable row level security;

create policy access_permissions_governance_read
on public.access_permissions for select to authenticated
using (public.has_org_role('admin') or public.has_org_role('chairman'));

create policy access_roles_governance_read
on public.access_roles for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (public.has_org_role('admin') or public.has_org_role('chairman'))
);

create policy access_role_permissions_governance_read
on public.access_role_permissions for select to authenticated
using (
  exists (
    select 1 from public.access_roles access_role
    where access_role.id = role_id
      and access_role.organization_id = public.current_organization_id()
  )
  and (public.has_org_role('admin') or public.has_org_role('chairman'))
);

create policy employee_access_roles_governance_read
on public.employee_access_roles for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (public.has_org_role('admin') or public.has_org_role('chairman'))
);

revoke all on table public.access_permissions from public, anon, authenticated;
revoke all on table public.access_roles from public, anon, authenticated;
revoke all on table public.access_role_permissions from public, anon, authenticated;
revoke all on table public.employee_access_roles from public, anon, authenticated;
grant select on table public.access_permissions to authenticated;
grant select on table public.access_roles to authenticated;
grant select on table public.access_role_permissions to authenticated;
grant select on table public.employee_access_roles to authenticated;

insert into public.access_permissions
  (code, module, resource, action, name, description, risk_level, sort_order)
values
  ('system.role.view', 'system', 'role', 'view', '查看角色', '查看角色、成员和权限配置', 'sensitive', 10),
  ('system.role.manage', 'system', 'role', 'manage', '管理角色', '创建角色并发布权限配置', 'high', 20),
  ('system.permission.explain', 'system', 'permission', 'explain', '查询最终权限', '解释员工权限来源和数据范围', 'sensitive', 30),
  ('finance.receivable.view', 'finance', 'receivable', 'view', '查看应收', '查看授权范围内应收账款', 'sensitive', 100),
  ('finance.payable.view', 'finance', 'payable', 'view', '查看应付', '查看授权范围内应付账款', 'sensitive', 110),
  ('finance.payment.submit', 'finance', 'payment', 'submit', '提交付款', '创建并提交付款单', 'high', 120),
  ('finance.payment.approve', 'finance', 'payment', 'approve', '审批付款', '审批授权金额范围内付款', 'high', 130),
  ('finance.payment.execute', 'finance', 'payment', 'execute', '执行付款', '登记实际资金支付结果', 'high', 140),
  ('finance.voucher.create', 'finance', 'voucher', 'create', '凭证制单', '创建会计凭证草稿', 'sensitive', 150),
  ('finance.voucher.review', 'finance', 'voucher', 'review', '凭证审核', '审核其他人员创建的凭证', 'high', 160),
  ('finance.voucher.post', 'finance', 'voucher', 'post', '凭证过账', '将已审核凭证不可逆记账', 'high', 170),
  ('finance.period.close', 'finance', 'period', 'close', '期间结账', '关闭会计期间并锁定记账', 'high', 180),
  ('finance.report.export', 'finance', 'report', 'export', '导出财务报表', '导出授权账簿和组织的财务报表', 'sensitive', 190)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  risk_level = excluded.risk_level,
  sort_order = excluded.sort_order;

insert into public.access_roles
  (organization_id, code, name, description, source_role_code, is_system)
select organization.id, seed.code, seed.name, seed.description, seed.code, true
from public.organizations organization
cross join (values
  ('employee', '普通员工', '个人业务基础权限'),
  ('department_lead', '部门负责人', '部门范围业务权限'),
  ('hr', '人事行政', '人事行政业务权限'),
  ('finance', '财务', '财务业务与核算权限'),
  ('admin', '系统管理员', '系统配置权限，不默认获得业务数据'),
  ('chairman', '董事长', '组织治理与经营全局权限')
) as seed(code, name, description)
on conflict (organization_id, code) do nothing;

insert into public.access_role_permissions
  (role_id, permission_id, effect, data_scope, field_access)
select access_role.id, permission.id, 'allow',
  case when access_role.source_role_code = 'department_lead' then 'department_tree' else 'organization' end,
  case when access_role.source_role_code = 'chairman' then 'read' else 'full' end
from public.access_roles access_role
join public.access_permissions permission on (
  access_role.source_role_code = 'finance' and permission.module = 'finance'
) or (
  access_role.source_role_code = 'admin' and permission.module = 'system'
) or (
  access_role.source_role_code = 'chairman' and permission.action in ('view', 'explain', 'export')
)
on conflict (role_id, permission_id) do nothing;

create or replace function public.create_access_role(
  p_code text,
  p_name text,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_role_id uuid;
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以创建自定义角色' using errcode = '42501';
  end if;

  if p_code !~ '^[a-z][a-z0-9_]{2,39}$'
    or char_length(btrim(coalesce(p_name, ''))) not between 2 and 40
  then
    raise exception '角色参数无效' using errcode = '22023';
  end if;

  insert into public.access_roles (
    organization_id, code, name, description, created_by_employee_id
  ) values (
    v_organization_id, lower(btrim(p_code)), btrim(p_name),
    nullif(btrim(coalesce(p_description, '')), ''), v_actor_id
  ) returning id into v_role_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'access_role_created', 'access_role', v_role_id,
    '创建自定义角色 ' || btrim(p_name), jsonb_build_object('code', lower(btrim(p_code)))
  );

  return v_role_id;
end;
$function$;

create or replace function public.configure_access_role(
  p_role_id uuid,
  p_grants jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_role public.access_roles%rowtype;
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以配置权限' using errcode = '42501';
  end if;

  select * into v_role from public.access_roles
  where id = p_role_id and organization_id = v_organization_id
  for update;

  if v_role.id is null or v_role.is_system then
    raise exception '角色不存在或系统角色不可直接修改' using errcode = '42501';
  end if;
  if jsonb_typeof(coalesce(p_grants, '[]'::jsonb)) <> 'array' then
    raise exception '权限配置格式无效' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_grants) as item(code text, effect text, data_scope text, field_access text)
    left join public.access_permissions permission on permission.code = item.code
    where permission.id is null
      or item.effect not in ('allow', 'deny')
      or item.data_scope not in ('self', 'department', 'department_tree', 'assigned', 'organization')
      or item.field_access not in ('masked', 'read', 'full')
  ) then
    raise exception '包含无效权限项' using errcode = '22023';
  end if;

  delete from public.access_role_permissions where role_id = p_role_id;
  insert into public.access_role_permissions
    (role_id, permission_id, effect, data_scope, field_access)
  select p_role_id, permission.id, item.effect, item.data_scope, item.field_access
  from jsonb_to_recordset(p_grants) as item(code text, effect text, data_scope text, field_access text)
  join public.access_permissions permission on permission.code = item.code;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'access_role_configured', 'access_role', p_role_id,
    '更新自定义角色权限 ' || v_role.name,
    jsonb_build_object('grantCount', jsonb_array_length(p_grants))
  );
end;
$function$;

create or replace function public.assign_access_role(
  p_employee_id uuid,
  p_role_id uuid,
  p_assigned boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以分配自定义角色' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.employees employee
    where employee.id = p_employee_id and employee.organization_id = v_organization_id
  ) or not exists (
    select 1 from public.access_roles access_role
    where access_role.id = p_role_id and access_role.organization_id = v_organization_id
      and access_role.is_system = false and access_role.status = 'active'
  ) then
    raise exception '员工或自定义角色无效' using errcode = '22023';
  end if;

  if p_assigned then
    insert into public.employee_access_roles
      (organization_id, employee_id, role_id, assigned_by_employee_id)
    values (v_organization_id, p_employee_id, p_role_id, v_actor_id)
    on conflict (employee_id, role_id) do nothing;
  else
    delete from public.employee_access_roles
    where employee_id = p_employee_id and role_id = p_role_id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'employee_access_role_changed', 'employee', p_employee_id,
    case when p_assigned then '分配自定义角色' else '移除自定义角色' end,
    jsonb_build_object('roleId', p_role_id, 'assigned', p_assigned)
  );
end;
$function$;

create or replace function public.effective_employee_permissions(p_employee_id uuid)
returns table (
  permission_code text,
  permission_name text,
  module text,
  risk_level text,
  effect text,
  data_scope text,
  field_access text,
  source_roles text[]
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with authorized_target as (
    select employee.id
    from public.employees employee
    where employee.id = p_employee_id
      and employee.organization_id = public.current_organization_id()
      and (
        employee.id = public.current_employee_id()
        or public.has_org_role('admin')
        or public.has_org_role('chairman')
      )
  ), applicable_roles as (
    select access_role.id, access_role.name
    from public.access_roles access_role
    join public.roles legacy_role
      on legacy_role.organization_id = access_role.organization_id
     and legacy_role.code = access_role.source_role_code
    join public.employee_roles employee_role
      on employee_role.role_id = legacy_role.id
     and employee_role.employee_id = p_employee_id
    where access_role.organization_id = public.current_organization_id()
      and access_role.status = 'active'
      and exists (select 1 from authorized_target)
    union
    select access_role.id, access_role.name
    from public.access_roles access_role
    join public.temporary_role_grants temporary_grant
      on temporary_grant.organization_id = access_role.organization_id
     and temporary_grant.employee_id = p_employee_id
     and temporary_grant.status = 'active'
     and temporary_grant.starts_at <= now()
     and temporary_grant.expires_at > now()
    join public.roles legacy_role
      on legacy_role.id = temporary_grant.role_id
     and legacy_role.code = access_role.source_role_code
    where access_role.status = 'active'
      and exists (select 1 from authorized_target)
    union
    select access_role.id, access_role.name
    from public.access_roles access_role
    join public.employee_access_roles assignment on assignment.role_id = access_role.id
    where assignment.employee_id = p_employee_id
      and assignment.organization_id = public.current_organization_id()
      and access_role.status = 'active'
      and exists (select 1 from authorized_target)
  ), resolved as (
    select
      permission.code,
      permission.name,
      permission.module,
      permission.risk_level,
      case when bool_or(grant_row.effect = 'deny') then 'deny' else 'allow' end as effect,
      (array_agg(grant_row.data_scope order by
        case grant_row.data_scope
          when 'organization' then 5 when 'department_tree' then 4
          when 'department' then 3 when 'assigned' then 2 else 1 end desc
      ))[1] as data_scope,
      (array_agg(grant_row.field_access order by
        case grant_row.field_access when 'full' then 3 when 'read' then 2 else 1 end desc
      ))[1] as field_access,
      array_agg(distinct applicable_role.name order by applicable_role.name) as source_roles
    from applicable_roles applicable_role
    join public.access_role_permissions grant_row on grant_row.role_id = applicable_role.id
    join public.access_permissions permission on permission.id = grant_row.permission_id
    group by permission.code, permission.name, permission.module, permission.risk_level
  )
  select resolved.code, resolved.name, resolved.module, resolved.risk_level,
    resolved.effect, resolved.data_scope, resolved.field_access, resolved.source_roles
  from resolved
  order by resolved.module, resolved.code
$function$;

create or replace function public.has_access_permission(p_permission_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with applicable_roles as (
    select access_role.id
    from public.access_roles access_role
    join public.roles legacy_role
      on legacy_role.organization_id = access_role.organization_id
     and legacy_role.code = access_role.source_role_code
    join public.employee_roles employee_role
      on employee_role.role_id = legacy_role.id
     and employee_role.employee_id = public.current_employee_id()
    where access_role.organization_id = public.current_organization_id()
      and access_role.status = 'active'
    union
    select access_role.id
    from public.access_roles access_role
    join public.temporary_role_grants temporary_grant
      on temporary_grant.organization_id = access_role.organization_id
     and temporary_grant.employee_id = public.current_employee_id()
     and temporary_grant.status = 'active'
     and temporary_grant.starts_at <= now()
     and temporary_grant.expires_at > now()
    join public.roles legacy_role
      on legacy_role.id = temporary_grant.role_id
     and legacy_role.code = access_role.source_role_code
    where access_role.status = 'active'
    union
    select access_role.id
    from public.access_roles access_role
    join public.employee_access_roles assignment on assignment.role_id = access_role.id
    where assignment.employee_id = public.current_employee_id()
      and assignment.organization_id = public.current_organization_id()
      and access_role.status = 'active'
  ), matching_grants as (
    select grant_row.effect
    from applicable_roles applicable_role
    join public.access_role_permissions grant_row on grant_row.role_id = applicable_role.id
    join public.access_permissions permission on permission.id = grant_row.permission_id
    where permission.code = p_permission_code
  )
  select coalesce(
    bool_or(effect = 'allow') and not bool_or(effect = 'deny'),
    false
  )
  from matching_grants
$function$;

revoke all on function public.create_access_role(text, text, text) from public, anon;
revoke all on function public.configure_access_role(uuid, jsonb) from public, anon;
revoke all on function public.assign_access_role(uuid, uuid, boolean) from public, anon;
revoke all on function public.effective_employee_permissions(uuid) from public, anon;
revoke all on function public.has_access_permission(text) from public, anon;
grant execute on function public.create_access_role(text, text, text) to authenticated;
grant execute on function public.configure_access_role(uuid, jsonb) to authenticated;
grant execute on function public.assign_access_role(uuid, uuid, boolean) to authenticated;
grant execute on function public.effective_employee_permissions(uuid) to authenticated;
grant execute on function public.has_access_permission(text) to authenticated;

commit;
