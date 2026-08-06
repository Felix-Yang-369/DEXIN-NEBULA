-- Separate CRM customer relationships from legal settlement entities.

begin;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create table public.customer_legal_entities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  customer_id uuid not null references public.customers(id) on delete cascade,
  entity_code text not null,
  legal_name text not null,
  short_name text,
  unified_social_credit_code text,
  entity_type text not null default 'company'
    check (entity_type in ('company', 'individual_business', 'government', 'other')),
  taxpayer_type text not null default 'general'
    check (taxpayer_type in ('general', 'small_scale', 'non_taxable', 'other')),
  registered_address text,
  invoice_phone text,
  invoice_email text,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  is_default boolean not null default false,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, entity_code),
  unique (organization_id, legal_name),
  check (
    unified_social_credit_code is null
    or unified_social_credit_code ~ '^[0-9A-Z]{18}$'
  )
);

create table public.legal_entity_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  legal_entity_id uuid not null references public.customer_legal_entities(id) on delete cascade,
  account_name text not null,
  bank_name text not null,
  bank_branch text,
  account_no text not null,
  currency text not null default 'CNY' check (currency ~ '^[A-Z]{3}$'),
  is_default boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, legal_entity_id, account_no)
);

create index customer_legal_entities_customer_idx
  on public.customer_legal_entities (customer_id, is_default desc, legal_name);
create unique index customer_legal_entities_default_idx
  on public.customer_legal_entities (customer_id)
  where is_default and status = 'active';
create unique index customer_legal_entities_credit_code_idx
  on public.customer_legal_entities (organization_id, unified_social_credit_code)
  where unified_social_credit_code is not null;
create index legal_entity_bank_accounts_entity_idx
  on public.legal_entity_bank_accounts (legal_entity_id, is_default desc, created_at);
create unique index legal_entity_bank_accounts_default_idx
  on public.legal_entity_bank_accounts (legal_entity_id)
  where is_default and status = 'active';

create trigger customer_legal_entities_set_updated_at
before update on public.customer_legal_entities
for each row execute function public.set_updated_at();

create trigger legal_entity_bank_accounts_set_updated_at
before update on public.legal_entity_bank_accounts
for each row execute function public.set_updated_at();

create or replace function app_private.sync_legal_entity_default()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if tg_table_name = 'customer_legal_entities' then
    if not exists (
      select 1 from public.customer_legal_entities entity
      where entity.customer_id = new.customer_id
        and entity.id <> new.id
        and entity.status = 'active'
    ) then
      new.is_default := true;
    elsif new.is_default and new.status = 'active' then
      update public.customer_legal_entities
      set is_default = false
      where customer_id = new.customer_id
        and id <> new.id
        and is_default;
    end if;
  elsif tg_table_name = 'legal_entity_bank_accounts' then
    if not exists (
      select 1 from public.legal_entity_bank_accounts account
      where account.legal_entity_id = new.legal_entity_id
        and account.id <> new.id
        and account.status = 'active'
    ) then
      new.is_default := true;
    elsif new.is_default and new.status = 'active' then
      update public.legal_entity_bank_accounts
      set is_default = false
      where legal_entity_id = new.legal_entity_id
        and id <> new.id
        and is_default;
    end if;
  end if;
  return new;
end;
$function$;

revoke all on function app_private.sync_legal_entity_default() from public, anon, authenticated;

create trigger sync_customer_legal_entity_default
before insert or update of is_default, status
on public.customer_legal_entities
for each row execute function app_private.sync_legal_entity_default();

create trigger sync_legal_entity_bank_account_default
before insert or update of is_default, status
on public.legal_entity_bank_accounts
for each row execute function app_private.sync_legal_entity_default();

create or replace function app_private.audit_customer_legal_entity_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid;
begin
  select employee.id into v_actor_id
  from public.employees employee
  where employee.auth_user_id = (select auth.uid())
    and employee.organization_id = new.organization_id
    and employee.status = 'active'
  limit 1;

  if v_actor_id is not null then
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
      v_actor_id,
      case when tg_op = 'INSERT' then 'customer_legal_entity_created'
        else 'customer_legal_entity_updated' end,
      'customer_legal_entity',
      new.id,
      case when tg_op = 'INSERT' then '新增法律实体：'
        else '更新法律实体：' end || new.legal_name,
      jsonb_build_object(
        'customer_id', new.customer_id,
        'entity_code', new.entity_code,
        'is_default', new.is_default
      )
    );
  end if;
  return new;
