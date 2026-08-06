-- Generic approval foundation and the first reusable workflow: expense claims.
-- Existing leave tables remain unchanged to protect the live leave workflow.

create table if not exists public.approval_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  request_no text not null,
  request_type text not null check (request_type in ('expense')),
  title text not null,
  summary text,
  applicant_employee_id uuid not null references public.employees(id),
  current_approver_employee_id uuid references public.employees(id),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'returned', 'rejected', 'withdrawn')),
  current_step_order integer,
  total_steps integer not null check (total_steps > 0),
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, request_no)
);

create table if not exists public.approval_steps (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_code text not null,
  step_name text not null,
  approver_employee_id uuid not null references public.employees(id),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'approved', 'returned', 'rejected', 'cancelled')),
  acted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (approval_request_id, step_order)
);

create table if not exists public.approval_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null references public.approval_requests(id) on delete cascade,
  approval_step_id uuid references public.approval_steps(id) on delete set null,
  actor_employee_id uuid not null references public.employees(id),
  action text not null
    check (action in ('submitted', 'approved', 'returned', 'rejected', 'withdrawn', 'resubmitted')),
  opinion text not null default '',
  previous_status text not null,
  next_status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.expense_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null unique references public.approval_requests(id) on delete cascade,
  expense_category text not null
    check (expense_category in ('travel', 'transport', 'hospitality', 'office', 'purchase', 'other')),
  occurred_on date not null,
  amount numeric(14, 2) not null check (amount > 0 and amount <= 1000000),
  currency text not null default 'CNY' check (currency = 'CNY'),
  vendor text,
  description text not null,
  has_invoice boolean not null default false,
  invoice_count integer not null default 0 check (invoice_count >= 0 and invoice_count <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists approval_requests_applicant_idx
  on public.approval_requests (applicant_employee_id, created_at desc);
create index if not exists approval_requests_approver_idx
  on public.approval_requests (current_approver_employee_id, status, created_at desc);
create index if not exists approval_steps_request_idx
  on public.approval_steps (approval_request_id, step_order);
create index if not exists approval_events_request_idx
  on public.approval_events (approval_request_id, created_at);

drop trigger if exists approval_requests_set_updated_at on public.approval_requests;
create trigger approval_requests_set_updated_at
before update on public.approval_requests
for each row execute function public.set_updated_at();

drop trigger if exists expense_claims_set_updated_at on public.expense_claims;
create trigger expense_claims_set_updated_at
before update on public.expense_claims
for each row execute function public.set_updated_at();

create or replace function public.can_view_approval_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.approval_requests request
    where request.id = target_request_id
      and request.organization_id = (select public.current_organization_id())
      and (
        request.applicant_employee_id = (select public.current_employee_id())
        or request.current_approver_employee_id = (select public.current_employee_id())
        or (select public.has_org_role('admin'))
        or (
          request.request_type = 'expense'
          and (
            (select public.has_org_role('finance'))
            or (select public.has_org_role('chairman'))
          )
        )
      )
  );
$$;

