-- Finance phase 2: receivables, payables, settlement reconciliation and vouchers.

begin;

create table if not exists public.finance_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_no text not null,
  document_type text not null
    check (document_type in ('receivable', 'payable')),
  customer_id uuid references public.customers(id) on delete set null,
  counterparty_name text not null,
  source_type text not null default 'manual'
    check (source_type in ('manual', 'order', 'purchase', 'expense', 'other')),
  source_no text,
  issue_date date not null default current_date,
  due_date date not null,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  settled_amount numeric(14, 2) not null default 0
    check (settled_amount >= 0 and settled_amount <= total_amount),
  status text not null default 'open'
    check (status in ('open', 'partial', 'settled', 'void')),
  invoice_no text,
  summary text not null,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_no)
);

create table if not exists public.finance_vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  voucher_no text not null,
  voucher_date date not null default current_date,
  voucher_type text not null
    check (voucher_type in ('receipt', 'payment', 'transfer', 'general')),
  summary text not null,
  debit_account text not null,
  credit_account text not null,
  amount numeric(14, 2) not null check (amount > 0),
  attachment_count integer not null default 0 check (attachment_count >= 0),
  status text not null default 'draft'
    check (status in ('draft', 'posted', 'void')),
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, voucher_no)
);

create table if not exists public.finance_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  settlement_no text not null,
  document_id uuid not null references public.finance_documents(id),
  transaction_id uuid not null references public.finance_transactions(id),
  voucher_id uuid not null references public.finance_vouchers(id),
  settlement_type text not null
    check (settlement_type in ('receipt', 'payment')),
  amount numeric(14, 2) not null check (amount > 0),
  settled_on date not null default current_date,
  payment_channel text not null default 'bank'
    check (payment_channel in ('bank', 'wechat', 'alipay', 'cash', 'other')),
  account_name text,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  unique (organization_id, settlement_no)
);

create index if not exists finance_documents_org_type_due_idx
  on public.finance_documents (organization_id, document_type, status, due_date);
create index if not exists finance_documents_customer_idx
  on public.finance_documents (customer_id, issue_date desc)
  where customer_id is not null;
create index if not exists finance_settlements_document_idx
  on public.finance_settlements (document_id, settled_on desc);
create index if not exists finance_vouchers_org_date_idx
  on public.finance_vouchers (organization_id, voucher_date desc, created_at desc);

drop trigger if exists finance_documents_set_updated_at
  on public.finance_documents;
create trigger finance_documents_set_updated_at
before update on public.finance_documents
for each row execute function public.set_updated_at();

drop trigger if exists finance_vouchers_set_updated_at
  on public.finance_vouchers;
create trigger finance_vouchers_set_updated_at
before update on public.finance_vouchers
for each row execute function public.set_updated_at();

alter table public.finance_documents enable row level security;
alter table public.finance_settlements enable row level security;
alter table public.finance_vouchers enable row level security;

drop policy if exists finance_documents_select_finance_chairman
  on public.finance_documents;
create policy finance_documents_select_finance_chairman
on public.finance_documents
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

drop policy if exists finance_settlements_select_finance_chairman
  on public.finance_settlements;
create policy finance_settlements_select_finance_chairman
on public.finance_settlements
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

drop policy if exists finance_vouchers_select_finance_chairman
  on public.finance_vouchers;
create policy finance_vouchers_select_finance_chairman
on public.finance_vouchers
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

revoke all on table public.finance_documents from anon, authenticated;
revoke all on table public.finance_settlements from anon, authenticated;
revoke all on table public.finance_vouchers from anon, authenticated;
grant select on table public.finance_documents to authenticated;
grant select on table public.finance_settlements to authenticated;
grant select on table public.finance_vouchers to authenticated;

