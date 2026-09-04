-- Accounting Kernel V1: books, periods, chart of accounts and immutable posting.
-- Legacy finance_vouchers remain readable while workflows migrate to this kernel.

begin;

create table public.accounting_books (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,19}$'),
  name text not null,
  base_currency text not null default 'CNY' check (base_currency ~ '^[A-Z]{3}$'),
  accounting_standard text not null default 'CAS_SMALL',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.fiscal_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.accounting_books(id) on delete cascade,
  fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  period_no integer not null check (period_no between 1 and 13),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  status text not null default 'open' check (status in ('future', 'open', 'closing', 'closed')),
  closed_at timestamptz,
  closed_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  check (starts_on <= ends_on),
  unique (book_id, fiscal_year, period_no)
);

create table public.accounting_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.accounting_books(id) on delete cascade,
  parent_id uuid references public.accounting_accounts(id) on delete restrict,
  code text not null check (code ~ '^[0-9]{4,12}$'),
  name text not null,
  category text not null check (category in ('asset', 'liability', 'equity', 'cost', 'profit_loss')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  allow_posting boolean not null default true,
  requires_counterparty boolean not null default false,
  requires_department boolean not null default false,
  requires_project boolean not null default false,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, code)
);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  book_id uuid not null references public.accounting_books(id) on delete restrict,
  period_id uuid not null references public.fiscal_periods(id) on delete restrict,
  entry_no text not null,
  entry_date date not null,
  voucher_type text not null default '记',
  summary text not null,
  source_type text not null default 'manual',
  source_id uuid,
  status text not null default 'draft'
    check (status in ('draft', 'reviewed', 'posted', 'reversed', 'void')),
  attachment_count integer not null default 0 check (attachment_count >= 0),
  total_debit numeric(18, 2) not null default 0 check (total_debit >= 0),
  total_credit numeric(18, 2) not null default 0 check (total_credit >= 0),
  version integer not null default 1 check (version > 0),
  created_by_employee_id uuid not null references public.employees(id),
  reviewed_by_employee_id uuid references public.employees(id),
  posted_by_employee_id uuid references public.employees(id),
  reversed_entry_id uuid references public.journal_entries(id) on delete restrict,
  reviewed_at timestamptz,
  posted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (book_id, entry_no)
);

create table public.journal_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entry_id uuid not null references public.journal_entries(id) on delete cascade,
  line_no integer not null check (line_no > 0),
  account_id uuid not null references public.accounting_accounts(id) on delete restrict,
  summary text not null,
  debit_amount numeric(18, 2) not null default 0 check (debit_amount >= 0),
  credit_amount numeric(18, 2) not null default 0 check (credit_amount >= 0),
  currency text not null default 'CNY' check (currency ~ '^[A-Z]{3}$'),
  original_amount numeric(18, 2) not null default 0,
  exchange_rate numeric(18, 8) not null default 1 check (exchange_rate > 0),
  counterparty_type text,
  counterparty_id uuid,
  department_id uuid references public.departments(id) on delete restrict,
  project_code text,
  created_at timestamptz not null default now(),
  check ((debit_amount > 0 and credit_amount = 0) or (credit_amount > 0 and debit_amount = 0)),
  unique (entry_id, line_no)
);

create index fiscal_periods_book_status_idx on public.fiscal_periods (book_id, status, starts_on);
create index accounting_accounts_book_code_idx on public.accounting_accounts (book_id, code);
create index journal_entries_book_period_status_idx on public.journal_entries (book_id, period_id, status, entry_date);
create index journal_lines_entry_idx on public.journal_lines (entry_id, line_no);
create index journal_lines_account_idx on public.journal_lines (account_id, entry_id);
create unique index journal_entries_source_unique_idx
  on public.journal_entries (organization_id, source_type, source_id)
  where source_id is not null;

create trigger accounting_books_set_updated_at before update on public.accounting_books
for each row execute function public.set_updated_at();
create trigger accounting_accounts_set_updated_at before update on public.accounting_accounts
for each row execute function public.set_updated_at();
create trigger journal_entries_set_updated_at before update on public.journal_entries
for each row execute function public.set_updated_at();

alter table public.accounting_books enable row level security;
alter table public.fiscal_periods enable row level security;
alter table public.accounting_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy accounting_books_finance_read on public.accounting_books for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_access_permission('finance.voucher.create')
    or public.has_access_permission('finance.voucher.review')
    or public.has_access_permission('finance.voucher.post')
    or public.has_access_permission('finance.report.export')
  )
);
create policy fiscal_periods_finance_read on public.fiscal_periods for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.report.export')
));
create policy accounting_accounts_finance_read on public.accounting_accounts for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.report.export')
));
create policy journal_entries_finance_read on public.journal_entries for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.report.export')
));
create policy journal_lines_finance_read on public.journal_lines for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.report.export')
));

