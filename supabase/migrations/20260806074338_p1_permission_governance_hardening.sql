begin;

create or replace function public.set_employee_roles(
  p_employee_id uuid,
  p_role_codes text[]
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
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以分配角色'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.employees employee
    where employee.id = p_employee_id
      and employee.organization_id = v_organization_id
  ) then
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
      '更新员工角色权限',
      jsonb_build_object(
        'before', to_jsonb(v_old_role_codes),
        'after', to_jsonb(v_new_role_codes)
      )
    );
  end if;
end
$function$;

create or replace function public.protect_last_governance_account()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_role_code text;
begin
  if tg_op = 'UPDATE'
    and (old.status <> 'active' or new.status = 'active')
  then
    return new;
  end if;

  lock table public.employee_roles in share row exclusive mode;

  for v_role_code in
    select role.code
    from public.employee_roles employee_role
    join public.roles role on role.id = employee_role.role_id
    where employee_role.employee_id = old.id
      and role.code in ('admin', 'chairman')
  loop
    if not exists (
      select 1
      from public.employee_roles employee_role
      join public.roles role on role.id = employee_role.role_id
      join public.employees employee on employee.id = employee_role.employee_id
      where role.organization_id = old.organization_id
        and role.code = v_role_code
        and employee.status = 'active'
        and employee.id <> old.id
    ) then
      raise exception '不能停用或删除组织中最后一位%',
        case v_role_code
          when 'admin' then '系统管理员'
          else '董事长'
        end
        using errcode = '23514';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$function$;

drop trigger if exists employees_protect_last_governance_account
on public.employees;
create trigger employees_protect_last_governance_account
before update of status or delete on public.employees
for each row execute function public.protect_last_governance_account();

-- PostgreSQL grants function execution to PUBLIC by default. Preserve signed-in
-- application access while closing every anonymous SECURITY DEFINER endpoint.
do $block$
declare
  v_function record;
  v_signature text;
begin
  for v_function in
    select
      namespace.nspname as schema_name,
      procedure.proname as function_name,
      pg_get_function_identity_arguments(procedure.oid) as identity_arguments,
      procedure.prorettype = 'trigger'::regtype as is_trigger
    from pg_proc procedure
    join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.prosecdef
  loop
    v_signature := format(
      '%I.%I(%s)',
      v_function.schema_name,
      v_function.function_name,
      v_function.identity_arguments
    );
    execute format('revoke execute on function %s from public, anon', v_signature);
    if not v_function.is_trigger then
      execute format('grant execute on function %s to authenticated', v_signature);
    else
      execute format('revoke execute on function %s from authenticated', v_signature);
    end if;
  end loop;
end
$block$;

commit;
