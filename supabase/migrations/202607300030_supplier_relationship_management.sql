-- SRM phase 1: supplier master data, contacts and qualification register.

begin;

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_no text not null,
  name text not null,
  short_name text,
  unified_credit_code text,
  category text not null
    check (category in ('rice', 'oil', 'gift', 'logistics', 'packaging', 'service', 'other')),
  cooperation_level text not null default 'standard'
    check (cooperation_level in ('core', 'preferred', 'standard', 'backup')),
  cooperation_status text not null default 'candidate'
    check (cooperation_status in ('candidate', 'active', 'suspended', 'inactive')),
  legal_representative text,
  business_scope text,
  address text,
  settlement_terms text,
  owner_employee_id uuid references public.employees(id) on delete set null,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, supplier_no),
  unique nulls not distinct (organization_id, unified_credit_code)
);

create table if not exists public.supplier_contacts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  name text not null,
  position text,
  mobile text,
  email text,
  is_primary boolean not null default false,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (mobile is not null or email is not null)
);

create table if not exists public.supplier_qualifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete cascade,
  qualification_type text not null
    check (
      qualification_type in (
        'business_license',
        'food_production',
        'food_operation',
        'brand_authorization',
        'quality_report',
        'other'
      )
    ),
  name text not null,
  certificate_no text,
  effective_on date,
  expires_on date,
  business_document_id uuid references public.business_documents(id) on delete set null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_on is null or effective_on is null or expires_on >= effective_on)
);

create index if not exists suppliers_org_status_idx
  on public.suppliers (organization_id, cooperation_status, cooperation_level, name);
create index if not exists suppliers_owner_idx
  on public.suppliers (owner_employee_id, cooperation_status);
create index if not exists supplier_contacts_supplier_idx
  on public.supplier_contacts (supplier_id, is_primary desc, created_at);
create index if not exists supplier_qualifications_expiry_idx
  on public.supplier_qualifications (organization_id, expires_on)
  where status = 'active' and expires_on is not null;

drop trigger if exists suppliers_set_updated_at on public.suppliers;
create trigger suppliers_set_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();
drop trigger if exists supplier_contacts_set_updated_at on public.supplier_contacts;
create trigger supplier_contacts_set_updated_at
before update on public.supplier_contacts
for each row execute function public.set_updated_at();
drop trigger if exists supplier_qualifications_set_updated_at on public.supplier_qualifications;
create trigger supplier_qualifications_set_updated_at
before update on public.supplier_qualifications
for each row execute function public.set_updated_at();

create or replace function public.can_manage_suppliers()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.id = public.current_employee_id()
      and employee.status = 'active'
      and (
        department.code = 'DX-PROC'
        or public.has_org_role('admin')
        or public.has_org_role('chairman')
      )
  )
$function$;

alter table public.suppliers enable row level security;
alter table public.supplier_contacts enable row level security;
alter table public.supplier_qualifications enable row level security;

drop policy if exists suppliers_select_current_org on public.suppliers;
create policy suppliers_select_current_org
on public.suppliers for select to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists supplier_contacts_select_current_org on public.supplier_contacts;
create policy supplier_contacts_select_current_org
on public.supplier_contacts for select to authenticated
using (organization_id = public.current_organization_id());

drop policy if exists supplier_qualifications_select_current_org
  on public.supplier_qualifications;
create policy supplier_qualifications_select_current_org
on public.supplier_qualifications for select to authenticated
using (organization_id = public.current_organization_id());

revoke all on table public.suppliers from anon, authenticated;
revoke all on table public.supplier_contacts from anon, authenticated;
revoke all on table public.supplier_qualifications from anon, authenticated;
grant select on table public.suppliers to authenticated;
grant select on table public.supplier_contacts to authenticated;
grant select on table public.supplier_qualifications to authenticated;

