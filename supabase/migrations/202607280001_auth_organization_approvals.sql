begin;

create extension if not exists pgcrypto;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  parent_id uuid references public.departments(id),
  name text not null,
  code text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.employees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  department_id uuid references public.departments(id),
  manager_id uuid references public.employees(id),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  employee_no text not null,
  name text not null,
  email text not null,
  title text,
  hired_on date,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_no),
  unique (organization_id, email)
);

alter table public.departments
  add column manager_employee_id uuid references public.employees(id);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  code text not null
    check (
      code in (
        'employee',
        'department_lead',
        'hr',
        'finance',
        'admin',
        'chairman'
      )
    ),
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.employee_roles (
  employee_id uuid not null references public.employees(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (employee_id, role_id)
);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  applicant_employee_id uuid not null references public.employees(id),
  current_approver_employee_id uuid references public.employees(id),
  leave_type text not null
    check (
      leave_type in (
        'welfare',
        'sick',
        'personal',
        'marriage',
        'bereavement',
        'maternity',
        'paternity',
        'work_injury',
        'other'
      )
    ),
  start_date date not null,
  end_date date not null,
  leave_days integer generated always as ((end_date - start_date) + 1) stored,
  reason text not null,
  handover text not null,
  is_emergency boolean not null default false,
  emergency_note text not null default '',
  status text not null default 'pending_department'
    check (
      status in (
        'draft',
        'pending_department',
        'pending_chairman',
        'pending_hr_filing',
        'approved',
        'returned',
        'rejected',
        'withdrawn'
      )
    ),
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  check (char_length(btrim(reason)) >= 5),
  check (char_length(btrim(handover)) >= 2),
  check (
    not is_emergency
    or char_length(btrim(emergency_note)) >= 5
  )
);

create table public.approval_actions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  leave_request_id uuid not null
    references public.leave_requests(id) on delete cascade,
  actor_employee_id uuid not null references public.employees(id),
  actor_role text not null,
  action text not null
    check (
      action in (
        'submitted',
        'department_approved',
        'chairman_approved',
        'hr_filed',
        'returned',
        'rejected',
        'resubmitted',
        'withdrawn'
      )
    ),
  opinion text not null default '',
  previous_status text not null,
  next_status text not null,
  created_at timestamptz not null default now()
);

create index employees_auth_user_id_idx
  on public.employees (auth_user_id);
create index employees_organization_id_idx
  on public.employees (organization_id);
create index employees_department_id_idx
  on public.employees (department_id);
create index employees_manager_id_idx
  on public.employees (manager_id);
create index roles_organization_code_idx
  on public.roles (organization_id, code);
create index employee_roles_employee_id_idx
  on public.employee_roles (employee_id);
create index leave_requests_applicant_idx
  on public.leave_requests (applicant_employee_id, created_at desc);
create index leave_requests_current_approver_idx
  on public.leave_requests (current_approver_employee_id, status);
create index leave_requests_organization_status_idx
  on public.leave_requests (organization_id, status);
create index approval_actions_request_idx
  on public.approval_actions (leave_request_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_updated_at();

create trigger employees_set_updated_at
before update on public.employees
for each row execute function public.set_updated_at();

create trigger leave_requests_set_updated_at
before update on public.leave_requests
for each row execute function public.set_updated_at();

create or replace function public.current_employee_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select id
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1
$$;

create or replace function public.current_organization_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select organization_id
  from public.employees
  where id = public.current_employee_id()
$$;

create or replace function public.has_org_role(required_code text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employee_roles er
    join public.roles r on r.id = er.role_id
    join public.employees e on e.id = er.employee_id
    where er.employee_id = public.current_employee_id()
      and e.organization_id = public.current_organization_id()
      and r.organization_id = e.organization_id
      and r.code = required_code
  )
$$;

create or replace function public.can_view_employee(target_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employees target
    where target.id = target_employee_id
      and target.organization_id = public.current_organization_id()
      and (
        target.id = public.current_employee_id()
        or target.manager_id = public.current_employee_id()
        or public.has_org_role('hr')
        or public.has_org_role('admin')
      )
  )
$$;

create or replace function public.can_view_leave_request(
  target_leave_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.leave_requests lr
    join public.employees applicant
      on applicant.id = lr.applicant_employee_id
    where lr.id = target_leave_request_id
      and lr.organization_id = public.current_organization_id()
      and (
        lr.applicant_employee_id = public.current_employee_id()
        or lr.current_approver_employee_id = public.current_employee_id()
        or applicant.manager_id = public.current_employee_id()
        or public.has_org_role('hr')
        or public.has_org_role('admin')
        or (
          public.has_org_role('chairman')
          and lr.leave_days > 1
        )
      )
  )
$$;

create or replace function public.find_active_role_holder(
  target_organization_id uuid,
  target_role_code text
)
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select e.id
  from public.employees e
  join public.employee_roles er on er.employee_id = e.id
  join public.roles r on r.id = er.role_id
  where e.organization_id = target_organization_id
    and e.status = 'active'
    and r.organization_id = target_organization_id
    and r.code = target_role_code
  order by e.created_at, e.id
  limit 1
$$;

alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.roles enable row level security;
alter table public.employee_roles enable row level security;
alter table public.leave_requests enable row level security;
alter table public.approval_actions enable row level security;

create policy organizations_select_current
on public.organizations
for select
to authenticated
using (id = (select public.current_organization_id()));

create policy departments_select_current
on public.departments
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
);

