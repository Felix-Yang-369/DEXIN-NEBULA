begin;

create table public.temporary_role_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 200),
  status text not null default 'active' check (status in ('active', 'revoked')),
  granted_by_employee_id uuid not null references public.employees(id),
  revoked_by_employee_id uuid references public.employees(id),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > starts_at),
  check (expires_at <= starts_at + interval '30 days'),
  check (
    (status = 'active' and revoked_at is null and revoked_by_employee_id is null)
    or (status = 'revoked' and revoked_at is not null and revoked_by_employee_id is not null)
  )
);

create index temporary_role_grants_active_lookup_idx
  on public.temporary_role_grants (employee_id, role_id, expires_at)
  where status = 'active';
create index temporary_role_grants_org_created_idx
  on public.temporary_role_grants (organization_id, created_at desc);

alter table public.temporary_role_grants enable row level security;

create or replace function public.has_org_role(required_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    exists (
      select 1
      from public.employee_roles employee_role
      join public.roles role on role.id = employee_role.role_id
      join public.employees employee on employee.id = employee_role.employee_id
      where employee_role.employee_id = public.current_employee_id()
        and employee.organization_id = public.current_organization_id()
        and role.organization_id = employee.organization_id
        and role.code = required_code
    )
    or exists (
      select 1
      from public.temporary_role_grants temporary_grant
      join public.roles role on role.id = temporary_grant.role_id
      join public.employees employee on employee.id = temporary_grant.employee_id
      where temporary_grant.employee_id = public.current_employee_id()
        and temporary_grant.organization_id = public.current_organization_id()
        and employee.organization_id = temporary_grant.organization_id
        and employee.status = 'active'
        and role.organization_id = temporary_grant.organization_id
        and role.code = required_code
        and temporary_grant.status = 'active'
        and temporary_grant.starts_at <= now()
        and temporary_grant.expires_at > now()
    )
$function$;

revoke all on function public.has_org_role(text) from public, anon;
grant execute on function public.has_org_role(text) to authenticated;

create policy temporary_role_grants_authorized_read
on public.temporary_role_grants for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    employee_id = public.current_employee_id()
    or public.has_org_role('admin')
    or public.has_org_role('chairman')
  )
);

revoke all on table public.temporary_role_grants from public, anon, authenticated;
grant select on table public.temporary_role_grants to authenticated;

create or replace function public.grant_temporary_role(
  p_employee_id uuid,
  p_role_code text,
  p_duration_hours integer,
  p_reason text
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
  v_employee_name text;
  v_grant_id uuid;
  v_expires_at timestamptz;
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以创建临时授权'
      using errcode = '42501';
  end if;

  if p_role_code not in ('department_lead', 'hr', 'finance') then
    raise exception '临时授权不支持系统管理员、董事长或普通员工角色'
      using errcode = '22023';
  end if;

  if p_duration_hours not between 1 and 720
    or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 200
  then
    raise exception '临时授权期限或原因无效'
      using errcode = '22023';
  end if;

  select employee.name
  into v_employee_name
  from public.employees employee
  where employee.id = p_employee_id
    and employee.organization_id = v_organization_id
    and employee.status = 'active';

  if v_employee_name is null then
    raise exception '临时授权目标员工不存在或未在职'
      using errcode = '23514';
  end if;

  select role.id
  into v_role_id
  from public.roles role
  where role.organization_id = v_organization_id
    and role.code = p_role_code;

  if v_role_id is null then
    raise exception '组织角色尚未初始化完整'
      using errcode = '23514';
  end if;

  if exists (
    select 1 from public.employee_roles employee_role
    where employee_role.employee_id = p_employee_id
      and employee_role.role_id = v_role_id
  ) then
    raise exception '目标员工已经永久拥有该角色'
      using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_organization_id::text || ':' || p_employee_id::text || ':' || p_role_code, 0)
  );

  if exists (
    select 1 from public.temporary_role_grants temporary_grant
    where temporary_grant.employee_id = p_employee_id
      and temporary_grant.role_id = v_role_id
      and temporary_grant.status = 'active'
      and temporary_grant.expires_at > now()
  ) then
    raise exception '目标员工已有未到期的同角色临时授权'
      using errcode = '23514';
  end if;

  v_expires_at := now() + make_interval(hours => p_duration_hours);

  insert into public.temporary_role_grants (
    organization_id,
    employee_id,
    role_id,
    expires_at,
    reason,
    granted_by_employee_id
  ) values (
    v_organization_id,
    p_employee_id,
    v_role_id,
    v_expires_at,
    btrim(p_reason),
    v_actor_id
  )
  returning id into v_grant_id;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  ) values (
    v_organization_id,
    v_actor_id,
    'temporary_role_granted',
    'temporary_role_grant',
    v_grant_id,
    '授予临时角色 ' || p_role_code || ' 给 ' || v_employee_name,
    jsonb_build_object(
      'target_employee_id', p_employee_id,
      'target_name', v_employee_name,
      'role_code', p_role_code,
      'duration_hours', p_duration_hours,
      'expires_at', v_expires_at,
      'reason', btrim(p_reason)
    )
  );

  return v_grant_id;
