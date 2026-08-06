begin;

create table if not exists public.permission_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_key text not null check (template_key ~ '^[a-z][a-z0-9_]{2,39}$'),
  version integer not null check (version > 0),
  change_note text not null check (char_length(btrim(change_note)) between 2 and 200),
  snapshot jsonb not null check (jsonb_typeof(snapshot) = 'object'),
  created_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (organization_id, template_key, version)
);

create index if not exists permission_template_versions_lookup_idx
  on public.permission_template_versions (organization_id, template_key, version desc);

alter table public.permission_template_versions enable row level security;

drop policy if exists permission_template_versions_governance_read
  on public.permission_template_versions;
create policy permission_template_versions_governance_read
on public.permission_template_versions for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_org_role('admin')
    or public.has_org_role('chairman')
  )
);

revoke all on table public.permission_template_versions from public, anon, authenticated;
grant select on table public.permission_template_versions to authenticated;

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
  1,
  'P2 权限治理基线',
  jsonb_build_object(
    'role_codes', jsonb_build_array(
      'employee',
      'department_lead',
      'hr',
      'finance',
      'admin',
      'chairman'
    ),
    'high_risk_roles', jsonb_build_array('admin', 'chairman'),
    'system_admin_business_access', 'explicit_only',
    'high_risk_confirmation', 'target_employee_name',
    'audit_event', 'employee_roles_updated'
  )
from public.organizations organization
on conflict (organization_id, template_key, version) do nothing;

create or replace function public.set_employee_roles(
  p_employee_id uuid,
  p_role_codes text[],
  p_high_risk_confirmation text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_old_role_codes text[];
  v_new_role_codes text[];
  v_target_name text;
  v_high_risk_change boolean;
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以分配角色'
      using errcode = '42501';
  end if;

  select employee.name
  into v_target_name
  from public.employees employee
  where employee.id = p_employee_id
    and employee.organization_id = v_organization_id;

  if v_target_name is null then
    raise exception '员工不存在或不属于当前组织'
      using errcode = '42501';
  end if;

  select array_agg(distinct requested.code order by requested.code)
  into v_new_role_codes
  from unnest(p_role_codes) as requested(code);

  if coalesce(array_length(v_new_role_codes, 1), 0) = 0
    or not ('employee' = any(v_new_role_codes))
  then
    raise exception '每位员工至少需要普通员工角色'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(v_new_role_codes) as requested(code)
    where requested.code not in (
      'employee',
      'department_lead',
      'hr',
      'finance',
      'admin',
      'chairman'
    )
  ) then
    raise exception '包含无效角色'
      using errcode = '22023';
  end if;

  -- Serialize governance-role changes so two administrators cannot remove the
  -- final holder concurrently.
  lock table public.employee_roles in share row exclusive mode;

  select coalesce(array_agg(role.code order by role.code), array[]::text[])
  into v_old_role_codes
  from public.employee_roles employee_role
  join public.roles role on role.id = employee_role.role_id
  where employee_role.employee_id = p_employee_id;

  v_high_risk_change :=
    ('admin' = any(v_old_role_codes)) is distinct from ('admin' = any(v_new_role_codes))
    or ('chairman' = any(v_old_role_codes)) is distinct from ('chairman' = any(v_new_role_codes));

  if v_high_risk_change
    and btrim(coalesce(p_high_risk_confirmation, '')) <> v_target_name
  then
    raise exception '高危角色变更必须输入目标员工姓名确认'
      using errcode = '23514';
  end if;

  if p_employee_id = v_actor_id
    and not ('admin' = any(v_new_role_codes))
  then
    raise exception '不能移除当前账号的管理员角色'
      using errcode = '23514';
  end if;

  if 'admin' = any(v_old_role_codes)
    and not ('admin' = any(v_new_role_codes))
    and not exists (
      select 1
      from public.employee_roles employee_role
      join public.roles role on role.id = employee_role.role_id
      join public.employees employee on employee.id = employee_role.employee_id
      where role.organization_id = v_organization_id
        and role.code = 'admin'
        and employee.status = 'active'
        and employee.id <> p_employee_id
    )
  then
    raise exception '不能移除组织中最后一位系统管理员'
      using errcode = '23514';
  end if;

  if 'chairman' = any(v_old_role_codes)
    and not ('chairman' = any(v_new_role_codes))
    and not exists (
      select 1
      from public.employee_roles employee_role
      join public.roles role on role.id = employee_role.role_id
      join public.employees employee on employee.id = employee_role.employee_id
      where role.organization_id = v_organization_id
        and role.code = 'chairman'
        and employee.status = 'active'
        and employee.id <> p_employee_id
    )
  then
    raise exception '不能移除组织中最后一位董事长'
      using errcode = '23514';
  end if;

  delete from public.employee_roles
  where employee_id = p_employee_id;

  insert into public.employee_roles (employee_id, role_id)
  select p_employee_id, role.id
  from public.roles role
  where role.organization_id = v_organization_id
    and role.code = any(v_new_role_codes);

  if (
    select count(*) from public.employee_roles
    where employee_id = p_employee_id
  ) <> coalesce(array_length(v_new_role_codes, 1), 0)
  then
    raise exception '组织角色尚未初始化完整'
      using errcode = '23514';
  end if;

  if v_old_role_codes is distinct from v_new_role_codes then
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
      'employee_roles_updated',
      'employee',
      p_employee_id,
      case
        when v_high_risk_change then '更新员工高危角色权限'
        else '更新员工角色权限'
      end,
      jsonb_build_object(
        'before', to_jsonb(v_old_role_codes),
        'after', to_jsonb(v_new_role_codes),
        'high_risk', v_high_risk_change,
        'target_name', v_target_name,
        'template_key', 'core_rbac'
      )
    );
  end if;
end
$function$;

drop function if exists public.set_employee_roles(uuid, text[]);

revoke all on function public.set_employee_roles(uuid, text[], text)
from public, anon;
grant execute on function public.set_employee_roles(uuid, text[], text)
to authenticated;

create or replace function public.publish_permission_template_version(
  p_template_key text,
  p_change_note text,
  p_snapshot jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_version integer;
  v_version_id uuid;
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以发布权限模板版本'
      using errcode = '42501';
  end if;

  if p_template_key !~ '^[a-z][a-z0-9_]{2,39}$'
    or char_length(btrim(coalesce(p_change_note, ''))) not between 2 and 200
    or jsonb_typeof(p_snapshot) <> 'object'
  then
    raise exception '权限模板版本参数无效'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(v_organization_id::text || ':' || p_template_key, 0)
  );

  select coalesce(max(template.version), 0) + 1
  into v_version
  from public.permission_template_versions template
  where template.organization_id = v_organization_id
    and template.template_key = p_template_key;

  insert into public.permission_template_versions (
    organization_id,
    template_key,
    version,
    change_note,
    snapshot,
    created_by_employee_id
  ) values (
    v_organization_id,
    p_template_key,
    v_version,
    btrim(p_change_note),
    p_snapshot,
    v_actor_id
  )
  returning id into v_version_id;

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
    'permission_template_published',
    'permission_template_version',
    v_version_id,
    '发布权限模板版本 ' || p_template_key || ' v' || v_version,
    jsonb_build_object(
      'template_key', p_template_key,
      'version', v_version,
      'change_note', btrim(p_change_note)
    )
  );

  return v_version;
end
$function$;

revoke all on function public.publish_permission_template_version(text, text, jsonb)
from public, anon;
grant execute on function public.publish_permission_template_version(text, text, jsonb)
to authenticated;

commit;