create policy employees_select_authorized
on public.employees
for select
to authenticated
using ((select public.can_view_employee(id)));

create policy roles_select_current
on public.roles
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
);

create policy employee_roles_select_authorized
on public.employee_roles
for select
to authenticated
using (
  employee_id = (select public.current_employee_id())
  or (select public.has_org_role('hr'))
  or (select public.has_org_role('admin'))
);

create policy leave_requests_select_authorized
on public.leave_requests
for select
to authenticated
using ((select public.can_view_leave_request(id)));

create policy approval_actions_select_authorized
on public.approval_actions
for select
to authenticated
using (
  (select public.can_view_leave_request(leave_request_id))
);

create or replace function public.submit_leave_request(
  p_leave_type text,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_handover text,
  p_is_emergency boolean default false,
  p_emergency_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_manager public.employees%rowtype;
  v_request_id uuid;
begin
  select *
  into v_employee
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_employee.id is null then
    raise exception '当前账号未绑定在职员工档案'
      using errcode = '42501';
  end if;

  if v_employee.manager_id is null then
    raise exception '员工尚未设置直属负责人，不能提交请假'
      using errcode = '23514';
  end if;

  select *
  into v_manager
  from public.employees
  where id = v_employee.manager_id
    and organization_id = v_employee.organization_id
    and status = 'active';

  if v_manager.id is null then
    raise exception '直属负责人无效或已停用'
      using errcode = '23514';
  end if;

  if p_leave_type not in (
    'welfare',
    'sick',
    'personal',
    'marriage',
    'bereavement',
    'maternity',
    'paternity',
    'work_injury',
    'other'
  ) then
    raise exception '请假类型无效'
      using errcode = '22023';
  end if;

  if p_end_date < p_start_date then
    raise exception '结束日期不能早于开始日期'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_reason)) < 5 then
    raise exception '请假事由至少填写 5 个字'
      using errcode = '22023';
  end if;

  if char_length(btrim(p_handover)) < 2 then
    raise exception '请填写工作交接安排'
      using errcode = '22023';
  end if;

  if p_is_emergency
    and char_length(btrim(coalesce(p_emergency_note, ''))) < 5
  then
    raise exception '请说明紧急情况和通知直属主管的方式'
      using errcode = '22023';
  end if;

  insert into public.leave_requests (
    organization_id,
    applicant_employee_id,
    current_approver_employee_id,
    leave_type,
    start_date,
    end_date,
    reason,
    handover,
    is_emergency,
    emergency_note,
    status,
    submitted_at
  )
  values (
    v_employee.organization_id,
    v_employee.id,
    v_manager.id,
    p_leave_type,
    p_start_date,
    p_end_date,
    btrim(p_reason),
    btrim(p_handover),
    coalesce(p_is_emergency, false),
    btrim(coalesce(p_emergency_note, '')),
    'pending_department',
    now()
  )
  returning id into v_request_id;

  insert into public.approval_actions (
    organization_id,
    leave_request_id,
    actor_employee_id,
    actor_role,
    action,
    opinion,
    previous_status,
    next_status
  )
  values (
    v_employee.organization_id,
    v_request_id,
    v_employee.id,
    'employee',
    'submitted',
    '提交请假申请',
    'draft',
    'pending_department'
  );

  return v_request_id;
end;
$$;

