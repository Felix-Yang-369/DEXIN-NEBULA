begin;

create or replace function public.manage_employee_profile(
  p_employee_id uuid,
  p_department_id uuid,
  p_manager_id uuid,
  p_employee_no text,
  p_name text,
  p_email text,
  p_title text,
  p_hired_on date,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_employee_id uuid;
begin
  if v_actor_id is null
    or not (
      public.has_org_role('admin')
      or public.has_org_role('hr')
    )
  then
    raise exception '只有人事或管理员可以维护员工档案'
      using errcode = '42501';
  end if;

  if char_length(btrim(p_employee_no)) < 2
    or char_length(btrim(p_name)) < 2
    or position('@' in p_email) < 2
  then
    raise exception '员工编号、姓名或邮箱格式不正确'
      using errcode = '22023';
  end if;

  if p_status not in ('active', 'inactive') then
    raise exception '员工状态无效'
      using errcode = '22023';
  end if;

  if p_department_id is not null
    and not exists (
      select 1
      from public.departments
      where id = p_department_id
        and organization_id = v_organization_id
        and status = 'active'
    )
  then
    raise exception '部门不存在或已停用'
      using errcode = '23514';
  end if;

  if p_manager_id is not null
    and not exists (
      select 1
      from public.employees
      where id = p_manager_id
        and organization_id = v_organization_id
        and status = 'active'
    )
  then
    raise exception '直属负责人不存在或已停用'
      using errcode = '23514';
  end if;

  if p_employee_id is null then
    insert into public.employees (
      organization_id,
      department_id,
      manager_id,
      employee_no,
      name,
      email,
      title,
      hired_on,
      status
    )
    values (
      v_organization_id,
      p_department_id,
      p_manager_id,
      btrim(p_employee_no),
      btrim(p_name),
      lower(btrim(p_email)),
      nullif(btrim(coalesce(p_title, '')), ''),
      p_hired_on,
      p_status
    )
    returning id into v_employee_id;
  else
    if not exists (
      select 1
      from public.employees
      where id = p_employee_id
        and organization_id = v_organization_id
    )
    then
      raise exception '员工不存在或不属于当前组织'
        using errcode = '42501';
    end if;

    if p_manager_id = p_employee_id then
      raise exception '员工不能设置自己为直属负责人'
        using errcode = '23514';
    end if;

    if p_employee_id = v_actor_id and p_status = 'inactive' then
      raise exception '不能停用当前登录账号'
        using errcode = '23514';
    end if;

    update public.employees
    set
      department_id = p_department_id,
      manager_id = p_manager_id,
      employee_no = btrim(p_employee_no),
      name = btrim(p_name),
      email = lower(btrim(p_email)),
      title = nullif(btrim(coalesce(p_title, '')), ''),
      hired_on = p_hired_on,
      status = p_status
    where id = p_employee_id;

    v_employee_id := p_employee_id;
  end if;

  return v_employee_id;
exception
  when unique_violation then
    raise exception '员工编号或邮箱已存在'
      using errcode = '23505';
end;
$$;

create or replace function public.set_employee_roles(
  p_employee_id uuid,
  p_role_codes text[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
begin
  if v_actor_id is null or not public.has_org_role('admin') then
    raise exception '只有系统管理员可以分配角色'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.employees
    where id = p_employee_id
      and organization_id = v_organization_id
  )
  then
    raise exception '员工不存在或不属于当前组织'
      using errcode = '42501';
  end if;

  if coalesce(array_length(p_role_codes, 1), 0) = 0
    or not ('employee' = any(p_role_codes))
  then
    raise exception '每位员工至少需要普通员工角色'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_role_codes) as requested(code)
    where requested.code not in (
      'employee',
      'department_lead',
      'hr',
      'finance',
      'admin',
      'chairman'
    )
  )
  then
    raise exception '包含无效角色'
      using errcode = '22023';
  end if;

  if p_employee_id = v_actor_id
    and not ('admin' = any(p_role_codes))
  then
    raise exception '不能移除当前账号的管理员角色'
      using errcode = '23514';
  end if;

  delete from public.employee_roles
  where employee_id = p_employee_id;

  insert into public.employee_roles (employee_id, role_id)
  select p_employee_id, role.id
  from public.roles role
  where role.organization_id = v_organization_id
    and role.code = any(p_role_codes);

  if (
    select count(*)
    from public.employee_roles
    where employee_id = p_employee_id
  ) <> (
    select count(distinct requested.code)
    from unnest(p_role_codes) as requested(code)
  )
  then
    raise exception '组织角色尚未初始化完整'
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.link_employee_auth_user(
  p_employee_id uuid,
  p_auth_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_organization_id uuid := public.current_organization_id();
  v_employee_email text;
  v_auth_email text;
begin
  if public.current_employee_id() is null
    or not public.has_org_role('admin')
  then
    raise exception '只有系统管理员可以绑定登录账号'
      using errcode = '42501';
  end if;

  select email
  into v_employee_email
  from public.employees
  where id = p_employee_id
    and organization_id = v_organization_id;

  if v_employee_email is null then
    raise exception '员工不存在或不属于当前组织'
      using errcode = '42501';
  end if;

  select email
  into v_auth_email
  from auth.users
  where id = p_auth_user_id;

  if v_auth_email is null then
    raise exception 'Supabase Auth 用户不存在'
      using errcode = '23503';
  end if;

  if lower(v_employee_email) <> lower(v_auth_email) then
    raise exception 'Auth 邮箱与员工档案邮箱不一致'
      using errcode = '23514';
  end if;

  update public.employees
  set auth_user_id = p_auth_user_id
  where id = p_employee_id;
exception
  when unique_violation then
    raise exception '该 Auth 用户已绑定其他员工'
      using errcode = '23505';
end;
$$;

revoke all on function public.manage_employee_profile(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text
) from public;
revoke all on function public.set_employee_roles(uuid, text[]) from public;
revoke all on function public.link_employee_auth_user(uuid, uuid) from public;

grant execute on function public.manage_employee_profile(
  uuid,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  date,
  text
) to authenticated;
grant execute on function public.set_employee_roles(uuid, text[])
  to authenticated;
grant execute on function public.link_employee_auth_user(uuid, uuid)
  to authenticated;

commit;
