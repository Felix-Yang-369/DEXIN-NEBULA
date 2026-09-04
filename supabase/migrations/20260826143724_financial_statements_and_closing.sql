-- Accounting V3: opening-balance migration, controlled period closing and
-- statutory statement foundations. Cash-flow ambiguity remains visible.

begin;

insert into public.access_permissions
  (code, module, resource, action, name, description, risk_level, sort_order)
values
  ('finance.opening.manage', 'finance', 'opening', 'manage', '管理期初余额', '导入并生成期初余额凭证', 'high', 240),
  ('finance.closing.generate', 'finance', 'closing', 'generate', '生成期末结转', '生成损益结转凭证草稿', 'high', 250),
  ('finance.statement.view', 'finance', 'statement', 'view', '查看财务报表', '查看资产负债表、利润表和现金流量表', 'sensitive', 260),
  ('finance.cashflow.classify', 'finance', 'cashflow', 'classify', '配置现金流分类', '维护科目默认现金流分类规则', 'high', 270)
on conflict (code) do update set name = excluded.name,
  description = excluded.description, risk_level = excluded.risk_level,
  sort_order = excluded.sort_order;

insert into public.access_role_permissions
  (role_id, permission_id, effect, data_scope, field_access)
select access_role.id, permission.id, 'allow', 'organization', 'full'
from public.access_roles access_role
join public.access_permissions permission on permission.code in (
  'finance.opening.manage', 'finance.closing.generate',
  'finance.statement.view', 'finance.cashflow.classify'
)
where access_role.source_role_code = 'finance'
on conflict (role_id, permission_id) do nothing;

drop policy if exists accounting_books_finance_read on public.accounting_books;
create policy accounting_books_finance_read on public.accounting_books for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create') or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post') or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.account.manage') or public.has_access_permission('finance.period.manage')
  or public.has_access_permission('finance.period.close') or public.has_access_permission('finance.ledger.view')
  or public.has_access_permission('finance.report.export') or public.has_access_permission('finance.opening.manage')
  or public.has_access_permission('finance.closing.generate') or public.has_access_permission('finance.statement.view')
  or public.has_access_permission('finance.cashflow.classify')
));

drop policy if exists fiscal_periods_finance_read on public.fiscal_periods;
create policy fiscal_periods_finance_read on public.fiscal_periods for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create') or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post') or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.period.manage') or public.has_access_permission('finance.period.close')
  or public.has_access_permission('finance.ledger.view') or public.has_access_permission('finance.opening.manage')
  or public.has_access_permission('finance.closing.generate') or public.has_access_permission('finance.statement.view')
));

drop policy if exists accounting_accounts_finance_read on public.accounting_accounts;
create policy accounting_accounts_finance_read on public.accounting_accounts for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create') or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post') or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.account.manage') or public.has_access_permission('finance.ledger.view')
  or public.has_access_permission('finance.opening.manage') or public.has_access_permission('finance.closing.generate')
  or public.has_access_permission('finance.statement.view') or public.has_access_permission('finance.cashflow.classify')
));

drop policy if exists journal_entries_finance_read on public.journal_entries;
create policy journal_entries_finance_read on public.journal_entries for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create') or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post') or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.ledger.view') or public.has_access_permission('finance.opening.manage')
  or public.has_access_permission('finance.closing.generate') or public.has_access_permission('finance.statement.view')
));

drop policy if exists journal_lines_finance_read on public.journal_lines;
create policy journal_lines_finance_read on public.journal_lines for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create') or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post') or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.ledger.view') or public.has_access_permission('finance.opening.manage')
  or public.has_access_permission('finance.closing.generate') or public.has_access_permission('finance.statement.view')
));

alter table public.journal_entries
  add column is_opening boolean not null default false;

alter table public.fiscal_periods
  add column closing_entry_id uuid references public.journal_entries(id) on delete restrict;

insert into public.accounting_accounts
  (organization_id, book_id, code, name, category, normal_balance, allow_posting)
select book.organization_id, book.id, '4103', '本年利润', 'equity', 'credit', true
from public.accounting_books book
where book.code = 'PRIMARY'
on conflict (book_id, code) do nothing;

