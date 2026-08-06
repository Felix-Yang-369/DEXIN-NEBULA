-- HRM phase 3: actionable onboarding and offboarding checklists.

begin;

create table if not exists public.employee_lifecycle_cases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_no text not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  process_type text not null check (process_type in ('onboarding', 'offboarding')),
  effective_on date not null,
  owner_employee_id uuid not null references public.employees(id),
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'cancelled')),
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, case_no)
);

create table if not exists public.employee_lifecycle_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  case_id uuid not null references public.employee_lifecycle_cases(id) on delete cascade,
  task_code text not null,
  title text not null,
  category text not null check (
    category in (
      'profile', 'contract', 'account', 'asset', 'access',
      'handover', 'training', 'finance', 'other'
    )
  ),
  responsible_employee_id uuid references public.employees(id) on delete set null,
  due_on date,
  status text not null default 'pending'
    check (status in ('pending', 'completed', 'not_applicable')),
  completed_at timestamptz,
  completed_by_employee_id uuid references public.employees(id) on delete set null,
  note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, task_code)
);

create unique index if not exists employee_lifecycle_active_case_idx
  on public.employee_lifecycle_cases (
    organization_id, employee_id, process_type
  )
  where status = 'in_progress';
create index if not exists employee_lifecycle_cases_org_idx
  on public.employee_lifecycle_cases (organization_id, status, effective_on desc);
create index if not exists employee_lifecycle_tasks_case_idx
  on public.employee_lifecycle_tasks (case_id, sort_order);
create index if not exists employee_lifecycle_tasks_due_idx
  on public.employee_lifecycle_tasks (organization_id, due_on)
  where status = 'pending';

drop trigger if exists employee_lifecycle_cases_set_updated_at
  on public.employee_lifecycle_cases;
create trigger employee_lifecycle_cases_set_updated_at
before update on public.employee_lifecycle_cases
for each row execute function public.set_updated_at();

drop trigger if exists employee_lifecycle_tasks_set_updated_at
  on public.employee_lifecycle_tasks;
create trigger employee_lifecycle_tasks_set_updated_at
before update on public.employee_lifecycle_tasks
for each row execute function public.set_updated_at();

alter table public.employee_lifecycle_cases enable row level security;
alter table public.employee_lifecycle_tasks enable row level security;

drop policy if exists employee_lifecycle_cases_select_authorized
  on public.employee_lifecycle_cases;
create policy employee_lifecycle_cases_select_authorized
on public.employee_lifecycle_cases for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.can_manage_hr()
    or public.has_org_role('chairman')
  )
);

drop policy if exists employee_lifecycle_tasks_select_authorized
  on public.employee_lifecycle_tasks;
create policy employee_lifecycle_tasks_select_authorized
on public.employee_lifecycle_tasks for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.can_manage_hr()
    or public.has_org_role('chairman')
  )
);

revoke all on table public.employee_lifecycle_cases from anon, authenticated;
revoke all on table public.employee_lifecycle_tasks from anon, authenticated;
grant select on table public.employee_lifecycle_cases to authenticated;
grant select on table public.employee_lifecycle_tasks to authenticated;

create or replace function public.create_employee_lifecycle_case(
  p_employee_id uuid,
  p_process_type text,
  p_effective_on date,
  p_owner_employee_id uuid,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_employee public.employees%rowtype;
  v_case_id uuid;
  v_case_no text;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以创建入离职流程'
      using errcode = '42501';
  end if;

  if p_process_type not in ('onboarding', 'offboarding') then
    raise exception '流程类型无效' using errcode = '22023';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id
    and organization_id = v_actor.organization_id;

  if v_employee.id is null then
    raise exception '员工不存在或不属于当前组织'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.employees
    where id = p_owner_employee_id
      and organization_id = v_actor.organization_id
      and status = 'active'
  ) then
    raise exception '流程负责人无效' using errcode = '22023';
  end if;

  v_case_no := case
    when p_process_type = 'onboarding' then 'DXON-'
    else 'DXOFF-'
  end || to_char(clock_timestamp(), 'YYYYMMDDHH24MISS')
    || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 4));

  insert into public.employee_lifecycle_cases (
    organization_id,
    case_no,
    employee_id,
    process_type,
    effective_on,
    owner_employee_id,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_case_no,
    p_employee_id,
    p_process_type,
    p_effective_on,
    p_owner_employee_id,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  )
  returning id into v_case_id;

  if p_process_type = 'onboarding' then
    insert into public.employee_lifecycle_tasks (
      organization_id, case_id, task_code, title, category,
      responsible_employee_id, due_on, sort_order
    )
    select
      v_actor.organization_id, v_case_id, task_code, title, category,
      p_owner_employee_id, p_effective_on, sort_order
    from (values
      ('profile_verify', '人事资料核验', 'profile', 10),
      ('contract_sign', '劳动合同签署', 'contract', 20),
      ('wecom_account', '企业微信开通', 'account', 30),
      ('email_account', '企业邮箱开通', 'account', 40),
      ('nebula_account', '德馨星云账号开通', 'account', 50),
      ('role_permission', '系统角色与权限分配', 'access', 60),
      ('equipment_issue', '电脑及办公设备发放', 'asset', 70),
      ('badge_access', '工牌与门禁发放', 'access', 80),
      ('onboarding_training', '入职培训与制度学习', 'training', 90)
    ) as template(task_code, title, category, sort_order);
  else
    insert into public.employee_lifecycle_tasks (
      organization_id, case_id, task_code, title, category,
      responsible_employee_id, due_on, sort_order
    )
    select
      v_actor.organization_id, v_case_id, task_code, title, category,
      p_owner_employee_id, p_effective_on, sort_order
    from (values
      ('departure_confirm', '离职信息确认', 'profile', 10),
      ('work_handover', '工作事项交接', 'handover', 20),
      ('customer_document_handover', '客户与文件交接', 'handover', 30),
      ('equipment_return', '电脑及办公设备回收', 'asset', 40),
      ('badge_access_return', '工牌与门禁回收', 'access', 50),
      ('wecom_email_disable', '企业微信与邮箱停用', 'account', 60),
      ('nebula_disable', '德馨星云账号停用', 'account', 70),
      ('finance_settlement', '薪资费用及借款结清', 'finance', 80),
      ('archive_records', '人事资料归档', 'profile', 90)
    ) as template(task_code, title, category, sort_order);
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action,
    entity_type, entity_id, summary, metadata
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'employee_lifecycle_case_created',
    'employee_lifecycle_case',
    v_case_id,
    case when p_process_type = 'onboarding'
      then '创建员工入职清单'
      else '创建员工离职清单'
    end,
    jsonb_build_object(
      'case_no', v_case_no,
      'employee_id', p_employee_id,
      'effective_on', p_effective_on
    )
  );

  return v_case_no;