create or replace function public.submit_expense_claim(
  p_expense_category text,
  p_occurred_on date,
  p_amount numeric,
  p_vendor text,
  p_description text,
  p_has_invoice boolean default false,
  p_invoice_count integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_manager public.employees%rowtype;
  v_finance_id uuid;
  v_chairman_id uuid;
  v_request_id uuid;
  v_request_no text;
  v_total_steps integer;
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
    raise exception '员工尚未设置直属负责人，不能提交报销'
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

  v_finance_id := public.find_active_role_holder(
    v_employee.organization_id,
    'finance'
  );

  if v_finance_id is null then
    raise exception '尚未配置有效财务审批人'
      using errcode = '23514';
  end if;

  if p_amount > 5000 then
    v_chairman_id := public.find_active_role_holder(
      v_employee.organization_id,
      'chairman'
    );
    if v_chairman_id is null then
      raise exception '大额报销尚未配置董事长审批人'
        using errcode = '23514';
    end if;
    v_total_steps := 3;
  else
    v_total_steps := 2;
  end if;

  if p_expense_category not in (
    'travel', 'transport', 'hospitality', 'office', 'purchase', 'other'
  ) then
    raise exception '报销类别无效'
      using errcode = '22023';
  end if;

  if p_occurred_on is null or p_occurred_on > current_date then
    raise exception '费用发生日期无效'
      using errcode = '22023';
  end if;

  if p_amount is null or p_amount <= 0 or p_amount > 1000000 then
    raise exception '报销金额无效'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_description, ''))) < 5 then
    raise exception '费用说明至少填写 5 个字'
      using errcode = '22023';
  end if;

  if coalesce(p_invoice_count, 0) < 0 or coalesce(p_invoice_count, 0) > 100 then
    raise exception '发票张数无效'
      using errcode = '22023';
  end if;

  if coalesce(p_has_invoice, false) and coalesce(p_invoice_count, 0) = 0 then
    raise exception '请填写发票张数'
      using errcode = '22023';
  end if;

  v_request_no :=
    'BX-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
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
    v_employee.organization_id,
    v_request_no,
    'expense',
    '费用报销',
    btrim(p_description),
    v_employee.id,
    v_manager.id,
    'pending',
    1,
    v_total_steps
  )
  returning id into v_request_id;

  insert into public.expense_claims (
    organization_id,
    approval_request_id,
    expense_category,
    occurred_on,
    amount,
    vendor,
    description,
    has_invoice,
    invoice_count
  )
  values (
    v_employee.organization_id,
    v_request_id,
    p_expense_category,
    p_occurred_on,
    p_amount,
    nullif(btrim(coalesce(p_vendor, '')), ''),
    btrim(p_description),
    coalesce(p_has_invoice, false),
    case when coalesce(p_has_invoice, false) then coalesce(p_invoice_count, 0) else 0 end
  );

  insert into public.approval_steps (
    organization_id,
    approval_request_id,
    step_order,
    step_code,
    step_name,
    approver_employee_id,
    status
  )
  values
    (
      v_employee.organization_id,
      v_request_id,
      1,
      'department_review',
      '直属负责人审批',
      v_manager.id,
      'active'
    ),
    (
      v_employee.organization_id,
      v_request_id,
      2,
      'finance_review',
      '财务复核',
      v_finance_id,
      'pending'
    );

  if v_chairman_id is not null then
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
      v_employee.organization_id,
      v_request_id,
      3,
      'chairman_approval',
      '董事长审批',
      v_chairman_id,
      'pending'
    );
  end if;

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
    v_employee.organization_id,
    v_request_id,
    v_employee.id,
    'submitted',
    '提交费用报销申请',
    'draft',
    'pending'
  );

  return v_request_id;
end;
$$;