create table public.cash_flow_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]{2,39}$'),
  name text not null,
  activity_type text not null check (activity_type in ('operating', 'investing', 'financing', 'unclassified')),
  sort_order integer not null default 0,
  is_system boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.account_cash_flow_rules (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  account_id uuid primary key references public.accounting_accounts(id) on delete cascade,
  cash_flow_item_id uuid not null references public.cash_flow_items(id) on delete restrict,
  created_at timestamptz not null default now()
);

alter table public.cash_flow_items enable row level security;
alter table public.account_cash_flow_rules enable row level security;

create policy cash_flow_items_finance_read on public.cash_flow_items for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.statement.view') or public.has_access_permission('finance.cashflow.classify')
));
create policy account_cash_flow_rules_finance_read on public.account_cash_flow_rules for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.statement.view') or public.has_access_permission('finance.cashflow.classify')
));

revoke all on table public.cash_flow_items from public, anon, authenticated;
revoke all on table public.account_cash_flow_rules from public, anon, authenticated;
grant select on table public.cash_flow_items to authenticated;
grant select on table public.account_cash_flow_rules to authenticated;

insert into public.cash_flow_items (organization_id, code, name, activity_type, sort_order)
select organization.id, seed.code, seed.name, seed.activity_type, seed.sort_order
from public.organizations organization
cross join (values
  ('operating_receipts', '经营活动现金流入', 'operating', 10),
  ('operating_payments', '经营活动现金流出', 'operating', 20),
  ('investing', '投资活动现金流量', 'investing', 30),
  ('financing', '筹资活动现金流量', 'financing', 40),
  ('unclassified', '待分类现金流量', 'unclassified', 90)
) as seed(code, name, activity_type, sort_order)
on conflict (organization_id, code) do nothing;

insert into public.account_cash_flow_rules (organization_id, account_id, cash_flow_item_id)
select account.organization_id, account.id, item.id
from public.accounting_accounts account
join public.cash_flow_items item on item.organization_id = account.organization_id
  and item.code = case
    when account.code in ('1122', '6001') then 'operating_receipts'
    when account.code in ('1405', '2202', '2221', '5001', '6401', '6602') then 'operating_payments'
    when account.code = '1601' then 'investing'
    when account.code in ('2001', '4001') then 'financing'
    else 'unclassified'
  end
where account.code not in ('1001', '1002', '4103')
on conflict (account_id) do nothing;