end;
$function$;

revoke all on function app_private.audit_customer_legal_entity_change()
  from public, anon, authenticated;

create trigger audit_customer_legal_entity_change
after insert or update on public.customer_legal_entities
for each row execute function app_private.audit_customer_legal_entity_change();

alter table public.customer_legal_entities enable row level security;
alter table public.legal_entity_bank_accounts enable row level security;

create policy customer_legal_entities_select_authorized
on public.customer_legal_entities for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.can_manage_customers())
    or (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

create policy customer_legal_entities_insert_authorized
on public.customer_legal_entities for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (
    (select public.can_manage_customers())
    or (select public.has_org_role('finance'))
  )
);

create policy customer_legal_entities_update_authorized
on public.customer_legal_entities for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.can_manage_customers())
    or (select public.has_org_role('finance'))
  )
)
with check (
  organization_id = (select public.current_organization_id())
  and (
    (select public.can_manage_customers())
    or (select public.has_org_role('finance'))
  )
);

create policy legal_entity_bank_accounts_select_finance
on public.legal_entity_bank_accounts for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

create policy legal_entity_bank_accounts_insert_finance
on public.legal_entity_bank_accounts for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.has_org_role('finance'))
);

create policy legal_entity_bank_accounts_update_finance
on public.legal_entity_bank_accounts for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.has_org_role('finance'))
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.has_org_role('finance'))
);

revoke all on table public.customer_legal_entities from anon, authenticated;
revoke all on table public.legal_entity_bank_accounts from anon, authenticated;
grant select, insert, update on table public.customer_legal_entities to authenticated;
grant select, insert, update on table public.legal_entity_bank_accounts to authenticated;

alter table public.finance_documents
  add column legal_entity_id uuid references public.customer_legal_entities(id) on delete restrict;
alter table public.finance_settlements
  add column counterparty_bank_account_id uuid references public.legal_entity_bank_accounts(id) on delete set null;
alter table public.sales_quotes
  add column legal_entity_id uuid references public.customer_legal_entities(id) on delete set null;

create index finance_documents_legal_entity_idx
  on public.finance_documents (legal_entity_id, issue_date desc)
  where legal_entity_id is not null;
create index sales_quotes_legal_entity_idx
  on public.sales_quotes (legal_entity_id, created_at desc)
  where legal_entity_id is not null;

create or replace function app_private.validate_customer_legal_entity_reference()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_customer_id uuid;
  v_organization_id uuid;
  v_legal_name text;
begin
  if new.legal_entity_id is null then
    return new;
  end if;

  select entity.customer_id, entity.organization_id, entity.legal_name
  into v_customer_id, v_organization_id, v_legal_name
  from public.customer_legal_entities entity
  where entity.id = new.legal_entity_id
    and entity.status = 'active';

  if v_customer_id is null
    or v_organization_id <> new.organization_id
    or (new.customer_id is not null and new.customer_id <> v_customer_id)
  then
    raise exception '法律实体与客户或组织不匹配' using errcode = '23514';
  end if;

  new.customer_id := v_customer_id;
  if tg_table_name = 'finance_documents' then
    new.counterparty_name := v_legal_name;
  end if;
  return new;
end;
$function$;

revoke all on function app_private.validate_customer_legal_entity_reference()
  from public, anon, authenticated;

create trigger validate_finance_document_legal_entity
before insert or update of legal_entity_id, customer_id
on public.finance_documents
for each row execute function app_private.validate_customer_legal_entity_reference();

create trigger validate_sales_quote_legal_entity
before insert or update of legal_entity_id, customer_id
on public.sales_quotes
for each row execute function app_private.validate_customer_legal_entity_reference();

drop function if exists public.create_finance_document(
  text, uuid, text, text, text, date, date, numeric, text, text, text
);

