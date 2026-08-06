-- HRM phase 4: approved leave usage ledger and safe balance synchronization.

begin;

create table if not exists public.employee_leave_usages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  leave_request_id uuid not null references public.leave_requests(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  balance_year integer not null check (balance_year between 2020 and 2100),
  leave_type text not null,
  balance_bucket text not null
    check (balance_bucket in ('annual', 'sick', 'untracked')),
  leave_days numeric(6, 2) not null check (leave_days > 0),
  sync_status text not null
    check (
      sync_status in (
        'recorded',
        'not_applicable',
        'balance_missing',
        'insufficient_balance'
      )
    ),
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (leave_request_id, balance_year)
);

create index if not exists employee_leave_usages_employee_idx
  on public.employee_leave_usages (employee_id, balance_year desc, recorded_at desc);
create index if not exists employee_leave_usages_sync_idx
  on public.employee_leave_usages (organization_id, sync_status, balance_year);

alter table public.employee_leave_usages enable row level security;

drop policy if exists employee_leave_usages_select_authorized
  on public.employee_leave_usages;
create policy employee_leave_usages_select_authorized
on public.employee_leave_usages for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    employee_id = public.current_employee_id()
    or public.can_manage_hr()
    or public.has_org_role('chairman')
    or public.has_org_role('department_lead')
  )
);

revoke all on table public.employee_leave_usages from anon, authenticated;
grant select on table public.employee_leave_usages to authenticated;

create or replace function public.record_approved_leave_usage(
  p_leave_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_request public.leave_requests%rowtype;
  v_year_record record;
  v_bucket text;
  v_usage_id uuid;
  v_sync_status text;
  v_balance_exists boolean;
begin
  select * into v_request
  from public.leave_requests
  where id = p_leave_request_id
    and status = 'approved';

  if v_request.id is null then
    return;
  end if;

  v_bucket := case v_request.leave_type
    when 'welfare' then 'annual'
    when 'sick' then 'sick'
    else 'untracked'
  end;

  for v_year_record in
    select
      extract(year from day_value)::integer as balance_year,
      count(*)::numeric as leave_days
    from generate_series(
      v_request.start_date::timestamp,
      v_request.end_date::timestamp,
      interval '1 day'
    ) as day_value
    group by extract(year from day_value)
  loop
    v_usage_id := null;
    insert into public.employee_leave_usages (
      organization_id,
      leave_request_id,
      employee_id,
      balance_year,
      leave_type,
      balance_bucket,
      leave_days,
      sync_status
    )
    values (
      v_request.organization_id,
      v_request.id,
      v_request.applicant_employee_id,
      v_year_record.balance_year,
      v_request.leave_type,
      v_bucket,
      v_year_record.leave_days,
      case when v_bucket = 'untracked'
        then 'not_applicable'
        else 'balance_missing'
      end
    )
    on conflict (leave_request_id, balance_year) do nothing
    returning id into v_usage_id;

    -- A unique usage row makes this trigger idempotent.
    if v_usage_id is null then
      continue;
    end if;

    if v_bucket = 'annual' then
      update public.employee_leave_balances
      set annual_used = annual_used + v_year_record.leave_days
      where organization_id = v_request.organization_id
        and employee_id = v_request.applicant_employee_id
        and balance_year = v_year_record.balance_year
        and annual_used + v_year_record.leave_days <= annual_entitled;

      if found then
        v_sync_status := 'recorded';
      else
        select exists (
          select 1 from public.employee_leave_balances
          where organization_id = v_request.organization_id
            and employee_id = v_request.applicant_employee_id
            and balance_year = v_year_record.balance_year
        ) into v_balance_exists;
        v_sync_status := case when v_balance_exists
          then 'insufficient_balance'
          else 'balance_missing'
        end;
      end if;
    elsif v_bucket = 'sick' then
      update public.employee_leave_balances
      set sick_used = sick_used + v_year_record.leave_days
      where organization_id = v_request.organization_id
        and employee_id = v_request.applicant_employee_id
        and balance_year = v_year_record.balance_year;
      v_sync_status := case when found
        then 'recorded'
        else 'balance_missing'
      end;
    else
      v_sync_status := 'not_applicable';
    end if;

    update public.employee_leave_usages
    set sync_status = v_sync_status
    where id = v_usage_id;
  end loop;
end;
$function$;

create or replace function public.sync_approved_leave_usage()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if new.status = 'approved'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from new.status
    )
  then
    perform public.record_approved_leave_usage(new.id);
  end if;
  return new;
end;
$function$;

drop trigger if exists leave_requests_sync_usage on public.leave_requests;
create trigger leave_requests_sync_usage
after insert or update of status on public.leave_requests
for each row execute function public.sync_approved_leave_usage();

-- Safely backfill existing approved requests. Unique keys prevent duplication.
do $block$
declare
  v_request_id uuid;
begin
  for v_request_id in
    select id from public.leave_requests where status = 'approved'
  loop
    perform public.record_approved_leave_usage(v_request_id);
  end loop;
end;
$block$;

revoke all on function public.record_approved_leave_usage(uuid)
  from public, anon, authenticated;

comment on table public.employee_leave_usages is
  'Approved leave usage ledger. Personal and statutory leave are recorded without changing annual balances.';

commit;