create or replace function public.save_supplier(
  p_supplier_id uuid,
  p_name text,
  p_short_name text,
  p_unified_credit_code text,
  p_category text,
  p_cooperation_level text,
  p_cooperation_status text,
  p_legal_representative text,
  p_business_scope text,
  p_address text,
  p_settlement_terms text,
  p_owner_employee_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_supplier_id uuid;
  v_supplier_no text;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';

  if v_actor.id is null or not public.can_manage_suppliers() then
    raise exception '只有采购、管理员或董事长可以维护供应商'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 2
    or p_category not in ('rice', 'oil', 'gift', 'logistics', 'packaging', 'service', 'other')
    or p_cooperation_level not in ('core', 'preferred', 'standard', 'backup')
    or p_cooperation_status not in ('candidate', 'active', 'suspended', 'inactive')
    or (
      p_owner_employee_id is not null
      and not exists (
        select 1 from public.employees
        where id = p_owner_employee_id
          and organization_id = v_actor.organization_id
          and status = 'active'
      )
    )
  then
    raise exception '供应商档案参数无效' using errcode = '22023';
  end if;

  if p_supplier_id is null then
    v_supplier_no := 'DXS-' || to_char(clock_timestamp(), 'YYYYMMDD')
      || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
    insert into public.suppliers (
      organization_id, supplier_no, name, short_name, unified_credit_code,
      category, cooperation_level, cooperation_status, legal_representative,
      business_scope, address, settlement_terms, owner_employee_id, note,
      created_by_employee_id
    ) values (
      v_actor.organization_id, v_supplier_no, btrim(p_name),
      nullif(btrim(coalesce(p_short_name, '')), ''),
      nullif(upper(btrim(coalesce(p_unified_credit_code, ''))), ''),
      p_category, p_cooperation_level, p_cooperation_status,
      nullif(btrim(coalesce(p_legal_representative, '')), ''),
      nullif(btrim(coalesce(p_business_scope, '')), ''),
      nullif(btrim(coalesce(p_address, '')), ''),
      nullif(btrim(coalesce(p_settlement_terms, '')), ''),
      p_owner_employee_id, nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
    ) returning id into v_supplier_id;
  else
    update public.suppliers set
      name = btrim(p_name),
      short_name = nullif(btrim(coalesce(p_short_name, '')), ''),
      unified_credit_code = nullif(upper(btrim(coalesce(p_unified_credit_code, ''))), ''),
      category = p_category,
      cooperation_level = p_cooperation_level,
      cooperation_status = p_cooperation_status,
      legal_representative = nullif(btrim(coalesce(p_legal_representative, '')), ''),
      business_scope = nullif(btrim(coalesce(p_business_scope, '')), ''),
      address = nullif(btrim(coalesce(p_address, '')), ''),
      settlement_terms = nullif(btrim(coalesce(p_settlement_terms, '')), ''),
      owner_employee_id = p_owner_employee_id,
      note = nullif(btrim(coalesce(p_note, '')), '')
    where id = p_supplier_id and organization_id = v_actor.organization_id
    returning id into v_supplier_id;
    if v_supplier_id is null then
      raise exception '供应商不存在或无权操作' using errcode = '42501';
    end if;
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  ) values (
    v_actor.organization_id, v_actor.id,
    case when p_supplier_id is null then 'supplier_created' else 'supplier_updated' end,
    'supplier', v_supplier_id,
    case when p_supplier_id is null then '创建供应商档案' else '更新供应商档案' end
  );
  return v_supplier_id;
exception
  when unique_violation then
    raise exception '统一社会信用代码已存在' using errcode = '23505';
end;
$function$;

