begin;

-- 董事长是组织治理最高权限角色。数据库鉴权时，董事长满足任意长期角色检查。
-- 临时授权不会包含董事长，因此临时角色仍严格按所授角色生效。
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
        and (role.code = required_code or role.code = 'chairman')
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

-- 将已有董事长账号补齐全部长期角色，确保应用层精确角色判断也立即生效。
insert into public.employee_roles (employee_id, role_id)
select chairman_employee.id, organization_role.id
from public.employees chairman_employee
join public.employee_roles chairman_assignment
  on chairman_assignment.employee_id = chairman_employee.id
join public.roles chairman_role
  on chairman_role.id = chairman_assignment.role_id
 and chairman_role.organization_id = chairman_employee.organization_id
 and chairman_role.code = 'chairman'
join public.roles organization_role
  on organization_role.organization_id = chairman_employee.organization_id
 and organization_role.code in (
   'employee',
   'department_lead',
   'hr',
   'finance',
   'admin',
   'chairman'
 )
on conflict (employee_id, role_id) do nothing;

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
  3,
  '董事长全权限与逐人权限分配',
  jsonb_build_object(
    'role_codes', jsonb_build_array(
      'employee',
      'department_lead',
      'hr',
      'finance',
      'admin',
      'chairman'
    ),
    'chairman_permission_scope', 'all',
    'chairman_implies_all_roles', true,
    'assignment_scope', 'per_employee',
    'high_risk_confirmation', 'target_employee_name',
    'audit_event', 'employee_roles_updated'
  )
from public.organizations organization
on conflict (organization_id, template_key, version) do nothing;

commit;