create or replace function public.create_opening_balance_entry(
  p_book_id uuid,
  p_fiscal_year integer,
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
  v_period public.fiscal_periods%rowtype;
  v_entry_id uuid;
  v_debit numeric(18, 2);
  v_credit numeric(18, 2);
  v_count integer;
begin
  if v_actor_id is null or not public.has_access_permission('finance.opening.manage') then
    raise exception '缺少期初余额管理权限' using errcode = '42501';
  end if;
  select * into v_period from public.fiscal_periods period
  where period.book_id = p_book_id and period.fiscal_year = p_fiscal_year
    and period.period_no = 1 and period.organization_id = v_organization_id
    and period.status = 'open';
  if v_period.id is null or jsonb_typeof(coalesce(p_lines, '[]'::jsonb)) <> 'array' then
    raise exception '账簿、年度或期初余额格式无效' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.journal_entries entry
    join public.fiscal_periods period on period.id = entry.period_id
    where entry.book_id = p_book_id and period.fiscal_year = p_fiscal_year
      and entry.status <> 'void'
  ) then
    raise exception '该年度已有会计凭证，不能重新导入期初余额' using errcode = '23514';
  end if;

  select count(*), coalesce(sum(item.debit_amount), 0), coalesce(sum(item.credit_amount), 0)
  into v_count, v_debit, v_credit
  from jsonb_to_recordset(p_lines) as item(account_id uuid, debit_amount numeric, credit_amount numeric);
  if v_count < 2 or v_debit <= 0 or v_debit <> v_credit then
    raise exception '期初余额至少两行且借贷必须平衡' using errcode = '23514';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_lines) as item(account_id uuid, debit_amount numeric, credit_amount numeric)
    left join public.accounting_accounts account on account.id = item.account_id
    where account.id is null or account.book_id <> p_book_id
      or account.organization_id <> v_organization_id or account.status <> 'active'
      or account.allow_posting = false
      or not ((item.debit_amount > 0 and item.credit_amount = 0)
        or (item.credit_amount > 0 and item.debit_amount = 0))
  ) then
    raise exception '期初余额包含无效科目或金额' using errcode = '22023';
  end if;

  insert into public.journal_entries (
    organization_id, book_id, period_id, entry_no, entry_date, summary,
    source_type, source_id, status, total_debit, total_credit,
    created_by_employee_id, is_opening
  ) values (
    v_organization_id, p_book_id, v_period.id, '期初-' || p_fiscal_year,
    v_period.starts_on, p_fiscal_year || '年期初余额迁移',
    'opening_balance', v_period.id, 'draft', v_debit, v_credit,
    v_actor_id, true
  ) returning id into v_entry_id;

  insert into public.journal_lines (
    organization_id, entry_id, line_no, account_id, summary, debit_amount, credit_amount
  )
  select v_organization_id, v_entry_id, (row_number() over ())::integer,
    item.account_id, '期初余额', item.debit_amount, item.credit_amount
  from jsonb_to_recordset(p_lines) as item(account_id uuid, debit_amount numeric, credit_amount numeric);

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'opening_balance_entry_created', 'journal_entry', v_entry_id,
    '创建' || p_fiscal_year || '年期初余额凭证', jsonb_build_object('debit', v_debit, 'credit', v_credit, 'lineCount', v_count)
  );
  return jsonb_build_object('id', v_entry_id, 'entryNo', '期初-' || p_fiscal_year, 'status', 'draft');
end;
$function$;

