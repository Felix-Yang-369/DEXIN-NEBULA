create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_no text not null,
  name text not null,
  customer_type text not null default 'enterprise'
    check (customer_type in ('catering', 'gift', 'distributor', 'enterprise', 'other')),
  level text not null default 'B' check (level in ('A', 'B', 'C')),
  status text not null default 'lead'
    check (status in ('lead', 'prospect', 'active', 'inactive')),
  source text,
  region text,
  address text,
  tags text[] not null default array[]::text[],
  owner_employee_id uuid references public.employees(id),
  last_contact_at timestamptz,
  next_follow_up_on date,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, customer_no),
  unique (organization_id, name)
);

create table if not exists public.customer_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  name text not null,
  position text,
  phone text,
  email text,
  wechat text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_followups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  followup_type text not null
    check (followup_type in ('call', 'wechat', 'visit', 'email', 'other')),
  summary text not null,
  next_follow_up_on date,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now()
);

create index if not exists customers_org_status_idx
  on public.customers (organization_id, status, updated_at desc);

create index if not exists customers_org_owner_idx
  on public.customers (organization_id, owner_employee_id);

create index if not exists customers_next_followup_idx
  on public.customers (organization_id, next_follow_up_on)
  where status in ('lead', 'prospect', 'active');

create index if not exists customer_contacts_customer_idx
  on public.customer_contacts (customer_id, is_primary desc);

create index if not exists customer_followups_customer_idx
  on public.customer_followups (customer_id, created_at desc);

drop trigger if exists set_customers_updated_at on public.customers;
create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

drop trigger if exists set_customer_contacts_updated_at on public.customer_contacts;
create trigger set_customer_contacts_updated_at
before update on public.customer_contacts
for each row execute function public.set_updated_at();

create or replace function public.can_manage_customers()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees e
    left join public.departments d on d.id = e.department_id
    where e.auth_user_id = (select auth.uid())
      and e.status = 'active'
      and (
        d.code in ('DX-SALES', 'DX-CS')
        or public.has_org_role('admin')
      )
  )
$function$;

create or replace function public.create_customer_with_contact(
  p_name text,
  p_customer_type text,
  p_level text,
  p_status text,
  p_source text,
  p_region text,
  p_address text,
  p_tags text[],
  p_owner_employee_id uuid,
  p_note text,
  p_contact_name text,
  p_contact_position text,
  p_contact_phone text,
  p_contact_email text,
  p_contact_wechat text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_customer_id uuid;
  v_customer_no text;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '只有销售、客服或系统管理员可以创建客户'
      using errcode = '42501';
  end if;

  if p_customer_type not in ('catering', 'gift', 'distributor', 'enterprise', 'other')
    or p_level not in ('A', 'B', 'C')
    or p_status not in ('lead', 'prospect', 'active', 'inactive')
  then
    raise exception '客户分类参数无效'
      using errcode = '22023';
  end if;

  if p_owner_employee_id is not null
    and not exists (
      select 1
      from public.employees
      where id = p_owner_employee_id
        and organization_id = v_actor.organization_id
        and status = 'active'
    )
  then
    raise exception '客户负责人不属于当前组织'
      using errcode = '42501';
  end if;

  v_customer_no := 'DXC-'
    || to_char(clock_timestamp(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.customers (
    organization_id,
    customer_no,
    name,
    customer_type,
    level,
    status,
    source,
    region,
    address,
    tags,
    owner_employee_id,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_customer_no,
    btrim(p_name),
    p_customer_type,
    p_level,
    p_status,
    nullif(btrim(coalesce(p_source, '')), ''),
    nullif(btrim(coalesce(p_region, '')), ''),
    nullif(btrim(coalesce(p_address, '')), ''),
    coalesce(p_tags, array[]::text[]),
    coalesce(p_owner_employee_id, v_actor.id),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  )
  returning id into v_customer_id;

  if nullif(btrim(coalesce(p_contact_name, '')), '') is not null then
    insert into public.customer_contacts (
      organization_id,
      customer_id,
      name,
      position,
      phone,
      email,
      wechat,
      is_primary
    )
    values (
      v_actor.organization_id,
      v_customer_id,
      btrim(p_contact_name),
      nullif(btrim(coalesce(p_contact_position, '')), ''),
      nullif(btrim(coalesce(p_contact_phone, '')), ''),
      nullif(btrim(coalesce(p_contact_email, '')), ''),
      nullif(btrim(coalesce(p_contact_wechat, '')), ''),
      true
    );
  end if;

  return jsonb_build_object(
    'id', v_customer_id,
    'customerNo', v_customer_no
  );
end;
$function$;

create or replace function public.record_customer_followup(
  p_customer_id uuid,
  p_followup_type text,
  p_summary text,
  p_next_follow_up_on date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_customer public.customers%rowtype;
  v_followup_id uuid;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '只有销售、客服或系统管理员可以记录客户跟进'
      using errcode = '42501';
  end if;

  if p_followup_type not in ('call', 'wechat', 'visit', 'email', 'other') then
    raise exception '跟进方式无效'
      using errcode = '22023';
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id
    and organization_id = v_actor.organization_id
  for update;

  if v_customer.id is null then
    raise exception '客户不存在或无权访问'
      using errcode = '42501';
  end if;

  insert into public.customer_followups (
    organization_id,
    customer_id,
    followup_type,
    summary,
    next_follow_up_on,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_customer.id,
    p_followup_type,
    btrim(p_summary),
    p_next_follow_up_on,
    v_actor.id
  )
  returning id into v_followup_id;

  update public.customers
  set
    last_contact_at = now(),
    next_follow_up_on = p_next_follow_up_on
  where id = v_customer.id;

  return jsonb_build_object(
    'id', v_followup_id,
    'customerId', v_customer.id
  );
end;
$function$;

alter table public.customers enable row level security;
alter table public.customer_contacts enable row level security;
alter table public.customer_followups enable row level security;

drop policy if exists "customers visible to authorized crm users" on public.customers;
create policy "customers visible to authorized crm users"
on public.customers for select
using (
  organization_id = public.current_organization_id()
  and (
    public.can_manage_customers()
    or public.has_org_role('chairman')
  )
);

drop policy if exists "customers manageable by crm users" on public.customers;
create policy "customers manageable by crm users"
on public.customers for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_customers()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_customers()
);

drop policy if exists "contacts visible to authorized crm users" on public.customer_contacts;
create policy "contacts visible to authorized crm users"
on public.customer_contacts for select
using (
  organization_id = public.current_organization_id()
  and (
    public.can_manage_customers()
    or public.has_org_role('chairman')
  )
);

drop policy if exists "contacts manageable by crm users" on public.customer_contacts;
create policy "contacts manageable by crm users"
on public.customer_contacts for all
using (
  organization_id = public.current_organization_id()
  and public.can_manage_customers()
)
with check (
  organization_id = public.current_organization_id()
  and public.can_manage_customers()
);

drop policy if exists "followups visible to authorized crm users" on public.customer_followups;
create policy "followups visible to authorized crm users"
on public.customer_followups for select
using (
  organization_id = public.current_organization_id()
  and (
    public.can_manage_customers()
    or public.has_org_role('chairman')
  )
);

comment on table public.customers is
  '德馨星云 CRM 客户主档、分级、负责人和跟进计划。';
comment on table public.customer_contacts is
  '客户联系人及企业联系方式，仅授权 CRM 用户可见。';
comment on table public.customer_followups is
  '客户沟通、拜访和下一步跟进记录。';