create or replace function public.finance_customer_options()
returns table (
  id uuid,
  customer_no text,
  name text
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select customer.id, customer.customer_no, customer.name
  from public.customers customer
  where customer.organization_id = public.current_organization_id()
    and customer.status <> 'inactive'
    and (
      public.has_org_role('finance')
      or public.has_org_role('chairman')
    )
  order by customer.name
$function$;

create or replace function public.create_finance_document(
  p_document_type text,
  p_customer_id uuid,
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
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以登记应收应付'
      using errcode = '42501';
  end if;

  if p_document_type not in ('receivable', 'payable')
    or p_source_type not in ('manual', 'order', 'purchase', 'expense', 'other')
    or char_length(btrim(coalesce(p_counterparty_name, ''))) < 2
    or char_length(btrim(coalesce(p_summary, ''))) < 2
    or p_total_amount <= 0
    or p_total_amount > 100000000
    or p_due_date < p_issue_date
  then
    raise exception '往来单据参数无效'
      using errcode = '22023';
  end if;

  if p_customer_id is not null
    and not exists (
      select 1
      from public.customers
      where id = p_customer_id
        and organization_id = v_actor.organization_id
    )
  then
    raise exception '关联客户不存在'
      using errcode = '42501';
  end if;

  v_document_no := case
    when p_document_type = 'receivable' then 'DXR-'
    else 'DXP-'
  end
    || to_char(clock_timestamp(), 'YYYYMMDD')
    || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.finance_documents (
    organization_id,
    document_no,
    document_type,
    customer_id,
    counterparty_name,
    source_type,
    source_no,
    issue_date,
    due_date,
    total_amount,
    invoice_no,
    summary,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_document_no,
    p_document_type,
    p_customer_id,
    btrim(p_counterparty_name),
    p_source_type,
    nullif(btrim(coalesce(p_source_no, '')), ''),
    p_issue_date,
    p_due_date,
    p_total_amount,
    nullif(btrim(coalesce(p_invoice_no, '')), ''),
    btrim(p_summary),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  )
  returning id into v_document_id;

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
    v_actor.organization_id,
    v_actor.id,
    'finance_document_created',
    'finance_document',
    v_document_id,
    '登记' || case when p_document_type = 'receivable' then '应收' else '应付' end
      || '：' || btrim(p_counterparty_name),
    jsonb_build_object(
      'document_no', v_document_no,
      'amount', p_total_amount,
      'due_date', p_due_date
    )
  );

  return v_document_no;
end;
$function$;

create or replace function public.settle_finance_document(
  p_document_id uuid,
  p_amount numeric,
  p_settled_on date,
  p_payment_channel text,
  p_account_name text,
  p_debit_account text,
  p_credit_account text,
  p_attachment_count integer,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_document public.finance_documents%rowtype;
  v_remaining numeric(14, 2);
  v_settled_total numeric(14, 2);
  v_settlement_type text;
  v_transaction_type text;
  v_settlement_no text;
  v_transaction_no text;
  v_voucher_no text;
  v_transaction_id uuid;
  v_voucher_id uuid;
  v_settlement_id uuid;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以执行核销'
      using errcode = '42501';
  end if;

  select *
  into v_document
  from public.finance_documents
  where id = p_document_id
    and organization_id = v_actor.organization_id
  for update;

  if v_document.id is null or v_document.status in ('settled', 'void') then
    raise exception '往来单据不存在或当前状态不可核销'
      using errcode = '42501';
  end if;

  v_remaining := v_document.total_amount - v_document.settled_amount;
  if p_amount <= 0
    or p_amount > v_remaining
    or p_payment_channel not in ('bank', 'wechat', 'alipay', 'cash', 'other')
    or char_length(btrim(coalesce(p_debit_account, ''))) < 2
    or char_length(btrim(coalesce(p_credit_account, ''))) < 2
    or coalesce(p_attachment_count, 0) < 0
  then
    raise exception '核销参数无效或金额超过未核销余额'
      using errcode = '22023';
  end if;

  v_settlement_type := case
    when v_document.document_type = 'receivable' then 'receipt'
    else 'payment'
  end;
  v_transaction_type := case
    when v_document.document_type = 'receivable' then 'income'
    else 'expense'
  end;
  v_settlement_no := 'DXS-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_transaction_no := 'DXF-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_voucher_no := 'DXV-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.finance_transactions (
    organization_id,
    transaction_no,
    transaction_type,
    category,
    counterparty,
    amount,
    occurred_on,
    payment_channel,
    account_name,
    voucher_no,
    status,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_transaction_no,
    v_transaction_type,
    case when v_transaction_type = 'income' then '应收核销' else '应付核销' end,
    v_document.counterparty_name,
    p_amount,
    p_settled_on,
    p_payment_channel,
    nullif(btrim(coalesce(p_account_name, '')), ''),
    v_voucher_no,
    'confirmed',
    '核销单据 ' || v_document.document_no,
    v_actor.id
  )
  returning id into v_transaction_id;

  insert into public.finance_vouchers (
    organization_id,
    voucher_no,
    voucher_date,
    voucher_type,
    summary,
    debit_account,
    credit_account,
    amount,
    attachment_count,
    status,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_voucher_no,
    p_settled_on,
    v_settlement_type,
    case when v_settlement_type = 'receipt' then '收到' else '支付' end
      || v_document.counterparty_name || '往来款',
    btrim(p_debit_account),
    btrim(p_credit_account),
    p_amount,
    coalesce(p_attachment_count, 0),
    'posted',
    v_actor.id
  )
  returning id into v_voucher_id;

  insert into public.finance_settlements (
    organization_id,
    settlement_no,
    document_id,
    transaction_id,
    voucher_id,
    settlement_type,
    amount,
    settled_on,
    payment_channel,
    account_name,
    note,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_settlement_no,
    v_document.id,
    v_transaction_id,
    v_voucher_id,
    v_settlement_type,
    p_amount,
    p_settled_on,
    p_payment_channel,
    nullif(btrim(coalesce(p_account_name, '')), ''),
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  )
  returning id into v_settlement_id;

  v_settled_total := v_document.settled_amount + p_amount;
  update public.finance_documents
  set
    settled_amount = v_settled_total,
    status = case
      when v_settled_total = total_amount then 'settled'
      else 'partial'
    end
  where id = v_document.id;

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
    v_actor.organization_id,
    v_actor.id,
    'finance_document_settled',
    'finance_settlement',
    v_settlement_id,
    '核销' || v_document.document_no || '：' || p_amount::text || '元',
    jsonb_build_object(
      'settlement_no', v_settlement_no,
      'transaction_no', v_transaction_no,
      'voucher_no', v_voucher_no,
      'remaining_amount', v_document.total_amount - v_settled_total
    )
  );

  return jsonb_build_object(
    'settlementNo', v_settlement_no,
    'voucherNo', v_voucher_no,
    'remainingAmount', v_document.total_amount - v_settled_total
  );