create or replace function public.create_finance_document(
  p_document_type text,
  p_customer_id uuid,
  p_legal_entity_id uuid,
  p_counterparty_name text,
  p_source_type text,
  p_source_no text,
  p_issue_date date,
  p_due_date date,
  p_total_amount numeric,
  p_invoice_no text,
  p_summary text,
  p_note text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_document_id uuid;
  v_document_no text;
  v_customer_id uuid := p_customer_id;
  v_counterparty_name text := btrim(coalesce(p_counterparty_name, ''));
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以登记应收应付' using errcode = '42501';
  end if;

  if p_legal_entity_id is not null then
    select entity.customer_id, entity.legal_name
    into v_customer_id, v_counterparty_name
    from public.customer_legal_entities entity
    where entity.id = p_legal_entity_id
      and entity.organization_id = v_actor.organization_id
      and entity.status = 'active';
    if v_customer_id is null then
      raise exception '法律实体不存在或已停用' using errcode = '42501';
    end if;
  elsif p_customer_id is not null then
    raise exception '关联客户的财务单据必须选择法律实体' using errcode = '23514';
  end if;

  if p_document_type not in ('receivable', 'payable')
    or p_source_type not in ('manual', 'order', 'purchase', 'expense', 'other')
    or char_length(v_counterparty_name) < 2
    or char_length(btrim(coalesce(p_summary, ''))) < 2
    or p_total_amount <= 0
    or p_total_amount > 100000000
    or p_due_date < p_issue_date
  then
    raise exception '往来单据参数无效' using errcode = '22023';
  end if;

  v_document_no := case when p_document_type = 'receivable' then 'DXR-' else 'DXP-' end
    || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.finance_documents (
    organization_id, document_no, document_type, customer_id, legal_entity_id,
    counterparty_name, source_type, source_no, issue_date, due_date,
    total_amount, invoice_no, summary, note, created_by_employee_id
  ) values (
    v_actor.organization_id, v_document_no, p_document_type, v_customer_id,
    p_legal_entity_id, v_counterparty_name, p_source_type,
    nullif(btrim(coalesce(p_source_no, '')), ''), p_issue_date, p_due_date,
    p_total_amount, nullif(btrim(coalesce(p_invoice_no, '')), ''),
    btrim(p_summary), nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
  ) returning id into v_document_id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id,
    summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'finance_document_created',
    'finance_document', v_document_id,
    '登记' || case when p_document_type = 'receivable' then '应收' else '应付' end
      || '：' || v_counterparty_name,
    jsonb_build_object(
      'document_no', v_document_no,
      'customer_id', v_customer_id,
      'legal_entity_id', p_legal_entity_id,
      'amount', p_total_amount,
      'due_date', p_due_date
    )
  );
  return v_document_no;
end;
$function$;

revoke all on function public.create_finance_document(
  text, uuid, uuid, text, text, text, date, date, numeric, text, text, text
) from public, anon;
grant execute on function public.create_finance_document(
  text, uuid, uuid, text, text, text, date, date, numeric, text, text, text
) to authenticated;

-- Seed the first known customer relationship without guessing tax IDs.
with bawang as (
  select customer.id, customer.organization_id, customer.created_by_employee_id
  from public.customers customer
  where customer.name = '霸碗'
  order by customer.created_at
  limit 1
)
insert into public.customer_legal_entities (
  organization_id, customer_id, entity_code, legal_name, short_name,
  entity_type, taxpayer_type, status, is_default, created_by_employee_id
)
select
  bawang.organization_id,
  bawang.id,
  entity.entity_code,
  entity.legal_name,
  entity.short_name,
  'company',
  'general',
  'active',
  entity.is_default,
  bawang.created_by_employee_id
from bawang
cross join (
  values
    ('DXLE-BAWANG-GD', '广东霸碗供应链管理有限公司', '广东霸碗', true),
    ('DXLE-BAWANG-HN', '湖南霸味悠品供应链管理有限公司', '湖南霸味悠品', false)
) as entity(entity_code, legal_name, short_name, is_default)
on conflict (organization_id, legal_name) do nothing;

commit;