exception
  when unique_violation then
    raise exception '该员工已有进行中的同类型流程'
      using errcode = '23505';
end;
$function$;

create or replace function public.update_employee_lifecycle_task(
  p_task_id uuid,
  p_action text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_task public.employee_lifecycle_tasks%rowtype;
  v_case public.employee_lifecycle_cases%rowtype;
  v_pending integer;
  v_completed integer;
  v_total integer;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以更新入离职清单'
      using errcode = '42501';
  end if;

  if p_action not in ('complete', 'skip', 'reopen') then
    raise exception '清单操作无效' using errcode = '22023';
  end if;

  select * into v_task
  from public.employee_lifecycle_tasks
  where id = p_task_id
    and organization_id = v_actor.organization_id
  for update;

  if v_task.id is null then
    raise exception '清单事项不存在或无权操作'
      using errcode = '42501';
  end if;

  select * into v_case
  from public.employee_lifecycle_cases
  where id = v_task.case_id
  for update;

  if v_case.status = 'cancelled' then
    raise exception '已取消的流程不能更新' using errcode = '22023';
  end if;

  if p_action = 'reopen' then
    update public.employee_lifecycle_tasks
    set
      status = 'pending',
      completed_at = null,
      completed_by_employee_id = null,
      note = nullif(btrim(coalesce(p_note, '')), '')
    where id = p_task_id;

    update public.employee_lifecycle_cases
    set status = 'in_progress', completed_at = null
    where id = v_case.id;
  else
    update public.employee_lifecycle_tasks
    set
      status = case when p_action = 'complete'
        then 'completed' else 'not_applicable' end,
      completed_at = now(),
      completed_by_employee_id = v_actor.id,
      note = nullif(btrim(coalesce(p_note, '')), '')
    where id = p_task_id;
  end if;

  select
    count(*) filter (where status = 'pending'),
    count(*) filter (where status <> 'pending'),
    count(*)
  into v_pending, v_completed, v_total
  from public.employee_lifecycle_tasks
  where case_id = v_case.id;

  if v_pending = 0 then
    update public.employee_lifecycle_cases
    set status = 'completed', completed_at = coalesce(completed_at, now())
    where id = v_case.id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action,
    entity_type, entity_id, summary, metadata
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'employee_lifecycle_task_' || p_action,
    'employee_lifecycle_task',
    p_task_id,
    case p_action
      when 'complete' then '完成入离职清单事项'
      when 'skip' then '将入离职清单事项标记为不适用'
      else '重新打开入离职清单事项'
    end,
    jsonb_build_object(
      'case_id', v_case.id,
      'case_no', v_case.case_no,
      'task_title', v_task.title
    )
  );

  return jsonb_build_object(
    'caseStatus', case when v_pending = 0 then 'completed' else 'in_progress' end,
    'completed', v_completed,
    'total', v_total
  );
end;
$function$;

create or replace function public.cancel_employee_lifecycle_case(
  p_case_id uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_case public.employee_lifecycle_cases%rowtype;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以取消入离职流程'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception '请填写取消原因' using errcode = '22023';
  end if;

  select * into v_case
  from public.employee_lifecycle_cases
  where id = p_case_id
    and organization_id = v_actor.organization_id
  for update;

  if v_case.id is null or v_case.status <> 'in_progress' then
    raise exception '流程不存在或当前状态不能取消'
      using errcode = '22023';
  end if;

  update public.employee_lifecycle_cases
  set status = 'cancelled', note = concat_ws(E'\n', note, '取消原因：' || btrim(p_reason))
  where id = p_case_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action,
    entity_type, entity_id, summary, metadata
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'employee_lifecycle_case_cancelled',
    'employee_lifecycle_case',
    p_case_id,
    '取消员工入离职流程',
    jsonb_build_object('case_no', v_case.case_no, 'reason', btrim(p_reason))
  );
end;
$function$;

revoke all on function public.create_employee_lifecycle_case(
  uuid, text, date, uuid, text
) from public, anon;
revoke all on function public.update_employee_lifecycle_task(
  uuid, text, text
) from public, anon;
revoke all on function public.cancel_employee_lifecycle_case(
  uuid, text
) from public, anon;
grant execute on function public.create_employee_lifecycle_case(
  uuid, text, date, uuid, text
) to authenticated;
grant execute on function public.update_employee_lifecycle_task(
  uuid, text, text
) to authenticated;
grant execute on function public.cancel_employee_lifecycle_case(
  uuid, text
) to authenticated;

commit;