create or replace function public.process_leave_request(
  p_request_id uuid,
  p_action text,
  p_opinion text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.employees%rowtype;
  v_request public.leave_requests%rowtype;
  v_next_status text;
  v_next_approver uuid;
  v_history_action text;
  v_actor_role text;
  v_opinion text := btrim(coalesce(p_opinion, ''));
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null then
    raise exception '当前账号未绑定在职员工档案'
      using errcode = '42501';
  end if;

  select *
  into v_request
  from public.leave_requests
  where id = p_request_id
  for update;

  if v_request.id is null
    or v_request.organization_id <> v_actor.organization_id
  then
    raise exception '申请不存在或无权访问'
      using errcode = '42501';
  end if;

  if v_request.version <> p_expected_version then
    raise exception '申请已被其他人处理，请刷新后重试'
      using errcode = '40001';
  end if;

  if p_action = 'withdraw' then
    if v_actor.id <> v_request.applicant_employee_id
      or v_request.status <> 'pending_department'
    then
      raise exception '当前状态不允许撤回'
        using errcode = '42501';
    end if;
    v_next_status := 'withdrawn';
    v_next_approver := null;
    v_history_action := 'withdrawn';
    v_actor_role := 'employee';
    if v_opinion = '' then
      v_opinion := '申请人主动撤回';
    end if;
  elsif p_action = 'resubmit' then
    if v_actor.id <> v_request.applicant_employee_id
      or v_request.status <> 'returned'
    then
      raise exception '当前状态不允许重新提交'
        using errcode = '42501';
    end if;
    select manager_id
    into v_next_approver
    from public.employees
    where id = v_request.applicant_employee_id
      and status = 'active';
    if v_next_approver is null then
      raise exception '员工尚未设置有效直属负责人'
        using errcode = '23514';
    end if;
    v_next_status := 'pending_department';
    v_history_action := 'resubmitted';
    v_actor_role := 'employee';
    if v_opinion = '' then
      v_opinion := '修改后重新提交';
    end if;
  else
    if v_actor.id <> v_request.current_approver_employee_id then
      raise exception '该待办未分配给当前用户'
        using errcode = '42501';
    end if;

    if p_action in ('return', 'reject') and v_opinion = '' then
      raise exception '退回或驳回必须填写审批意见'
        using errcode = '22023';
    end if;

    if p_action = 'return' then
      v_next_status := 'returned';
      v_next_approver := null;
      v_history_action := 'returned';
    elsif p_action = 'reject' then
      v_next_status := 'rejected';
      v_next_approver := null;
      v_history_action := 'rejected';
    elsif p_action = 'approve' then
      case v_request.status
        when 'pending_department' then
          v_actor_role := 'department_lead';
          v_history_action := 'department_approved';
          if v_request.leave_days > 1 then
            v_next_status := 'pending_chairman';
            v_next_approver := public.find_active_role_holder(
              v_request.organization_id,
              'chairman'
            );
          else
            v_next_status := 'pending_hr_filing';
            v_next_approver := public.find_active_role_holder(
              v_request.organization_id,
              'hr'
            );
          end if;
        when 'pending_chairman' then
          v_actor_role := 'chairman';
          v_history_action := 'chairman_approved';
          v_next_status := 'pending_hr_filing';
          v_next_approver := public.find_active_role_holder(
            v_request.organization_id,
            'hr'
          );
        when 'pending_hr_filing' then
          v_actor_role := 'hr';
          v_history_action := 'hr_filed';
          v_next_status := 'approved';
          v_next_approver := null;
        else
          raise exception '当前状态不允许同意'
            using errcode = '22023';
      end case;

      if v_next_status not in ('approved')
        and v_next_approver is null
      then
        raise exception '下一审批节点尚未配置负责人'
          using errcode = '23514';
      end if;
    else
      raise exception '审批动作无效'
        using errcode = '22023';
    end if;

    if v_actor_role is null then
      v_actor_role := case v_request.status
        when 'pending_department' then 'department_lead'
        when 'pending_chairman' then 'chairman'
        when 'pending_hr_filing' then 'hr'
        else 'employee'
      end;
    end if;
  end if;

  update public.leave_requests
  set
    status = v_next_status,
    current_approver_employee_id = v_next_approver,
    version = version + 1,
    completed_at = case
      when v_next_status in ('approved', 'rejected', 'withdrawn')
        then now()
      else null
    end
  where id = v_request.id;

  insert into public.approval_actions (
    organization_id,
    leave_request_id,
    actor_employee_id,
    actor_role,
    action,
    opinion,
    previous_status,
    next_status
  )
  values (
    v_request.organization_id,
    v_request.id,
    v_actor.id,
    v_actor_role,
    v_history_action,
    v_opinion,
    v_request.status,
    v_next_status
  );

  return jsonb_build_object(
    'id', v_request.id,
    'status', v_next_status,
    'version', v_request.version + 1
  );
end;
$$;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.departments from anon, authenticated;
revoke all on table public.employees from anon, authenticated;
revoke all on table public.roles from anon, authenticated;
revoke all on table public.employee_roles from anon, authenticated;
revoke all on table public.leave_requests from anon, authenticated;
revoke all on table public.approval_actions from anon, authenticated;

grant select on table public.organizations to authenticated;
grant select on table public.departments to authenticated;
grant select on table public.employees to authenticated;
grant select on table public.roles to authenticated;
grant select on table public.employee_roles to authenticated;
grant select on table public.leave_requests to authenticated;
grant select on table public.approval_actions to authenticated;

revoke all on function public.current_employee_id() from public;
revoke all on function public.current_organization_id() from public;
revoke all on function public.has_org_role(text) from public;
revoke all on function public.can_view_employee(uuid) from public;
revoke all on function public.can_view_leave_request(uuid) from public;
revoke all on function public.find_active_role_holder(uuid, text) from public;
revoke all on function public.submit_leave_request(
  text,
  date,
  date,
  text,
  text,
  boolean,
  text
) from public;
revoke all on function public.process_leave_request(
  uuid,
  text,
  text,
  integer
) from public;

grant execute on function public.current_employee_id() to authenticated;
grant execute on function public.current_organization_id() to authenticated;
grant execute on function public.has_org_role(text) to authenticated;
grant execute on function public.can_view_employee(uuid) to authenticated;
grant execute on function public.can_view_leave_request(uuid) to authenticated;
grant execute on function public.submit_leave_request(
  text,
  date,
  date,
  text,
  text,
  boolean,
  text
) to authenticated;
grant execute on function public.process_leave_request(
  uuid,
  text,
  text,
  integer
) to authenticated;

commit;
