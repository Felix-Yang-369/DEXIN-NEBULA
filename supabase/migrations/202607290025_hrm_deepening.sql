-- HRM phase 2: employee lifecycle, contracts, leave accounts and changes.

begin;

create table if not exists public.employee_hr_profiles (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  work_location text,
  probation_end_on date,
  regularized_on date,
  departure_on date,
  personnel_note text,
  updated_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.employee_contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  contract_no text not null,
  contract_type text not null
    check (contract_type in (
      'fixed_term',
      'indefinite',
      'intern',
      'part_time',
      'confidentiality',
      'other'
    )),
  starts_on date not null,
  ends_on date,
  probation_end_on date,
  status text not null default 'active'
    check (status in ('draft', 'active', 'expired', 'terminated')),
  business_document_id uuid references public.business_documents(id) on delete set null,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, contract_no),
  check (ends_on is null or ends_on >= starts_on)
);

create table if not exists public.employee_leave_balances (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  balance_year integer not null check (balance_year between 2020 and 2100),
  annual_entitled numeric(6, 2) not null default 0 check (annual_entitled >= 0),
  annual_used numeric(6, 2) not null default 0 check (annual_used >= 0),
  compensatory_entitled numeric(6, 2) not null default 0
    check (compensatory_entitled >= 0),
  compensatory_used numeric(6, 2) not null default 0
    check (compensatory_used >= 0),
  sick_used numeric(6, 2) not null default 0 check (sick_used >= 0),
  updated_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, balance_year),
  check (annual_used <= annual_entitled),
  check (compensatory_used <= compensatory_entitled)
);

create table if not exists public.employee_changes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  change_type text not null
    check (change_type in (
      'hire',
      'transfer',
      'promotion',
      'regularization',
      'departure',
      'rehire',
      'other'
    )),
  effective_on date not null,
  from_department_id uuid references public.departments(id) on delete set null,
  to_department_id uuid references public.departments(id) on delete set null,
  from_title text,
  to_title text,
  from_employment_status text,
  to_employment_status text,
  reason text not null,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now()
);

create index if not exists employee_contracts_employee_idx
  on public.employee_contracts (employee_id, starts_on desc);
create index if not exists employee_contracts_expiry_idx
  on public.employee_contracts (organization_id, ends_on)
  where status = 'active' and ends_on is not null;
create index if not exists employee_leave_balances_employee_idx
  on public.employee_leave_balances (employee_id, balance_year desc);
create index if not exists employee_changes_employee_idx
  on public.employee_changes (employee_id, effective_on desc, created_at desc);

drop trigger if exists employee_hr_profiles_set_updated_at
  on public.employee_hr_profiles;
create trigger employee_hr_profiles_set_updated_at
before update on public.employee_hr_profiles
for each row execute function public.set_updated_at();

drop trigger if exists employee_contracts_set_updated_at
  on public.employee_contracts;
create trigger employee_contracts_set_updated_at
before update on public.employee_contracts
for each row execute function public.set_updated_at();

drop trigger if exists employee_leave_balances_set_updated_at
  on public.employee_leave_balances;
create trigger employee_leave_balances_set_updated_at
before update on public.employee_leave_balances
for each row execute function public.set_updated_at();

create or replace function public.can_manage_hr()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select public.current_employee_id() is not null
    and (
      public.has_org_role('hr')
      or public.has_org_role('admin')
    )
$function$;

create or replace function public.can_view_employee_hr(p_employee_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees employee
    where employee.id = p_employee_id
      and employee.organization_id = public.current_organization_id()
      and (
        employee.id = public.current_employee_id()
        or public.can_manage_hr()
        or public.has_org_role('chairman')
      )
  )
$function$;

alter table public.employee_hr_profiles enable row level security;
alter table public.employee_contracts enable row level security;
alter table public.employee_leave_balances enable row level security;
alter table public.employee_changes enable row level security;

drop policy if exists employee_hr_profiles_select_authorized
  on public.employee_hr_profiles;
create policy employee_hr_profiles_select_authorized
on public.employee_hr_profiles for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.can_manage_hr()
    or public.has_org_role('chairman')
  )
);

drop policy if exists employee_contracts_select_authorized
  on public.employee_contracts;
create policy employee_contracts_select_authorized
on public.employee_contracts for select to authenticated
using (public.can_view_employee_hr(employee_id));

drop policy if exists employee_leave_balances_select_authorized
  on public.employee_leave_balances;
create policy employee_leave_balances_select_authorized
on public.employee_leave_balances for select to authenticated
using (public.can_view_employee_hr(employee_id));

drop policy if exists employee_changes_select_authorized
  on public.employee_changes;
create policy employee_changes_select_authorized
on public.employee_changes for select to authenticated
using (public.can_view_employee_hr(employee_id));

