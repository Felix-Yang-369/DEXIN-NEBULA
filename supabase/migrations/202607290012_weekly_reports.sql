-- Weekly report workflow based on the company's reporting policy.
-- One employee has at most one report for each Monday-Sunday reporting week.

create table if not exists public.weekly_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  manager_employee_id uuid references public.employees(id) on delete set null,
  employee_name text not null,
  employee_title text,
  department_name text,
  week_start date not null,
  week_end date generated always as (week_start + 6) stored,
  completed_work text not null,
  ongoing_work text not null,
  blockers text not null,
  next_week_plan text not null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted')),
  submitted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, week_start),
  check (extract(isodow from week_start) = 1),
  check (
    (status = 'draft' and submitted_at is null)
    or (status = 'submitted' and submitted_at is not null)
  )
);

create index if not exists weekly_reports_employee_week_idx
  on public.weekly_reports (employee_id, week_start desc);
create index if not exists weekly_reports_manager_week_idx
  on public.weekly_reports (manager_employee_id, week_start desc, status);
create index if not exists weekly_reports_department_week_idx
  on public.weekly_reports (department_id, week_start desc, status);

drop trigger if exists weekly_reports_set_updated_at on public.weekly_reports;
create trigger weekly_reports_set_updated_at
before update on public.weekly_reports
for each row execute function public.set_updated_at();

create or replace function public.can_view_weekly_report(
  p_report_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.weekly_reports report
    join public.employees author on author.id = report.employee_id
    where report.id = p_report_id
      and report.organization_id = public.current_organization_id()
      and (
        report.employee_id = public.current_employee_id()
        or (
          report.status = 'submitted'
          and (
            report.manager_employee_id = public.current_employee_id()
            or author.manager_id = public.current_employee_id()
            or public.has_org_role('hr')
            or public.has_org_role('admin')
            or public.has_org_role('chairman')
          )
        )
      )
  )
$$;

alter table public.weekly_reports enable row level security;

drop policy if exists weekly_reports_select_scoped on public.weekly_reports;
create policy weekly_reports_select_scoped
on public.weekly_reports
for select
to authenticated
using ((select public.can_view_weekly_report(id)));

revoke all on table public.weekly_reports from anon;
revoke insert, update, delete on table public.weekly_reports from authenticated;
grant select on table public.weekly_reports to authenticated;

create or replace function public.save_weekly_report(
  p_week_start date,
  p_completed_work text,
  p_ongoing_work text,
  p_blockers text,
  p_next_week_plan text,
  p_submit boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_employee public.employees%rowtype;
  v_report public.weekly_reports%rowtype;
  v_current_monday date;
  v_department_name text;
begin
  select *
  into v_employee
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if not found then
    raise exception '当前账号未绑定在职员工档案'
      using errcode = '42501';
  end if;

  v_current_monday :=
    (current_timestamp at time zone 'Asia/Shanghai')::date
    - (extract(isodow from (current_timestamp at time zone 'Asia/Shanghai')::date)::integer - 1);

  if extract(isodow from p_week_start) <> 1 then
    raise exception '周报周期必须从周一开始'
      using errcode = '22023';
  end if;

  if p_week_start > v_current_monday then
    raise exception '不能填写未来周期的周报'
      using errcode = '22023';
  end if;

  if p_week_start < v_current_monday - 84 then
    raise exception '仅支持补录最近十二周的周报'
      using errcode = '22023';
  end if;

  if char_length(trim(p_completed_work)) < 2
    or char_length(trim(p_ongoing_work)) < 2
    or char_length(trim(p_blockers)) < 2
    or char_length(trim(p_next_week_plan)) < 2
  then
    raise exception '周报四个模块均需填写'
      using errcode = '22023';
  end if;

  if char_length(p_completed_work) > 5000
    or char_length(p_ongoing_work) > 5000
    or char_length(p_blockers) > 5000
    or char_length(p_next_week_plan) > 5000
  then
    raise exception '周报单个模块不能超过五千字'
      using errcode = '22023';
  end if;

  if p_submit and v_employee.manager_id is null then
    raise exception '员工尚未设置直属负责人，不能提交周报'
      using errcode = '22023';
  end if;

  select name
  into v_department_name
  from public.departments
  where id = v_employee.department_id;

  select *
  into v_report
  from public.weekly_reports
  where organization_id = v_employee.organization_id
    and employee_id = v_employee.id
    and week_start = p_week_start
  for update;

  if found and v_report.status = 'submitted' then
    raise exception '该周报已经提交，不能再次修改'
      using errcode = '22023';
  end if;

  insert into public.weekly_reports (
    organization_id,
    employee_id,
    department_id,
    manager_employee_id,
    employee_name,
    employee_title,
    department_name,
    week_start,
    completed_work,
    ongoing_work,
    blockers,
    next_week_plan,
    status,
    submitted_at
  )
  values (
    v_employee.organization_id,
    v_employee.id,
    v_employee.department_id,
    v_employee.manager_id,
    v_employee.name,
    v_employee.title,
    v_department_name,
    p_week_start,
    trim(p_completed_work),
    trim(p_ongoing_work),
    trim(p_blockers),
    trim(p_next_week_plan),
    case when p_submit then 'submitted' else 'draft' end,
    case when p_submit then now() else null end
  )
  on conflict (organization_id, employee_id, week_start)
  do update set
    department_id = excluded.department_id,
    manager_employee_id = excluded.manager_employee_id,
    employee_name = excluded.employee_name,
    employee_title = excluded.employee_title,
    department_name = excluded.department_name,
    completed_work = excluded.completed_work,
    ongoing_work = excluded.ongoing_work,
    blockers = excluded.blockers,
    next_week_plan = excluded.next_week_plan,
    status = excluded.status,
    submitted_at = excluded.submitted_at
  returning *
  into v_report;

  if p_submit then
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
      v_employee.organization_id,
      v_employee.manager_id,
      'system',
      '新的周报已提交',
      v_employee.name || '提交了 '
        || to_char(v_report.week_start, 'YYYY-MM-DD')
        || ' 至 '
        || to_char(v_report.week_end, 'YYYY-MM-DD')
        || ' 的周报。',
      '/reports/weekly?view=team&week=' || to_char(v_report.week_start, 'YYYY-MM-DD'),
      'weekly_report',
      v_report.id
    );

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
      v_employee.organization_id,
      v_employee.id,
      'weekly_report.submitted',
      'weekly_report',
      v_report.id,
      v_employee.name || '提交周报',
      jsonb_build_object(
        'week_start', v_report.week_start,
        'week_end', v_report.week_end,
        'manager_employee_id', v_employee.manager_id
      )
    );
  end if;

  return v_report.id;
end;
$$;

revoke all on function public.can_view_weekly_report(uuid) from public;
revoke all on function public.save_weekly_report(date, text, text, text, text, boolean) from public;
grant execute on function public.can_view_weekly_report(uuid) to authenticated;
grant execute on function public.save_weekly_report(date, text, text, text, text, boolean) to authenticated;