create or replace function public.generate_period_closing_entry(
  p_period_id uuid,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_period public.fiscal_periods%rowtype;
  v_profit_account_id uuid;
  v_entry_id uuid;
  v_entry_no text;
  v_debit numeric(18, 2);
  v_credit numeric(18, 2);
  v_line_count integer;
begin
  if v_actor_id is null or not public.has_access_permission('finance.closing.generate') then
    raise exception '缺少期末结转权限' using errcode = '42501';
  end if;
  select * into v_period from public.fiscal_periods period
  where period.id = p_period_id and period.organization_id = v_organization_id for update;
  if v_period.id is null or v_period.status <> 'open'
    or btrim(coalesce(p_confirmation, '')) <> v_period.name
  then
    raise exception '期间状态或确认名称无效' using errcode = '23514';
  end if;
  if v_period.closing_entry_id is not null or exists (
    select 1 from public.journal_entries entry
    where entry.source_type = 'period_close' and entry.source_id = v_period.id
  ) then
    raise exception '该期间已经生成损益结转凭证' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.journal_entries entry where entry.period_id = v_period.id
      and entry.status in ('draft', 'reviewed')
  ) then
    raise exception '期间仍有未过账凭证' using errcode = '23514';
  end if;
  select account.id into v_profit_account_id from public.accounting_accounts account
  where account.book_id = v_period.book_id and account.code = '4103'
    and account.status = 'active' and account.allow_posting = true;
  if v_profit_account_id is null then
    raise exception '本年利润科目未启用' using errcode = '23514';
  end if;

  with balances as (
    select line.account_id, sum(line.debit_amount - line.credit_amount) as signed_amount
    from public.journal_lines line
    join public.journal_entries entry on entry.id = line.entry_id
    join public.accounting_accounts account on account.id = line.account_id
    where entry.period_id = v_period.id and entry.status in ('posted', 'reversed')
      and entry.source_type <> 'period_close' and account.category = 'profit_loss'
    group by line.account_id
    having sum(line.debit_amount - line.credit_amount) <> 0
  )
  select count(*),
    coalesce(sum(case when signed_amount < 0 then -signed_amount else 0 end), 0),
    coalesce(sum(case when signed_amount > 0 then signed_amount else 0 end), 0)
  into v_line_count, v_debit, v_credit from balances;
  if v_line_count = 0 then
    raise exception '该期间没有需要结转的损益余额' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_period.book_id::text || v_period.ends_on::text, 0));
  select '记-' || to_char(v_period.ends_on, 'YYYYMM') || '-' || lpad((count(*) + 1)::text, 4, '0')
  into v_entry_no from public.journal_entries entry
  where entry.book_id = v_period.book_id
    and entry.entry_date >= date_trunc('month', v_period.ends_on)::date
    and entry.entry_date < (date_trunc('month', v_period.ends_on) + interval '1 month')::date;

  insert into public.journal_entries (
    organization_id, book_id, period_id, entry_no, entry_date, summary,
    source_type, source_id, status, total_debit, total_credit, created_by_employee_id
  ) values (
    v_organization_id, v_period.book_id, v_period.id, v_entry_no, v_period.ends_on,
    v_period.name || '损益结转', 'period_close', v_period.id, 'draft',
    greatest(v_debit, v_credit), greatest(v_debit, v_credit), v_actor_id
  ) returning id into v_entry_id;

  with balances as (
    select line.account_id, sum(line.debit_amount - line.credit_amount) as signed_amount
    from public.journal_lines line
    join public.journal_entries entry on entry.id = line.entry_id
    join public.accounting_accounts account on account.id = line.account_id
    where entry.period_id = v_period.id and entry.status in ('posted', 'reversed')
      and entry.source_type <> 'period_close' and account.category = 'profit_loss'
    group by line.account_id having sum(line.debit_amount - line.credit_amount) <> 0
  )
  insert into public.journal_lines (
    organization_id, entry_id, line_no, account_id, summary, debit_amount, credit_amount
  )
  select v_organization_id, v_entry_id, (row_number() over (order by account.code))::integer,
    balance.account_id, '结转损益',
    case when balance.signed_amount < 0 then -balance.signed_amount else 0 end,
    case when balance.signed_amount > 0 then balance.signed_amount else 0 end
  from balances balance join public.accounting_accounts account on account.id = balance.account_id;

  insert into public.journal_lines (
    organization_id, entry_id, line_no, account_id, summary, debit_amount, credit_amount
  ) values (
    v_organization_id, v_entry_id, v_line_count + 1, v_profit_account_id,
    '结转至本年利润', greatest(v_credit - v_debit, 0), greatest(v_debit - v_credit, 0)
  );

  update public.fiscal_periods set closing_entry_id = v_entry_id where id = v_period.id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'period_closing_entry_created', 'journal_entry', v_entry_id,
    '生成' || v_period.name || '损益结转凭证 ' || v_entry_no,
    jsonb_build_object('periodId', v_period.id, 'lineCount', v_line_count + 1)
  );
  return jsonb_build_object('id', v_entry_id, 'entryNo', v_entry_no, 'status', 'draft');
end;
$function$;

create or replace function public.prevent_opening_balance_reversal()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  if new.source_type = 'reversal' and exists (
    select 1 from public.journal_entries original
    where original.id = new.source_id and original.is_opening = true
  ) then
    raise exception '期初余额不能通过普通凭证冲销' using errcode = '23514';
  end if;
  return new;
end;
$function$;

create trigger journal_entries_prevent_opening_reversal
before insert on public.journal_entries
for each row execute function public.prevent_opening_balance_reversal();

create or replace function public.enforce_period_close_readiness()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
declare
  v_closing_status text;
begin
  if old.status = 'closed' and new.status = 'open' and old.closing_entry_id is not null then
    raise exception '含已过账损益结转的期间暂不支持直接反结账' using errcode = '23514';
  end if;
  if old.status = 'open' and new.status = 'closed' and exists (
    select 1 from public.journal_lines line
    join public.journal_entries entry on entry.id = line.entry_id
    join public.accounting_accounts account on account.id = line.account_id
    where entry.period_id = old.id and entry.status in ('posted', 'reversed')
      and entry.source_type <> 'period_close' and account.category = 'profit_loss'
    group by line.account_id having sum(line.debit_amount - line.credit_amount) <> 0
  ) then
    select entry.status into v_closing_status from public.journal_entries entry
    where entry.id = new.closing_entry_id and entry.period_id = old.id
      and entry.source_type = 'period_close';
    if coalesce(v_closing_status, '') <> 'posted' then
      raise exception '必须先生成、审核并过账损益结转凭证' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