revoke all on table public.accounting_books from public, anon, authenticated;
revoke all on table public.fiscal_periods from public, anon, authenticated;
revoke all on table public.accounting_accounts from public, anon, authenticated;
revoke all on table public.journal_entries from public, anon, authenticated;
revoke all on table public.journal_lines from public, anon, authenticated;
grant select on table public.accounting_books to authenticated;
grant select on table public.fiscal_periods to authenticated;
grant select on table public.accounting_accounts to authenticated;
grant select on table public.journal_entries to authenticated;
grant select on table public.journal_lines to authenticated;

insert into public.accounting_books (organization_id, code, name)
select organization.id, 'PRIMARY', '法定主账簿'
from public.organizations organization
on conflict (organization_id, code) do nothing;

insert into public.fiscal_periods (
  organization_id, book_id, fiscal_year, period_no, name, starts_on, ends_on, status
)
select accounting_book.organization_id, accounting_book.id,
  extract(year from current_date)::integer, month_no,
  extract(year from current_date)::integer || '年' || month_no || '月',
  make_date(extract(year from current_date)::integer, month_no, 1),
  (make_date(extract(year from current_date)::integer, month_no, 1) + interval '1 month - 1 day')::date,
  case when month_no <= extract(month from current_date)::integer then 'open' else 'future' end
from public.accounting_books accounting_book
cross join generate_series(1, 12) month_no
where accounting_book.code = 'PRIMARY'
on conflict (book_id, fiscal_year, period_no) do nothing;

insert into public.accounting_accounts
  (organization_id, book_id, code, name, category, normal_balance, requires_counterparty)
select accounting_book.organization_id, accounting_book.id,
  seed.code, seed.name, seed.category, seed.normal_balance, seed.requires_counterparty
from public.accounting_books accounting_book
cross join (values
  ('1001', '库存现金', 'asset', 'debit', false),
  ('1002', '银行存款', 'asset', 'debit', false),
  ('1122', '应收账款', 'asset', 'debit', true),
  ('1405', '库存商品', 'asset', 'debit', false),
  ('1601', '固定资产', 'asset', 'debit', false),
  ('2001', '短期借款', 'liability', 'credit', false),
  ('2202', '应付账款', 'liability', 'credit', true),
  ('2221', '应交税费', 'liability', 'credit', false),
  ('4001', '实收资本', 'equity', 'credit', false),
  ('5001', '生产成本', 'cost', 'debit', false),
  ('6001', '主营业务收入', 'profit_loss', 'credit', false),
  ('6401', '主营业务成本', 'profit_loss', 'debit', false),
  ('6602', '管理费用', 'profit_loss', 'debit', false)
) as seed(code, name, category, normal_balance, requires_counterparty)
where accounting_book.code = 'PRIMARY'
on conflict (book_id, code) do nothing;

create or replace function public.create_journal_entry(
  p_book_id uuid,
  p_entry_date date,
  p_summary text,
  p_attachment_count integer,
  p_lines jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_period_id uuid;
  v_entry_id uuid;
  v_entry_no text;
  v_debit numeric(18, 2);
  v_credit numeric(18, 2);
  v_line_count integer;
begin
  if v_actor_id is null or not public.has_access_permission('finance.voucher.create') then
    raise exception '只有财务角色可以创建会计凭证' using errcode = '42501';
  end if;
  if p_entry_date is null
    or char_length(btrim(coalesce(p_summary, ''))) not between 2 and 200
    or p_attachment_count < 0
    or jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array'
  then
    raise exception '凭证参数无效' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.accounting_books accounting_book
    where accounting_book.id = p_book_id
      and accounting_book.organization_id = v_organization_id
      and accounting_book.status = 'active'
  ) then
    raise exception '账簿不存在或已停用' using errcode = '22023';
  end if;

  select period.id into v_period_id
  from public.fiscal_periods period
  where period.book_id = p_book_id
    and p_entry_date between period.starts_on and period.ends_on
    and period.status = 'open';
  if v_period_id is null then
    raise exception '凭证日期不在开放会计期间' using errcode = '23514';
  end if;

  select count(*), coalesce(sum(item.debit_amount), 0), coalesce(sum(item.credit_amount), 0)
  into v_line_count, v_debit, v_credit
  from jsonb_to_recordset(p_lines)
    as item(account_id uuid, summary text, debit_amount numeric, credit_amount numeric);
  if v_line_count < 2 or v_debit <= 0 or v_debit <> v_credit then
    raise exception '凭证至少两行且借贷金额必须相等' using errcode = '23514';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines)
      as item(account_id uuid, summary text, debit_amount numeric, credit_amount numeric)
    left join public.accounting_accounts account on account.id = item.account_id
    where account.id is null or account.book_id <> p_book_id
      or account.organization_id <> v_organization_id or account.status <> 'active'
      or account.allow_posting = false
      or char_length(btrim(coalesce(item.summary, ''))) not between 1 and 200
      or not ((item.debit_amount > 0 and item.credit_amount = 0)
        or (item.credit_amount > 0 and item.debit_amount = 0))
  ) then
    raise exception '凭证明细包含无效科目或金额' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_book_id::text || p_entry_date::text, 0));
  select '记-' || to_char(p_entry_date, 'YYYYMM') || '-' ||
    lpad((count(*) + 1)::text, 4, '0')
  into v_entry_no
  from public.journal_entries entry
  where entry.book_id = p_book_id
    and entry.entry_date >= date_trunc('month', p_entry_date)::date
    and entry.entry_date < (date_trunc('month', p_entry_date) + interval '1 month')::date;

  insert into public.journal_entries (
    organization_id, book_id, period_id, entry_no, entry_date, summary,
    attachment_count, total_debit, total_credit, created_by_employee_id
  ) values (
    v_organization_id, p_book_id, v_period_id, v_entry_no, p_entry_date,
    btrim(p_summary), p_attachment_count, v_debit, v_credit, v_actor_id
  ) returning id into v_entry_id;

  insert into public.journal_lines (
    organization_id, entry_id, line_no, account_id, summary, debit_amount, credit_amount
  )
  select v_organization_id, v_entry_id, (row_number() over ())::integer, item.account_id,
    btrim(item.summary), item.debit_amount, item.credit_amount
  from jsonb_to_recordset(p_lines)
    as item(account_id uuid, summary text, debit_amount numeric, credit_amount numeric);

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'journal_entry_created', 'journal_entry', v_entry_id,
    '创建会计凭证 ' || v_entry_no,
    jsonb_build_object('entryNo', v_entry_no, 'debit', v_debit, 'credit', v_credit)
  );

  return jsonb_build_object('id', v_entry_id, 'entryNo', v_entry_no, 'status', 'draft');