end;
$function$;

create or replace function public.create_finance_voucher(
  p_voucher_date date,
  p_voucher_type text,
  p_summary text,
  p_debit_account text,
  p_credit_account text,
  p_amount numeric,
  p_attachment_count integer,
  p_status text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_voucher_id uuid;
  v_voucher_no text;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以登记凭证'
      using errcode = '42501';
  end if;

  if p_voucher_type not in ('receipt', 'payment', 'transfer', 'general')
    or p_status not in ('draft', 'posted')
    or char_length(btrim(coalesce(p_summary, ''))) < 2
    or char_length(btrim(coalesce(p_debit_account, ''))) < 2
    or char_length(btrim(coalesce(p_credit_account, ''))) < 2
    or p_amount <= 0
    or p_amount > 100000000
    or coalesce(p_attachment_count, 0) < 0
  then
    raise exception '凭证参数无效'
      using errcode = '22023';
  end if;

  v_voucher_no := 'DXV-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.finance_vouchers (
    organization_id,
    voucher_no,
    voucher_date,
    voucher_type,
    summary,
    debit_account,
    credit_account,
    amount,
    attachment_count,
    status,
    created_by_employee_id
  )
  values (
    v_actor.organization_id,
    v_voucher_no,
    p_voucher_date,
    p_voucher_type,
    btrim(p_summary),
    btrim(p_debit_account),
    btrim(p_credit_account),
    p_amount,
    coalesce(p_attachment_count, 0),
    p_status,
    v_actor.id
  )
  returning id into v_voucher_id;

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
    v_actor.organization_id,
    v_actor.id,
    'finance_voucher_created',
    'finance_voucher',
    v_voucher_id,
    '登记财务凭证：' || v_voucher_no,
    jsonb_build_object('amount', p_amount, 'status', p_status)
  );

  return v_voucher_no;
end;
$function$;

revoke all on function public.finance_customer_options() from public;
revoke all on function public.create_finance_document(
  text, uuid, text, text, text, date, date, numeric, text, text, text
) from public;
revoke all on function public.settle_finance_document(
  uuid, numeric, date, text, text, text, text, integer, text
) from public;
revoke all on function public.create_finance_voucher(
  date, text, text, text, text, numeric, integer, text
) from public;

grant execute on function public.finance_customer_options() to authenticated;
grant execute on function public.create_finance_document(
  text, uuid, text, text, text, date, date, numeric, text, text, text
) to authenticated;
grant execute on function public.settle_finance_document(
  uuid, numeric, date, text, text, text, text, integer, text
) to authenticated;
grant execute on function public.create_finance_voucher(
  date, text, text, text, text, numeric, integer, text
) to authenticated;

comment on table public.finance_documents is
  '应收应付往来单据，余额通过核销事务更新。';
comment on table public.finance_settlements is
  '收付款核销记录，关联现金流水和会计凭证。';
comment on table public.finance_vouchers is
  '简式借贷记账凭证，核销自动生成并允许财务手工登记。';

commit;