create trigger fiscal_periods_require_posted_closing_entry
before update of status on public.fiscal_periods
for each row execute function public.enforce_period_close_readiness();

create or replace function public.account_trial_balance(
  p_book_id uuid, p_from_date date, p_to_date date
)
returns table (
  account_id uuid, account_code text, account_name text, normal_balance text,
  opening_debit numeric, opening_credit numeric, period_debit numeric, period_credit numeric,
  ending_debit numeric, ending_credit numeric
)
language sql stable security definer set search_path = public, pg_temp
as $function$
  with authorized as (
    select book.id from public.accounting_books book
    where book.id = p_book_id and book.organization_id = public.current_organization_id()
      and public.has_access_permission('finance.ledger.view') and p_from_date <= p_to_date
  ), movements as (
    select line.account_id,
      coalesce(sum(line.debit_amount) filter (where entry.entry_date < p_from_date or (entry.is_opening and entry.entry_date <= p_from_date)), 0) as opening_dr,
      coalesce(sum(line.credit_amount) filter (where entry.entry_date < p_from_date or (entry.is_opening and entry.entry_date <= p_from_date)), 0) as opening_cr,
      coalesce(sum(line.debit_amount) filter (where not entry.is_opening and entry.entry_date between p_from_date and p_to_date), 0) as period_dr,
      coalesce(sum(line.credit_amount) filter (where not entry.is_opening and entry.entry_date between p_from_date and p_to_date), 0) as period_cr
    from public.journal_lines line join public.journal_entries entry on entry.id = line.entry_id
    where entry.book_id = p_book_id and entry.status in ('posted', 'reversed')
      and entry.entry_date <= p_to_date and exists (select 1 from authorized)
    group by line.account_id
  )
  select account.id, account.code, account.name, account.normal_balance,
    greatest(coalesce(movement.opening_dr, 0) - coalesce(movement.opening_cr, 0), 0),
    greatest(coalesce(movement.opening_cr, 0) - coalesce(movement.opening_dr, 0), 0),
    coalesce(movement.period_dr, 0), coalesce(movement.period_cr, 0),
    greatest(coalesce(movement.opening_dr, 0) - coalesce(movement.opening_cr, 0) + coalesce(movement.period_dr, 0) - coalesce(movement.period_cr, 0), 0),
    greatest(coalesce(movement.opening_cr, 0) - coalesce(movement.opening_dr, 0) + coalesce(movement.period_cr, 0) - coalesce(movement.period_dr, 0), 0)
  from public.accounting_accounts account left join movements movement on movement.account_id = account.id
  where account.book_id = p_book_id and exists (select 1 from authorized) order by account.code
$function$;

create or replace function public.account_detail_ledger(
  p_book_id uuid, p_account_id uuid, p_from_date date, p_to_date date
)
returns table (
  entry_id uuid, entry_no text, entry_date date, summary text,
  debit_amount numeric, credit_amount numeric, balance_direction text, running_balance numeric
)
language sql stable security definer set search_path = public, pg_temp
as $function$
  with authorized as (
    select account.id from public.accounting_accounts account
    where account.id = p_account_id and account.book_id = p_book_id
      and account.organization_id = public.current_organization_id()
      and public.has_access_permission('finance.ledger.view') and p_from_date <= p_to_date
  ), opening as (
    select coalesce(sum(line.debit_amount - line.credit_amount), 0) as amount
    from public.journal_lines line join public.journal_entries entry on entry.id = line.entry_id
    where line.account_id = p_account_id and entry.book_id = p_book_id
      and entry.status in ('posted', 'reversed')
      and (entry.entry_date < p_from_date or (entry.is_opening and entry.entry_date <= p_from_date))
      and exists (select 1 from authorized)
  ), rows as (
    select entry.id, entry.entry_no, entry.entry_date, line.line_no, line.summary,
      line.debit_amount, line.credit_amount,
      (select amount from opening) + sum(line.debit_amount - line.credit_amount)
        over (order by entry.entry_date, entry.entry_no, line.line_no) as signed_balance
    from public.journal_lines line join public.journal_entries entry on entry.id = line.entry_id
    where line.account_id = p_account_id and entry.book_id = p_book_id
      and entry.status in ('posted', 'reversed') and not entry.is_opening
      and entry.entry_date between p_from_date and p_to_date and exists (select 1 from authorized)
  )
  select rows.id, rows.entry_no, rows.entry_date, rows.summary,
    rows.debit_amount, rows.credit_amount,
    case when rows.signed_balance >= 0 then 'debit' else 'credit' end, abs(rows.signed_balance)
  from rows order by rows.entry_date, rows.entry_no, rows.line_no