create or replace function public.process_approval_request(
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
  v_request public.approval_requests%rowtype;
  v_current_step public.approval_steps%rowtype;
  v_next_step public.approval_steps%rowtype;
  v_opinion text := btrim(coalesce(p_opinion, ''));
  v_next_status text;
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
  from public.approval_requests
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
    if v_request.applicant_employee_id <> v_actor.id
      or v_request.status <> 'pending'
      or v_request.current_step_order <> 1
    then
      raise exception '当前状态不允许撤回'
        using errcode = '42501';
    end if;

    update public.approval_steps
    set status = 'cancelled'
    where approval_request_id = v_request.id
      and status in ('active', 'pending');

    v_next_status := 'withdrawn';
    if v_opinion = '' then
      v_opinion := '申请人主动撤回';
    end if;
  elsif p_action = 'resubmit' then
    if v_request.applicant_employee_id <> v_actor.id
      or v_request.status <> 'returned'
    then
      raise exception '当前状态不允许重新提交'
        using errcode = '42501';
    end if;

    update public.approval_steps
    set
      status = case when step_order = 1 then 'active' else 'pending' end,
      acted_at = null
    where approval_request_id = v_request.id;

    select *
    into v_next_step
    from public.approval_steps
    where approval_request_id = v_request.id
      and step_order = 1;

    if v_next_step.approver_employee_id is null then
      raise exception '首个审批节点未配置有效负责人'
        using errcode = '23514';
    end if;

    v_next_status := 'pending';
    if v_opinion = '' then
      v_opinion := '修改后重新提交';
    end if;
  else
    if v_request.status <> 'pending'
      or v_request.current_approver_employee_id <> v_actor.id
    then
      raise exception '该待办未分配给当前用户'
        using errcode = '42501';
    end if;

    select *
    into v_current_step
    from public.approval_steps
    where approval_request_id = v_request.id
      and step_order = v_request.current_step_order
      and status = 'active'
    for update;

    if v_current_step.id is null
      or v_current_step.approver_employee_id <> v_actor.id
    then
      raise exception '当前审批节点无效'
        using errcode = '42501';
    end if;

    if p_action in ('return', 'reject') and v_opinion = '' then
      raise exception '退回或驳回必须填写审批意见'
        using errcode = '22023';
    end if;

    if p_action = 'approve' then
      update public.approval_steps
      set status = 'approved', acted_at = now()
      where id = v_current_step.id;

      select *
      into v_next_step
      from public.approval_steps
      where approval_request_id = v_request.id
        and step_order > v_current_step.step_order
        and status = 'pending'
      order by step_order
      limit 1;

      if v_next_step.id is null then
        v_next_status := 'approved';
      else
        update public.approval_steps
        set status = 'active'
        where id = v_next_step.id;
        v_next_status := 'pending';
      end if;
    elsif p_action = 'return' then
      update public.approval_steps
      set status = 'returned', acted_at = now()
      where id = v_current_step.id;
      update public.approval_steps
      set status = 'cancelled'
      where approval_request_id = v_request.id
        and step_order > v_current_step.step_order
        and status = 'pending';
      v_next_status := 'returned';
    elsif p_action = 'reject' then
      update public.approval_steps
      set status = 'rejected', acted_at = now()
      where id = v_current_step.id;
      update public.approval_steps
      set status = 'cancelled'
      where approval_request_id = v_request.id
        and step_order > v_current_step.step_order
        and status = 'pending';
      v_next_status := 'rejected';
    else
      raise exception '审批动作无效'
        using errcode = '22023';
    end if;
  end if;

  update public.approval_requests
  set
    status = v_next_status,
    current_step_order = case
      when p_action = 'resubmit' then 1
      when v_next_status = 'pending' then v_next_step.step_order
      else null
    end,
    current_approver_employee_id = case
      when p_action = 'resubmit' then v_next_step.approver_employee_id
      when v_next_status = 'pending' then v_next_step.approver_employee_id
      else null
    end,
    version = version + 1,
    completed_at = case
      when v_next_status in ('approved', 'rejected', 'withdrawn') then now()
      else null
    end
  where id = v_request.id;

  insert into public.approval_events (
    organization_id,
    approval_request_id,
    approval_step_id,
    actor_employee_id,
    action,
    opinion,
    previous_status,
    next_status
  )
  values (
    v_request.organization_id,
    v_request.id,
    v_current_step.id,
    v_actor.id,
    case
      when p_action = 'approve' then 'approved'
      when p_action = 'return' then 'returned'
      when p_action = 'reject' then 'rejected'
      when p_action = 'withdraw' then 'withdrawn'
      else 'resubmitted'
    end,
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

alter table public.approval_requests enable row level security;
alter table public.approval_steps enable row level security;
alter table public.approval_events enable row level security;
alter table public.expense_claims enable row level security;

create policy approval_requests_select_authorized
on public.approval_requests
for select
to authenticated
using ((select public.can_view_approval_request(id)));

create policy approval_steps_select_authorized
on public.approval_steps
for select
to authenticated
using ((select public.can_view_approval_request(approval_request_id)));

create policy approval_events_select_authorized
on public.approval_events
for select
to authenticated
using ((select public.can_view_approval_request(approval_request_id)));

create policy expense_claims_select_authorized
on public.expense_claims
for select
to authenticated
using ((select public.can_view_approval_request(approval_request_id)));

revoke all on table public.approval_requests from anon, authenticated;
revoke all on table public.approval_steps from anon, authenticated;
revoke all on table public.approval_events from anon, authenticated;
revoke all on table public.expense_claims from anon, authenticated;

grant select on table public.approval_requests to authenticated;
grant select on table public.approval_steps to authenticated;
grant select on table public.approval_events to authenticated;
grant select on table public.expense_claims to authenticated;

revoke all on function public.can_view_approval_request(uuid) from public;
revoke all on function public.submit_expense_claim(
  text,
  date,
  numeric,
  text,
  text,
  boolean,
  integer
) from public;
revoke all on function public.process_approval_request(
  uuid,
  text,
  text,
  integer
) from public;

grant execute on function public.can_view_approval_request(uuid) to authenticated;
grant execute on function public.submit_expense_claim(
  text,
  date,
  numeric,
  text,
  text,
  boolean,
  integer
) to authenticated;
grant execute on function public.process_approval_request(
  uuid,
  text,
  text,
  integer
) to authenticated;
