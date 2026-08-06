-- Shared in-app notifications and immutable audit records.
-- Workflow triggers cover both the existing leave workflow and generic approvals.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recipient_employee_id uuid not null references public.employees(id) on delete cascade,
  notification_type text not null
    check (notification_type in ('approval_pending', 'request_updated', 'system')),
  title text not null,
  body text not null,
  href text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  actor_employee_id uuid references public.employees(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_recipient_idx
  on public.notifications (recipient_employee_id, read_at, created_at desc);
create index if not exists audit_logs_organization_idx
  on public.audit_logs (organization_id, created_at desc);
create index if not exists audit_logs_entity_idx
  on public.audit_logs (entity_type, entity_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

create policy notifications_select_own
on public.notifications
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and recipient_employee_id = (select public.current_employee_id())
);

create policy audit_logs_select_admin
on public.audit_logs
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.has_org_role('admin'))
);

create or replace function public.mark_notification_read(
  p_notification_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.notifications
  set read_at = coalesce(read_at, now())
  where id = p_notification_id
    and recipient_employee_id = (select public.current_employee_id())
    and organization_id = (select public.current_organization_id());

  if not found then
    raise exception '通知不存在或无权操作'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.mark_all_notifications_read()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  update public.notifications
  set read_at = now()
  where recipient_employee_id = (select public.current_employee_id())
    and organization_id = (select public.current_organization_id())
    and read_at is null;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create or replace function public.notify_leave_request_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_applicant_name text;
  v_status_label text;
begin
  select name
  into v_applicant_name
  from public.employees
  where id = new.applicant_employee_id;

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
      '新的请假待审批',
      coalesce(v_applicant_name, '员工') || '提交了请假申请，请及时处理。',
      '/approvals',
      'leave_request',
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
        '请假审批进入你的节点',
        coalesce(v_applicant_name, '员工') || '的请假申请等待你处理。',
        '/approvals',
        'leave_request',
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
        '请假申请状态更新',
        '你的请假申请' || v_status_label || '。',
        '/approvals',
        'leave_request',
        new.id
      );
    end if;
  end if;

  return new;
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

create or replace function public.audit_leave_approval_action()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  )
  values (
    new.organization_id,
    new.actor_employee_id,
    new.action,
    'leave_request',
    new.leave_request_id,
    '请假审批动作：' || new.action,
    jsonb_build_object(
      'actor_role', new.actor_role,
      'previous_status', new.previous_status,
      'next_status', new.next_status
    )
  );
  return new;
end;
$$;

create or replace function public.audit_generic_approval_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  )
  values (
    new.organization_id,
    new.actor_employee_id,
    new.action,
    'approval_request',
    new.approval_request_id,
    '通用审批动作：' || new.action,
    jsonb_build_object(
      'approval_step_id', new.approval_step_id,
      'previous_status', new.previous_status,
      'next_status', new.next_status
    )
  );
  return new;
end;
$$;

drop trigger if exists leave_requests_notify_change on public.leave_requests;
create trigger leave_requests_notify_change
after insert or update of status, current_approver_employee_id
on public.leave_requests
for each row execute function public.notify_leave_request_change();

drop trigger if exists approval_requests_notify_change on public.approval_requests;
create trigger approval_requests_notify_change
after insert or update of status, current_approver_employee_id
on public.approval_requests
for each row execute function public.notify_generic_approval_change();

drop trigger if exists approval_actions_write_audit on public.approval_actions;
create trigger approval_actions_write_audit
after insert on public.approval_actions
for each row execute function public.audit_leave_approval_action();

drop trigger if exists approval_events_write_audit on public.approval_events;
create trigger approval_events_write_audit
after insert on public.approval_events
for each row execute function public.audit_generic_approval_event();

revoke all on table public.notifications from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;
grant select on table public.notifications to authenticated;
grant select on table public.audit_logs to authenticated;

revoke all on function public.mark_notification_read(uuid) from public;
revoke all on function public.mark_all_notifications_read() from public;
grant execute on function public.mark_notification_read(uuid) to authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
