-- HRM organization foundation: job levels and positions.

begin;

create table if not exists public.job_levels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  rank integer not null check (rank > 0),
  description text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code),
  unique (organization_id, rank)
);

create table if not exists public.positions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid references public.departments(id) on delete set null,
  code text not null,
  name text not null,
  default_job_level_id uuid references public.job_levels(id) on delete set null,
  headcount integer check (headcount is null or headcount >= 0),
  responsibilities text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

alter table public.employees
  add column if not exists position_id uuid references public.positions(id) on delete set null;
alter table public.employees
  add column if not exists job_level_id uuid references public.job_levels(id) on delete set null;

create index if not exists positions_department_idx
  on public.positions (department_id, status, name);
create index if not exists employees_position_idx
  on public.employees (position_id);
create index if not exists employees_job_level_idx
  on public.employees (job_level_id);

drop trigger if exists job_levels_set_updated_at on public.job_levels;
create trigger job_levels_set_updated_at
before update on public.job_levels
for each row execute function public.set_updated_at();

drop trigger if exists positions_set_updated_at on public.positions;
create trigger positions_set_updated_at
before update on public.positions
for each row execute function public.set_updated_at();

alter table public.job_levels enable row level security;
alter table public.positions enable row level security;

drop policy if exists job_levels_select_same_org on public.job_levels;
create policy job_levels_select_same_org
on public.job_levels for select to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists positions_select_same_org on public.positions;
create policy positions_select_same_org
on public.positions for select to authenticated
using (organization_id = public.current_organization_id());

revoke all on table public.job_levels from anon, authenticated;
revoke all on table public.positions from anon, authenticated;
grant select on table public.job_levels to authenticated;
grant select on table public.positions to authenticated;

create or replace function public.save_job_level(
  p_level_id uuid,
  p_code text,
  p_name text,
  p_rank integer,
  p_description text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_level_id uuid;
begin
  if v_actor_id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以维护职级'
      using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_code, ''))) < 1
    or char_length(btrim(coalesce(p_name, ''))) < 2
    or p_rank <= 0
    or p_status not in ('active', 'inactive')
  then
    raise exception '职级参数无效' using errcode = '22023';
  end if;

  if p_level_id is null then
    insert into public.job_levels (
      organization_id, code, name, rank, description, status
    )
    values (
      v_organization_id,
      upper(btrim(p_code)),
      btrim(p_name),
      p_rank,
      nullif(btrim(coalesce(p_description, '')), ''),
      p_status
    )
    returning id into v_level_id;
  else
    update public.job_levels
    set
      code = upper(btrim(p_code)),
      name = btrim(p_name),
      rank = p_rank,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      status = p_status
    where id = p_level_id and organization_id = v_organization_id
    returning id into v_level_id;
  end if;

  if v_level_id is null then
    raise exception '职级不存在或不属于当前组织' using errcode = '42501';
  end if;
  return v_level_id;
exception
  when unique_violation then
    raise exception '职级代码或排序已存在' using errcode = '23505';
end;
$function$;

create or replace function public.save_position(
  p_position_id uuid,
  p_department_id uuid,
  p_code text,
  p_name text,
  p_default_job_level_id uuid,
  p_headcount integer,
  p_responsibilities text,
  p_status text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_position_id uuid;
begin
  if v_actor_id is null or not public.can_manage_hr() then
    raise exception '只有人事或管理员可以维护岗位'
      using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_code, ''))) < 2
    or char_length(btrim(coalesce(p_name, ''))) < 2
    or (p_headcount is not null and p_headcount < 0)
    or p_status not in ('active', 'inactive')
    or (
      p_department_id is not null
      and not exists (
        select 1 from public.departments
        where id = p_department_id
          and organization_id = v_organization_id
      )
    )
    or (
      p_default_job_level_id is not null
      and not exists (
        select 1 from public.job_levels
        where id = p_default_job_level_id
          and organization_id = v_organization_id
      )
    )
  then
    raise exception '岗位参数无效' using errcode = '22023';
  end if;

  if p_position_id is null then
    insert into public.positions (
      organization_id,
      department_id,
      code,
      name,
      default_job_level_id,
      headcount,
      responsibilities,
      status
    )
    values (
      v_organization_id,
      p_department_id,
      upper(btrim(p_code)),
      btrim(p_name),
      p_default_job_level_id,
      p_headcount,
      nullif(btrim(coalesce(p_responsibilities, '')), ''),
      p_status
    )
    returning id into v_position_id;
  else
    update public.positions
    set
      department_id = p_department_id,
      code = upper(btrim(p_code)),
      name = btrim(p_name),
      default_job_level_id = p_default_job_level_id,
      headcount = p_headcount,
      responsibilities = nullif(btrim(coalesce(p_responsibilities, '')), ''),
      status = p_status
    where id = p_position_id and organization_id = v_organization_id
    returning id into v_position_id;
  end if;

  if v_position_id is null then
    raise exception '岗位不存在或不属于当前组织' using errcode = '42501';
  end if;
  return v_position_id;
exception
  when unique_violation then
    raise exception '岗位代码已存在' using errcode = '23505';
end;
$function$;

revoke all on function public.save_job_level(
  uuid, text, text, integer, text, text
) from public;
revoke all on function public.save_position(
  uuid, uuid, text, text, uuid, integer, text, text
) from public;
grant execute on function public.save_job_level(
  uuid, text, text, integer, text, text
) to authenticated;
grant execute on function public.save_position(
  uuid, uuid, text, text, uuid, integer, text, text
) to authenticated;

comment on table public.job_levels is 'HRM 职级主数据，例如 P1、P2、P3。';
comment on table public.positions is 'HRM 岗位主数据，关联部门、默认职级和编制。';

commit;