end
$function$;

create or replace function public.revoke_temporary_role(
  p_grant_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_grant public.temporary_role_grants%rowtype;
  v_target_name text;
  v_role_code text;
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以撤销临时授权'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) not between 5 and 200 then
    raise exception '撤销临时授权必须填写原因'
      using errcode = '22023';
  end if;

  select *
  into v_grant
  from public.temporary_role_grants temporary_grant
  where temporary_grant.id = p_grant_id
    and temporary_grant.organization_id = v_organization_id
  for update;

  if v_grant.id is null
    or v_grant.status <> 'active'
    or v_grant.expires_at <= now()
  then
    raise exception '临时授权不存在、已撤销或已到期'
      using errcode = '23514';
  end if;

  select employee.name, role.code
  into v_target_name, v_role_code
  from public.employees employee
  join public.roles role on role.id = v_grant.role_id
  where employee.id = v_grant.employee_id;

  update public.temporary_role_grants
  set
    status = 'revoked',
    revoked_by_employee_id = v_actor_id,
    revoked_at = now()
  where id = v_grant.id;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  ) values (
    v_organization_id,
    v_actor_id,
    'temporary_role_revoked',
    'temporary_role_grant',
    v_grant.id,
    '撤销 ' || v_target_name || ' 的临时角色 ' || v_role_code,
    jsonb_build_object(
      'target_employee_id', v_grant.employee_id,
      'target_name', v_target_name,
      'role_code', v_role_code,
      'original_expires_at', v_grant.expires_at,
      'reason', btrim(p_reason)
    )
  );
end
$function$;

revoke all on function public.grant_temporary_role(uuid, text, integer, text)
from public, anon;
grant execute on function public.grant_temporary_role(uuid, text, integer, text)
to authenticated;
revoke all on function public.revoke_temporary_role(uuid, text)
from public, anon;
grant execute on function public.revoke_temporary_role(uuid, text)
to authenticated;

insert into public.permission_template_versions (
  organization_id,
  template_key,
  version,
  change_note,
  snapshot
)
select
  organization.id,
  'core_rbac',
  2,
  'P3 临时授权与自动到期',
  jsonb_build_object(
    'role_codes', jsonb_build_array(
      'employee',
      'department_lead',
      'hr',
      'finance',
      'admin',
      'chairman'
    ),
    'temporary_role_codes', jsonb_build_array('department_lead', 'hr', 'finance'),
    'temporary_grant_max_hours', 720,
    'temporary_governance_roles_forbidden', true,
    'automatic_expiry', true,
    'audit_events', jsonb_build_array('temporary_role_granted', 'temporary_role_revoked')
  )
from public.organizations organization
on conflict (organization_id, template_key, version) do nothing;

commit;