create or replace function public.add_supplier_contact(
  p_supplier_id uuid,
  p_name text,
  p_position text,
  p_mobile text,
  p_email text,
  p_is_primary boolean,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_contact_id uuid;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_suppliers() then
    raise exception '无供应商维护权限' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and organization_id = v_actor.organization_id
  ) or char_length(btrim(coalesce(p_name, ''))) < 2
    or (
      nullif(btrim(coalesce(p_mobile, '')), '') is null
      and nullif(btrim(coalesce(p_email, '')), '') is null
    )
  then
    raise exception '供应商联系人参数无效' using errcode = '22023';
  end if;

  if coalesce(p_is_primary, false) then
    update public.supplier_contacts
    set is_primary = false
    where supplier_id = p_supplier_id;
  end if;

  insert into public.supplier_contacts (
    organization_id, supplier_id, name, position, mobile, email,
    is_primary, note, created_by_employee_id
  ) values (
    v_actor.organization_id, p_supplier_id, btrim(p_name),
    nullif(btrim(coalesce(p_position, '')), ''),
    nullif(btrim(coalesce(p_mobile, '')), ''),
    nullif(lower(btrim(coalesce(p_email, ''))), ''),
    coalesce(p_is_primary, false),
    nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
  ) returning id into v_contact_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  ) values (
    v_actor.organization_id, v_actor.id, 'supplier_contact_created',
    'supplier', p_supplier_id, '新增供应商联系人'
  );
  return v_contact_id;
end;
$function$;

create or replace function public.add_supplier_qualification(
  p_supplier_id uuid,
  p_qualification_type text,
  p_name text,
  p_certificate_no text,
  p_effective_on date,
  p_expires_on date,
  p_business_document_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_qualification_id uuid;
begin
  select * into v_actor from public.employees
  where id = public.current_employee_id() and status = 'active';
  if v_actor.id is null or not public.can_manage_suppliers() then
    raise exception '无供应商维护权限' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.suppliers
    where id = p_supplier_id and organization_id = v_actor.organization_id
  ) or p_qualification_type not in (
    'business_license', 'food_production', 'food_operation',
    'brand_authorization', 'quality_report', 'other'
  ) or char_length(btrim(coalesce(p_name, ''))) < 2
    or (p_expires_on is not null and p_effective_on is not null and p_expires_on < p_effective_on)
    or (
      p_business_document_id is not null
      and not exists (
        select 1 from public.business_documents
        where id = p_business_document_id
          and organization_id = v_actor.organization_id
          and category = 'supplier'
          and status = 'active'
      )
    )
  then
    raise exception '供应商资质参数无效' using errcode = '22023';
  end if;

  insert into public.supplier_qualifications (
    organization_id, supplier_id, qualification_type, name, certificate_no,
    effective_on, expires_on, business_document_id, note, created_by_employee_id
  ) values (
    v_actor.organization_id, p_supplier_id, p_qualification_type, btrim(p_name),
    nullif(btrim(coalesce(p_certificate_no, '')), ''), p_effective_on, p_expires_on,
    p_business_document_id, nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
  ) returning id into v_qualification_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  ) values (
    v_actor.organization_id, v_actor.id, 'supplier_qualification_created',
    'supplier', p_supplier_id, '登记供应商资质'
  );
  return v_qualification_id;
end;
$function$;

revoke all on function public.can_manage_suppliers() from public, anon;
revoke all on function public.save_supplier(
  uuid, text, text, text, text, text, text, text, text, text, text, uuid, text
) from public, anon;
revoke all on function public.add_supplier_contact(
  uuid, text, text, text, text, boolean, text
) from public, anon;
revoke all on function public.add_supplier_qualification(
  uuid, text, text, text, date, date, uuid, text
) from public, anon;
grant execute on function public.can_manage_suppliers() to authenticated;
grant execute on function public.save_supplier(
  uuid, text, text, text, text, text, text, text, text, text, text, uuid, text
) to authenticated;
grant execute on function public.add_supplier_contact(
  uuid, text, text, text, text, boolean, text
) to authenticated;
grant execute on function public.add_supplier_qualification(
  uuid, text, text, text, date, date, uuid, text
) to authenticated;

comment on table public.suppliers is
  'SRM supplier master data. Purchase orders and performance evaluation remain future phases.';

commit;