revoke all on table public.employee_hr_profiles from anon, authenticated;
revoke all on table public.employee_contracts from anon, authenticated;
revoke all on table public.employee_leave_balances from anon, authenticated;
revoke all on table public.employee_changes from anon, authenticated;
grant select on table public.employee_hr_profiles to authenticated;
grant select on table public.employee_contracts to authenticated;
grant select on table public.employee_leave_balances to authenticated;
grant select on table public.employee_changes to authenticated;

create or replace function public.save_employee_hr_profile(
  p_employee_id uuid,
  p_work_location text,
  p_probation_end_on date,
  p_regularized_on date,
  p_departure_on date,
  p_personnel_note text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以维护人事档案'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.employees
    where id = p_employee_id and organization_id = v_actor.organization_id
  ) then
    raise exception '员工不存在或不属于当前组织'
      using errcode = '42501';
  end if;

  if p_regularized_on is not null
    and p_probation_end_on is not null
    and p_regularized_on > p_probation_end_on
  then
    raise exception '转正日期不能晚于试用期结束日期'
      using errcode = '22023';
  end if;

  insert into public.employee_hr_profiles (
    employee_id,
    organization_id,
    work_location,
    probation_end_on,
    regularized_on,
    departure_on,
    personnel_note,
    updated_by_employee_id
  )
  values (
    p_employee_id,
    v_actor.organization_id,
    nullif(btrim(coalesce(p_work_location, '')), ''),
    p_probation_end_on,
    p_regularized_on,
    p_departure_on,
    nullif(btrim(coalesce(p_personnel_note, '')), ''),
    v_actor.id
  )
  on conflict (employee_id) do update set
    work_location = excluded.work_location,
    probation_end_on = excluded.probation_end_on,
    regularized_on = excluded.regularized_on,
    departure_on = excluded.departure_on,
    personnel_note = excluded.personnel_note,
    updated_by_employee_id = excluded.updated_by_employee_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'employee_hr_profile_saved',
    'employee',
    p_employee_id,
    '更新员工人事档案'
  );
end;
$function$;

create or replace function public.create_employee_contract(
  p_employee_id uuid,
  p_contract_no text,
  p_contract_type text,
  p_starts_on date,
  p_ends_on date,
  p_probation_end_on date,
  p_status text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_contract_id uuid;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以登记员工合同'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.employees
    where id = p_employee_id and organization_id = v_actor.organization_id
  ) or char_length(btrim(coalesce(p_contract_no, ''))) < 2
    or p_contract_type not in (
      'fixed_term', 'indefinite', 'intern', 'part_time',
      'confidentiality', 'other'
    )
    or p_status not in ('draft', 'active', 'expired', 'terminated')
    or (p_ends_on is not null and p_ends_on < p_starts_on)
  then
    raise exception '员工合同参数无效'
      using errcode = '22023';
  end if;

  insert into public.employee_contracts (
    organization_id,
    employee_id,
    contract_no,
    contract_type,
    starts_on,
    ends_on,
    probation_end_on,
    status,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    p_employee_id,
    btrim(p_contract_no),
    p_contract_type,
    p_starts_on,
    p_ends_on,
    p_probation_end_on,
    p_status,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  )
  returning id into v_contract_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'employee_contract_created',
    'employee_contract',
    v_contract_id,
    '登记员工合同：' || btrim(p_contract_no)
  );

  return btrim(p_contract_no);
exception
  when unique_violation then
    raise exception '合同编号已存在' using errcode = '23505';
end;
$function$;

create or replace function public.save_employee_leave_balance(
  p_employee_id uuid,
  p_balance_year integer,
  p_annual_entitled numeric,
  p_annual_used numeric,
  p_compensatory_entitled numeric,
  p_compensatory_used numeric,
  p_sick_used numeric
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以维护假期账户'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.employees
    where id = p_employee_id and organization_id = v_actor.organization_id
  ) or p_balance_year not between 2020 and 2100
    or least(
      p_annual_entitled,
      p_annual_used,
      p_compensatory_entitled,
      p_compensatory_used,
      p_sick_used
    ) < 0
    or p_annual_used > p_annual_entitled
    or p_compensatory_used > p_compensatory_entitled
  then
    raise exception '假期账户参数无效'
      using errcode = '22023';
  end if;

  insert into public.employee_leave_balances (
    organization_id,
    employee_id,
    balance_year,
    annual_entitled,
    annual_used,
    compensatory_entitled,
    compensatory_used,
    sick_used,
    updated_by_employee_id
  )
  values (
    v_actor.organization_id,
    p_employee_id,
    p_balance_year,
    p_annual_entitled,
    p_annual_used,
    p_compensatory_entitled,
    p_compensatory_used,
    p_sick_used,
    v_actor.id
  )
  on conflict (organization_id, employee_id, balance_year) do update set
    annual_entitled = excluded.annual_entitled,
    annual_used = excluded.annual_used,
    compensatory_entitled = excluded.compensatory_entitled,
    compensatory_used = excluded.compensatory_used,
    sick_used = excluded.sick_used,
    updated_by_employee_id = excluded.updated_by_employee_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'employee_leave_balance_saved',
    'employee',
    p_employee_id,
    '更新 ' || p_balance_year::text || ' 年假期账户'
  );