$function$;

create or replace function public.balance_sheet_report(p_book_id uuid, p_as_of_date date)
returns table (account_code text, account_name text, section text, amount numeric, sort_order integer)
language sql stable security definer set search_path = public, pg_temp
as $function$
  with authorized as (
    select 1 from public.accounting_books book where book.id = p_book_id
      and book.organization_id = public.current_organization_id()
      and public.has_access_permission('finance.statement.view')
  ), balances as (
    select line.account_id, sum(line.debit_amount - line.credit_amount) as signed_amount
    from public.journal_lines line join public.journal_entries entry on entry.id = line.entry_id
    where entry.book_id = p_book_id and entry.status in ('posted', 'reversed')
      and entry.entry_date <= p_as_of_date and exists (select 1 from authorized)
    group by line.account_id
  )
  select account.code, account.name,
    case when account.category = 'asset' then 'asset'
      when account.category = 'liability' then 'liability' else 'equity' end,
    case when account.category = 'asset' then coalesce(balance.signed_amount, 0)
      else -coalesce(balance.signed_amount, 0) end,
    case account.category when 'asset' then 1000 when 'liability' then 2000 else 3000 end + account.code::integer
  from public.accounting_accounts account left join balances balance on balance.account_id = account.id
  where account.book_id = p_book_id and account.category in ('asset', 'liability', 'equity')
    and exists (select 1 from authorized)
  order by 5
$function$;

create or replace function public.income_statement_report(p_book_id uuid, p_from_date date, p_to_date date)
returns table (account_code text, account_name text, line_type text, amount numeric, profit_impact numeric, sort_order integer)
language sql stable security definer set search_path = public, pg_temp
as $function$
  with authorized as (
    select 1 from public.accounting_books book where book.id = p_book_id
      and book.organization_id = public.current_organization_id()
      and public.has_access_permission('finance.statement.view') and p_from_date <= p_to_date
  ), movements as (
    select line.account_id, sum(line.debit_amount - line.credit_amount) as signed_amount
    from public.journal_lines line join public.journal_entries entry on entry.id = line.entry_id
    where entry.book_id = p_book_id and entry.status in ('posted', 'reversed')
      and not entry.is_opening and entry.source_type <> 'period_close'
      and entry.entry_date between p_from_date and p_to_date and exists (select 1 from authorized)
    group by line.account_id
  )
  select account.code, account.name,
    case when account.normal_balance = 'credit' then 'revenue' else 'expense' end,
    abs(coalesce(movement.signed_amount, 0)),
    -coalesce(movement.signed_amount, 0),
    account.code::integer
  from public.accounting_accounts account left join movements movement on movement.account_id = account.id
  where account.book_id = p_book_id and account.category = 'profit_loss'
    and exists (select 1 from authorized) order by account.code
$function$;