end;
$function$;

create or replace function public.transition_journal_entry(
  p_entry_id uuid,
  p_action text,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_entry public.journal_entries%rowtype;
  v_period_status text;
  v_next_status text;
begin
  if v_actor_id is null then
    raise exception '登录账号不可用' using errcode = '42501';
  end if;
  if p_action = 'review' and not public.has_access_permission('finance.voucher.review') then
    raise exception '缺少凭证审核权限' using errcode = '42501';
  end if;
  if p_action = 'post' and not public.has_access_permission('finance.voucher.post') then
    raise exception '缺少凭证过账权限' using errcode = '42501';
  end if;
  select * into v_entry from public.journal_entries
  where id = p_entry_id and organization_id = v_organization_id for update;
  if v_entry.id is null or v_entry.version <> p_expected_version then
    raise exception '凭证不存在或版本已变化' using errcode = '40001';
  end if;
  select status into v_period_status from public.fiscal_periods where id = v_entry.period_id;
  if v_period_status <> 'open' then
    raise exception '会计期间未开放' using errcode = '23514';
  end if;

  if p_action = 'review' and v_entry.status = 'draft' then
    if v_entry.created_by_employee_id = v_actor_id then
      raise exception '制单人不能审核本人凭证' using errcode = '23514';
    end if;
    v_next_status := 'reviewed';
    update public.journal_entries set status = v_next_status,
      reviewed_by_employee_id = v_actor_id, reviewed_at = now(), version = version + 1
    where id = p_entry_id;
  elsif p_action = 'post' and v_entry.status = 'reviewed' then
    if v_entry.created_by_employee_id = v_actor_id then
      raise exception '制单人不能过账本人凭证' using errcode = '23514';
    end if;
    if v_entry.total_debit <= 0 or v_entry.total_debit <> v_entry.total_credit then
      raise exception '借贷不平衡凭证不能过账' using errcode = '23514';
    end if;
    v_next_status := 'posted';
    update public.journal_entries set status = v_next_status,
      posted_by_employee_id = v_actor_id, posted_at = now(), version = version + 1
    where id = p_entry_id;
  else
    raise exception '凭证状态不允许执行该操作' using errcode = '23514';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'journal_entry_' || p_action, 'journal_entry', p_entry_id,
    case when p_action = 'review' then '审核会计凭证 ' else '过账会计凭证 ' end || v_entry.entry_no,
    jsonb_build_object('beforeStatus', v_entry.status, 'afterStatus', v_next_status)
  );

  return jsonb_build_object('id', p_entry_id, 'entryNo', v_entry.entry_no, 'status', v_next_status);
end;
$function$;

create or replace function public.prevent_posted_journal_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  if old.status in ('posted', 'reversed') then
    raise exception '已过账凭证不可直接修改或删除' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create trigger journal_entries_prevent_posted_mutation
before update or delete on public.journal_entries
for each row execute function public.prevent_posted_journal_mutation();

create or replace function public.prevent_posted_journal_line_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
declare
  v_entry_id uuid := coalesce(new.entry_id, old.entry_id);
begin
  if exists (
    select 1 from public.journal_entries entry
    where entry.id = v_entry_id and entry.status in ('posted', 'reversed')
  ) then
    raise exception '已过账凭证明细不可修改或删除' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create trigger journal_lines_prevent_posted_mutation
before update or delete on public.journal_lines
for each row execute function public.prevent_posted_journal_line_mutation();

revoke all on function public.create_journal_entry(uuid, date, text, integer, jsonb) from public, anon;
revoke all on function public.transition_journal_entry(uuid, text, integer) from public, anon;
grant execute on function public.create_journal_entry(uuid, date, text, integer, jsonb) to authenticated;
grant execute on function public.transition_journal_entry(uuid, text, integer) to authenticated;

commit;