end;
$function$;

create or replace function public.record_employee_change(
  p_employee_id uuid,
  p_change_type text,
  p_effective_on date,
  p_to_department_id uuid,
  p_to_title text,
  p_to_employment_status text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_employee public.employees%rowtype;
  v_change_id uuid;
  v_account_status text;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以登记员工异动'
      using errcode = '42501';
  end if;

  select * into v_employee
  from public.employees
  where id = p_employee_id and organization_id = v_actor.organization_id
  for update;

  if v_employee.id is null
    or p_change_type not in (
      'hire', 'transfer', 'promotion', 'regularization',
      'departure', 'rehire', 'other'
    )
    or p_to_employment_status not in (
      'active', 'departed', 'probation', 'intern', 'part_time'
    )
    or char_length(btrim(coalesce(p_reason, ''))) < 2
    or (
      p_to_department_id is not null
      and not exists (
        select 1 from public.departments
        where id = p_to_department_id
          and organization_id = v_actor.organization_id
          and status = 'active'
      )
    )
  then
    raise exception '员工异动参数无效'
      using errcode = '22023';
  end if;

  if v_employee.id = v_actor.id and p_to_employment_status = 'departed' then
    raise exception '不能将当前登录账号设为已离职'
      using errcode = '23514';
  end if;

  insert into public.employee_changes (
    organization_id,
    employee_id,
    change_type,
    effective_on,
    from_department_id,
    to_department_id,
    from_title,
    to_title,
    from_employment_status,
    to_employment_status,
    reason,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_employee.id,
    p_change_type,
    p_effective_on,
    v_employee.department_id,
    p_to_department_id,
    v_employee.title,
    nullif(btrim(coalesce(p_to_title, '')), ''),
    v_employee.employment_status,
    p_to_employment_status,
    btrim(p_reason),
    v_actor.id
  )
  returning id into v_change_id;

  v_account_status := case
    when p_to_employment_status = 'departed' then 'inactive'
    else 'active'
  end;

  update public.employees
  set
    department_id = p_to_department_id,
    title = nullif(btrim(coalesce(p_to_title, '')), ''),
    employment_status = p_to_employment_status,
    status = v_account_status
  where id = v_employee.id;

  if p_change_type = 'regularization' then
    insert into public.employee_hr_profiles (
      employee_id,
      organization_id,
      regularized_on,
      updated_by_employee_id
    )
    values (
      v_employee.id,
      v_actor.organization_id,
      p_effective_on,
      v_actor.id
    )
    on conflict (employee_id) do update set
      regularized_on = excluded.regularized_on,
      updated_by_employee_id = excluded.updated_by_employee_id;
  elsif p_change_type = 'departure' then
    insert into public.employee_hr_profiles (
      employee_id,
      organization_id,
      departure_on,
      updated_by_employee_id
    )
    values (
      v_employee.id,
      v_actor.organization_id,
      p_effective_on,
      v_actor.id
    )
    on conflict (employee_id) do update set
      departure_on = excluded.departure_on,
      updated_by_employee_id = excluded.updated_by_employee_id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'employee_change_recorded',
    'employee_change',
    v_change_id,
    '登记员工异动：' || p_change_type
  );

  return v_change_id;
end;
$function$;

revoke all on function public.can_manage_hr() from public;
revoke all on function public.can_view_employee_hr(uuid) from public;
revoke all on function public.save_employee_hr_profile(
  uuid, text, date, date, date, text
) from public;
revoke all on function public.create_employee_contract(
  uuid, text, text, date, date, date, text, text
) from public;
revoke all on function public.save_employee_leave_balance(
  uuid, integer, numeric, numeric, numeric, numeric, numeric
) from public;
revoke all on function public.record_employee_change(
  uuid, text, date, uuid, text, text, text
) from public;

grant execute on function public.can_manage_hr() to authenticated;
grant execute on function public.can_view_employee_hr(uuid) to authenticated;
grant execute on function public.save_employee_hr_profile(
  uuid, text, date, date, date, text
) to authenticated;
grant execute on function public.create_employee_contract(
  uuid, text, text, date, date, date, text, text
) to authenticated;
grant execute on function public.save_employee_leave_balance(
  uuid, integer, numeric, numeric, numeric, numeric, numeric
) to authenticated;
grant execute on function public.record_employee_change(
  uuid, text, date, uuid, text, text, text
) to authenticated;

comment on table public.employee_hr_profiles is
  '员工人事补充档案，不存储身份证、银行卡等高敏感字段。';
comment on table public.employee_contracts is
  '员工合同元数据，合同原件复用私有文件中心。';
comment on table public.employee_leave_balances is
  '员工年度假期账户，由人事维护并保留审计。';
comment on table public.employee_changes is
  '员工入职、调动、晋升、转正、离职和返聘历史。';

commit;
