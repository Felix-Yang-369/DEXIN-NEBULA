-- Controlled seal-use requests on the shared generic approval engine.

alter table public.approval_requests
  drop constraint if exists approval_requests_request_type_check;

alter table public.approval_requests
  add constraint approval_requests_request_type_check
  check (request_type in ('expense', 'seal'));

create table if not exists public.seal_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  approval_request_id uuid not null unique references public.approval_requests(id) on delete cascade,
  seal_type text not null
    check (seal_type in ('company', 'contract', 'finance', 'legal_representative', 'other')),
  use_date date not null,
  document_title text not null,
  purpose text not null,
  counterparty text,
  copies integer not null default 1 check (copies between 1 and 100),
  is_external boolean not null default false,
  expected_return_on date,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_external or expected_return_on is not null),
  check (expected_return_on is null or expected_return_on >= use_date)
);

create index if not exists seal_requests_use_date_idx
  on public.seal_requests (organization_id, use_date desc);

drop trigger if exists seal_requests_set_updated_at on public.seal_requests;
create trigger seal_requests_set_updated_at
before update on public.seal_requests
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
        or (
          request.request_type = 'seal'
          and (
            (select public.has_org_role('hr'))
            or (select public.has_org_role('chairman'))
          )
        )
      )
  );
$$;

create or replace function public.submit_seal_request(
  p_seal_type text,
  p_use_date date,
  p_document_title text,
  p_purpose text,
  p_counterparty text,
  p_copies integer,
  p_is_external boolean default false,
  p_expected_return_on date default null,
  p_note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_manager public.employees%rowtype;
  v_custodian_id uuid;
  v_chairman_id uuid;
  v_request_id uuid;
  v_request_no text;
  v_total_steps integer;
  v_needs_chairman boolean;
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
    raise exception '员工尚未设置直属负责人，不能提交用印申请'
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

  v_custodian_id := public.find_active_role_holder(
    v_employee.organization_id,
    'hr'
  );

  if v_custodian_id is null then
    raise exception '尚未配置行政用印管理员'
      using errcode = '23514';
  end if;

  if p_seal_type not in (
    'company', 'contract', 'finance', 'legal_representative', 'other'
  ) then
    raise exception '印章类型无效'
      using errcode = '22023';
  end if;

  if p_use_date is null
    or p_use_date < current_date
    or p_use_date > current_date + 365
  then
    raise exception '计划用印日期无效'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_document_title, ''))) < 2 then
    raise exception '文件名称至少填写 2 个字'
      using errcode = '22023';
  end if;

  if char_length(btrim(coalesce(p_purpose, ''))) < 5 then
    raise exception '用印事由至少填写 5 个字'
      using errcode = '22023';
  end if;

  if p_copies is null or p_copies < 1 or p_copies > 100 then
    raise exception '用印份数无效'
      using errcode = '22023';
  end if;

  if coalesce(p_is_external, false) and p_expected_return_on is null then
    raise exception '印章外带时必须填写预计归还日期'
      using errcode = '22023';
  end if;

  if p_expected_return_on is not null and p_expected_return_on < p_use_date then
    raise exception '预计归还日期不能早于用印日期'
      using errcode = '22023';
  end if;

  v_needs_chairman :=
    p_seal_type in ('company', 'contract', 'finance', 'legal_representative')
    or coalesce(p_is_external, false);

  if v_needs_chairman then
    v_chairman_id := public.find_active_role_holder(
      v_employee.organization_id,
      'chairman'
    );
    if v_chairman_id is null then
      raise exception '重要用印尚未配置董事长审批人'
        using errcode = '23514';
    end if;
    v_total_steps := 3;
  else
    v_total_steps := 2;
  end if;

  v_request_no :=
    'YY-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' ||
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
    'seal',
    '用印申请',
    btrim(p_document_title) || ' · ' || btrim(p_purpose),
    v_employee.id,
    v_manager.id,
    'pending',
    1,
    v_total_steps
  )
  returning id into v_request_id;

  insert into public.seal_requests (
    organization_id,
    approval_request_id,
    seal_type,
    use_date,
    document_title,
    purpose,
    counterparty,
    copies,
    is_external,
    expected_return_on,
    note
  )
  values (
    v_employee.organization_id,
    v_request_id,
    p_seal_type,
    p_use_date,
    btrim(p_document_title),
    btrim(p_purpose),
    nullif(btrim(coalesce(p_counterparty, '')), ''),
    p_copies,
    coalesce(p_is_external, false),
    p_expected_return_on,
    nullif(btrim(coalesce(p_note, '')), '')
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
  values (
    v_employee.organization_id,
    v_request_id,
    1,
    'department_review',
    '直属负责人审批',
    v_manager.id,
    'active'
  );

  if v_needs_chairman then
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
      2,
      'chairman_approval',
      '董事长审批',
      v_chairman_id,
      'pending'
    );
  end if;

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
    case when v_needs_chairman then 3 else 2 end,
    'seal_custodian',
    '行政用印登记',
    v_custodian_id,
    'pending'
  );

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
    '提交用印申请',
    'draft',
    'pending'
  );

  return v_request_id;