create or replace function public.cash_flow_statement_report(p_book_id uuid, p_from_date date, p_to_date date)
returns table (item_code text, item_name text, activity_type text, amount numeric, entry_count bigint, sort_order integer)
language sql stable security definer set search_path = public, pg_temp
as $function$
  with authorized as (
    select book.organization_id from public.accounting_books book where book.id = p_book_id
      and book.organization_id = public.current_organization_id()
      and public.has_access_permission('finance.statement.view') and p_from_date <= p_to_date
  ), entry_cash as (
    select entry.id, sum(line.debit_amount - line.credit_amount) as cash_amount
    from public.journal_entries entry join public.journal_lines line on line.entry_id = entry.id
    join public.accounting_accounts account on account.id = line.account_id
    where entry.book_id = p_book_id and entry.status in ('posted', 'reversed')
      and not entry.is_opening and entry.entry_date between p_from_date and p_to_date
      and account.code in ('1001', '1002') and exists (select 1 from authorized)
    group by entry.id having sum(line.debit_amount - line.credit_amount) <> 0
  ), classifications as (
    select entry_cash.id, entry_cash.cash_amount,
      case when count(distinct rule.cash_flow_item_id) filter (where item.activity_type <> 'unclassified') = 1
        and count(*) filter (where rule.cash_flow_item_id is null or item.activity_type = 'unclassified') = 0
      then min(rule.cash_flow_item_id) else null end as item_id
    from entry_cash
    left join public.journal_lines line on line.entry_id = entry_cash.id
      and exists (
        select 1 from public.accounting_accounts noncash
        where noncash.id = line.account_id and noncash.code not in ('1001', '1002')
      )
    left join public.account_cash_flow_rules rule on rule.account_id = line.account_id
    left join public.cash_flow_items item on item.id = rule.cash_flow_item_id
    group by entry_cash.id, entry_cash.cash_amount
  ), resolved as (
    select classification.cash_amount,
      coalesce(classification.item_id, unclassified.id) as item_id
    from classifications classification
    cross join lateral (
      select item.id from public.cash_flow_items item
      where item.organization_id = public.current_organization_id() and item.code = 'unclassified'
    ) unclassified
  ), totals as (
    select resolved.item_id, sum(resolved.cash_amount) as amount, count(*) as entry_count
    from resolved group by resolved.item_id
  )
  select item.code, item.name, item.activity_type,
    coalesce(total.amount, 0), coalesce(total.entry_count, 0), item.sort_order
  from public.cash_flow_items item left join totals total on total.item_id = item.id
  where item.organization_id = public.current_organization_id()
    and exists (select 1 from authorized) order by item.sort_order
$function$;

create or replace function public.configure_account_cash_flow_rule(
  p_account_id uuid,
  p_cash_flow_item_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
begin
  if v_actor_id is null or not public.has_access_permission('finance.cashflow.classify') then
    raise exception '缺少现金流分类配置权限' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.accounting_accounts account
    where account.id = p_account_id and account.organization_id = v_organization_id
      and account.code not in ('1001', '1002')
  ) or not exists (
    select 1 from public.cash_flow_items item
    where item.id = p_cash_flow_item_id and item.organization_id = v_organization_id
  ) then
    raise exception '科目或现金流项目无效' using errcode = '22023';
  end if;
  insert into public.account_cash_flow_rules (organization_id, account_id, cash_flow_item_id)
  values (v_organization_id, p_account_id, p_cash_flow_item_id)
  on conflict (account_id) do update set cash_flow_item_id = excluded.cash_flow_item_id;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'cash_flow_rule_configured', 'accounting_account', p_account_id,
    '更新会计科目现金流分类', jsonb_build_object('cashFlowItemId', p_cash_flow_item_id)
  );
  return p_account_id;
end;
$function$;

revoke all on function public.create_opening_balance_entry(uuid, integer, jsonb) from public, anon;
revoke all on function public.generate_period_closing_entry(uuid, text) from public, anon;
revoke all on function public.balance_sheet_report(uuid, date) from public, anon;
revoke all on function public.income_statement_report(uuid, date, date) from public, anon;
revoke all on function public.cash_flow_statement_report(uuid, date, date) from public, anon;
revoke all on function public.configure_account_cash_flow_rule(uuid, uuid) from public, anon;
grant execute on function public.create_opening_balance_entry(uuid, integer, jsonb) to authenticated;
grant execute on function public.generate_period_closing_entry(uuid, text) to authenticated;
grant execute on function public.balance_sheet_report(uuid, date) to authenticated;
grant execute on function public.income_statement_report(uuid, date, date) to authenticated;
grant execute on function public.cash_flow_statement_report(uuid, date, date) to authenticated;
grant execute on function public.configure_account_cash_flow_rule(uuid, uuid) to authenticated;

commit;