end;
$$;

create or replace function public.notify_generic_approval_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_applicant_name text;
  v_request_label text;
  v_status_label text;
begin
  select name
  into v_applicant_name
  from public.employees
  where id = new.applicant_employee_id;

  v_request_label := case new.request_type
    when 'expense' then '费用报销'
    when 'seal' then '用印申请'
    else '业务申请'
  end;

  if tg_op = 'INSERT' and new.current_approver_employee_id is not null then
    insert into public.notifications (
      organization_id,
      recipient_employee_id,
      notification_type,
      title,
      body,
      href,
      entity_type,
      entity_id
    )
    values (
      new.organization_id,
      new.current_approver_employee_id,
      'approval_pending',
      '新的' || v_request_label || '待审批',
      coalesce(v_applicant_name, '员工') || '提交了' || v_request_label || '，请及时处理。',
      '/approvals',
      'approval_request',
      new.id
    );
  elsif tg_op = 'UPDATE' then
    if new.current_approver_employee_id is distinct from old.current_approver_employee_id
      and new.current_approver_employee_id is not null
    then
      insert into public.notifications (
        organization_id,
        recipient_employee_id,
        notification_type,
        title,
        body,
        href,
        entity_type,
        entity_id
      )
      values (
        new.organization_id,
        new.current_approver_employee_id,
        'approval_pending',
        v_request_label || '进入你的审批节点',
        coalesce(v_applicant_name, '员工') || '的' || v_request_label || '等待你处理。',
        '/approvals',
        'approval_request',
        new.id
      );
    end if;

    if new.status is distinct from old.status
      and new.status in ('approved', 'returned', 'rejected', 'withdrawn')
    then
      v_status_label := case new.status
        when 'approved' then '已通过'
        when 'returned' then '已退回修改'
        when 'rejected' then '已驳回'
        else '已撤回'
      end;

      insert into public.notifications (
        organization_id,
        recipient_employee_id,
        notification_type,
        title,
        body,
        href,
        entity_type,
        entity_id
      )
      values (
        new.organization_id,
        new.applicant_employee_id,
        'request_updated',
        v_request_label || '状态更新',
        '你的' || v_request_label || v_status_label || '。',
        '/approvals',
        'approval_request',
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

alter table public.seal_requests enable row level security;

create policy seal_requests_select_authorized
on public.seal_requests
for select
to authenticated
using ((select public.can_view_approval_request(approval_request_id)));

revoke all on table public.seal_requests from anon, authenticated;
grant select on table public.seal_requests to authenticated;

revoke all on function public.submit_seal_request(
  text,
  date,
  text,
  text,
  text,
  integer,
  boolean,
  date,
  text
) from public;

grant execute on function public.submit_seal_request(
  text,
  date,
  text,
  text,
  text,
  integer,
  boolean,
  date,
  text
) to authenticated;
