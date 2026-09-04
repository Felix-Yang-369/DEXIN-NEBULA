-- Accounting operations V2: account/period governance, controlled reversal,
-- trial balance and account-ledger read models.

begin;

insert into public.access_permissions
  (code, module, resource, action, name, description, risk_level, sort_order)
values
  ('finance.account.manage', 'finance', 'account', 'manage', '管理会计科目', '新增、维护和停用会计科目', 'high', 200),
  ('finance.period.manage', 'finance', 'period', 'manage', '管理会计期间', '开放未来会计期间', 'high', 210),
  ('finance.voucher.reverse', 'finance', 'voucher', 'reverse', '凭证冲销', '在开放期间生成反向凭证并锁定原凭证', 'high', 220),
  ('finance.ledger.view', 'finance', 'ledger', 'view', '查看会计账簿', '查看试算平衡、总账和明细账', 'sensitive', 230)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  risk_level = excluded.risk_level,
  sort_order = excluded.sort_order;

insert into public.access_role_permissions
  (role_id, permission_id, effect, data_scope, field_access)
select access_role.id, permission.id, 'allow', 'organization', 'full'
from public.access_roles access_role
join public.access_permissions permission on permission.code in (
  'finance.account.manage', 'finance.period.manage',
  'finance.voucher.reverse', 'finance.ledger.view'
)
where access_role.source_role_code = 'finance'
on conflict (role_id, permission_id) do nothing;

drop policy if exists accounting_books_finance_read on public.accounting_books;
create policy accounting_books_finance_read on public.accounting_books for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.account.manage')
  or public.has_access_permission('finance.period.manage')
  or public.has_access_permission('finance.period.close')
  or public.has_access_permission('finance.ledger.view')
  or public.has_access_permission('finance.report.export')
));

drop policy if exists fiscal_periods_finance_read on public.fiscal_periods;
create policy fiscal_periods_finance_read on public.fiscal_periods for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.period.manage')
  or public.has_access_permission('finance.period.close')
  or public.has_access_permission('finance.ledger.view')
));

drop policy if exists accounting_accounts_finance_read on public.accounting_accounts;
create policy accounting_accounts_finance_read on public.accounting_accounts for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.account.manage')
  or public.has_access_permission('finance.ledger.view')
));

drop policy if exists journal_entries_finance_read on public.journal_entries;
create policy journal_entries_finance_read on public.journal_entries for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.ledger.view')
));

drop policy if exists journal_lines_finance_read on public.journal_lines;
create policy journal_lines_finance_read on public.journal_lines for select to authenticated
using (organization_id = public.current_organization_id() and (
  public.has_access_permission('finance.voucher.create')
  or public.has_access_permission('finance.voucher.review')
  or public.has_access_permission('finance.voucher.post')
  or public.has_access_permission('finance.voucher.reverse')
  or public.has_access_permission('finance.ledger.view')
));

alter table public.journal_entries
  add column reversal_entry_id uuid references public.journal_entries(id) on delete restrict;

create unique index journal_entries_reversal_unique_idx
  on public.journal_entries (reversal_entry_id)
  where reversal_entry_id is not null;

create or replace function public.manage_accounting_account(
  p_book_id uuid,
  p_account_id uuid,
  p_code text,
  p_name text,
  p_category text,
  p_normal_balance text,
  p_allow_posting boolean,
  p_requires_counterparty boolean,
  p_requires_department boolean,
  p_requires_project boolean,
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
  v_account_id uuid;
  v_before jsonb;
begin
  if v_actor_id is null or not public.has_access_permission('finance.account.manage') then
    raise exception '缺少会计科目管理权限' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.accounting_books book
    where book.id = p_book_id and book.organization_id = v_organization_id and book.status = 'active'
  ) or p_code !~ '^[0-9]{4,12}$'
    or char_length(btrim(coalesce(p_name, ''))) not between 2 and 80
    or p_category not in ('asset', 'liability', 'equity', 'cost', 'profit_loss')
    or p_normal_balance not in ('debit', 'credit')
    or p_status not in ('active', 'inactive')
  then
    raise exception '会计科目参数无效' using errcode = '22023';
  end if;

  if p_account_id is null then
    insert into public.accounting_accounts (
      organization_id, book_id, code, name, category, normal_balance,
      allow_posting, requires_counterparty, requires_department, requires_project,
      status
    ) values (
      v_organization_id, p_book_id, p_code, btrim(p_name), p_category,
      p_normal_balance, p_allow_posting, p_requires_counterparty,
      p_requires_department, p_requires_project, p_status
    ) returning id into v_account_id;
  else
    select to_jsonb(account) into v_before
    from public.accounting_accounts account
    where account.id = p_account_id and account.organization_id = v_organization_id
      and account.book_id = p_book_id
    for update;
    if v_before is null then
      raise exception '会计科目不存在' using errcode = '22023';
    end if;
    if exists (select 1 from public.journal_lines line where line.account_id = p_account_id)
      and (p_code is distinct from v_before->>'code'
        or p_category is distinct from v_before->>'category'
        or p_normal_balance is distinct from v_before->>'normal_balance')
    then
      raise exception '已使用科目不能修改编码、类别或余额方向' using errcode = '23514';
    end if;

    update public.accounting_accounts set
      code = p_code, name = btrim(p_name), category = p_category,
      normal_balance = p_normal_balance, allow_posting = p_allow_posting,
      requires_counterparty = p_requires_counterparty,
      requires_department = p_requires_department,
      requires_project = p_requires_project, status = p_status
    where id = p_account_id
    returning id into v_account_id;
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id,
    case when p_account_id is null then 'accounting_account_created' else 'accounting_account_updated' end,
    'accounting_account', v_account_id,
    case when p_account_id is null then '创建会计科目 ' else '更新会计科目 ' end || p_code || ' ' || btrim(p_name),
    jsonb_build_object('before', v_before, 'code', p_code, 'status', p_status)
  );
  return v_account_id;
end;
$function$;

create or replace function public.transition_fiscal_period(
  p_period_id uuid,
  p_action text,
  p_confirmation text
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_period public.fiscal_periods%rowtype;
begin
  if v_actor_id is null then
    raise exception '登录账号不可用' using errcode = '42501';
  end if;
  select * into v_period from public.fiscal_periods
  where id = p_period_id and organization_id = v_organization_id for update;
  if v_period.id is null or btrim(coalesce(p_confirmation, '')) <> v_period.name then
    raise exception '会计期间不存在或确认名称不匹配' using errcode = '23514';
  end if;

  if p_action = 'open' then
    if not public.has_access_permission('finance.period.manage') or v_period.status <> 'future' then
      raise exception '缺少期间管理权限或期间状态不允许开放' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.fiscal_periods earlier
      where earlier.book_id = v_period.book_id and earlier.starts_on < v_period.starts_on
        and earlier.status = 'future'
    ) then
      raise exception '必须按顺序开放会计期间' using errcode = '23514';
    end if;
    update public.fiscal_periods set status = 'open' where id = p_period_id;
  elsif p_action = 'close' then
    if not public.has_access_permission('finance.period.close') or v_period.status <> 'open' then
      raise exception '缺少期间结账权限或期间状态不允许结账' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.fiscal_periods earlier
      where earlier.book_id = v_period.book_id and earlier.starts_on < v_period.starts_on
        and earlier.status <> 'closed'
    ) then
      raise exception '必须先关闭更早的会计期间' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.journal_entries entry
      where entry.period_id = p_period_id and entry.status in ('draft', 'reviewed')
    ) then
      raise exception '期间仍有未过账凭证' using errcode = '23514';
    end if;
    update public.fiscal_periods set status = 'closed', closed_at = now(),
      closed_by_employee_id = v_actor_id where id = p_period_id;
  elsif p_action = 'reopen' then
    if not public.has_org_role('chairman') or v_period.status <> 'closed' then
      raise exception '只有董事长可以重新开放已结账期间' using errcode = '42501';
    end if;
    if exists (
      select 1 from public.fiscal_periods later
      where later.book_id = v_period.book_id and later.starts_on > v_period.starts_on
        and later.status = 'closed'
    ) then
      raise exception '必须先重新开放更晚的已结账期间' using errcode = '23514';
    end if;
    update public.fiscal_periods set status = 'open', closed_at = null,
      closed_by_employee_id = null where id = p_period_id;
  else
    raise exception '不支持的期间操作' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'fiscal_period_' || p_action,
    'fiscal_period', p_period_id,
    case p_action when 'open' then '开放会计期间 ' when 'close' then '关闭会计期间 ' else '重新开放会计期间 ' end || v_period.name,
    jsonb_build_object('beforeStatus', v_period.status, 'action', p_action)
  );
  return p_action;
end;
$function$;

create or replace function public.create_fiscal_year(
  p_book_id uuid,
  p_fiscal_year integer
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
begin
  if v_actor_id is null or not public.has_access_permission('finance.period.manage') then
    raise exception '缺少期间管理权限' using errcode = '42501';
  end if;
  if p_fiscal_year not between extract(year from current_date)::integer - 1
      and extract(year from current_date)::integer + 5
    or not exists (
      select 1 from public.accounting_books book where book.id = p_book_id
        and book.organization_id = v_organization_id and book.status = 'active'
    )
    or exists (
      select 1 from public.fiscal_periods period
      where period.book_id = p_book_id and period.fiscal_year = p_fiscal_year
    )
  then
    raise exception '会计年度无效或已经存在' using errcode = '23514';
  end if;

  insert into public.fiscal_periods (
    organization_id, book_id, fiscal_year, period_no, name,
    starts_on, ends_on, status
  )
  select v_organization_id, p_book_id, p_fiscal_year, month_no,
    p_fiscal_year || '年' || month_no || '月',
    make_date(p_fiscal_year, month_no, 1),
    (make_date(p_fiscal_year, month_no, 1) + interval '1 month - 1 day')::date,
    'future'
  from generate_series(1, 12) month_no;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'fiscal_year_created', 'fiscal_year',
    '创建会计年度 ' || p_fiscal_year,
    jsonb_build_object('bookId', p_book_id, 'fiscalYear', p_fiscal_year)
  );
  return p_fiscal_year;
end;
$function$;

create or replace function public.reverse_journal_entry(
  p_entry_id uuid,
  p_reversal_date date,
  p_reason text,
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
  v_original public.journal_entries%rowtype;
  v_period_id uuid;
  v_reversal_id uuid;
  v_entry_no text;
begin
  if v_actor_id is null or not public.has_access_permission('finance.voucher.reverse') then
    raise exception '缺少凭证冲销权限' using errcode = '42501';
  end if;
  select * into v_original from public.journal_entries
  where id = p_entry_id and organization_id = v_organization_id for update;
  if v_original.id is null or v_original.status <> 'posted'
    or v_original.reversal_entry_id is not null
    or btrim(coalesce(p_confirmation, '')) <> v_original.entry_no
    or char_length(btrim(coalesce(p_reason, ''))) not between 5 and 200
  then
    raise exception '原凭证状态、冲销原因或确认凭证号无效' using errcode = '23514';
  end if;
  if p_reversal_date < v_original.entry_date then
    raise exception '冲销日期不能早于原凭证日期' using errcode = '23514';
  end if;
  select period.id into v_period_id from public.fiscal_periods period
  where period.book_id = v_original.book_id
    and p_reversal_date between period.starts_on and period.ends_on
    and period.status = 'open';
  if v_period_id is null then
    raise exception '冲销日期不在开放会计期间' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_original.book_id::text || p_reversal_date::text, 0));
  select '记-' || to_char(p_reversal_date, 'YYYYMM') || '-' || lpad((count(*) + 1)::text, 4, '0')
  into v_entry_no from public.journal_entries entry
  where entry.book_id = v_original.book_id
    and entry.entry_date >= date_trunc('month', p_reversal_date)::date
    and entry.entry_date < (date_trunc('month', p_reversal_date) + interval '1 month')::date;

  insert into public.journal_entries (
    organization_id, book_id, period_id, entry_no, entry_date, summary,
    source_type, source_id, status, attachment_count, total_debit, total_credit,
    created_by_employee_id, reviewed_by_employee_id, posted_by_employee_id,
    reversed_entry_id, reviewed_at, posted_at
  ) values (
    v_organization_id, v_original.book_id, v_period_id, v_entry_no, p_reversal_date,
    '冲销 ' || v_original.entry_no || '：' || btrim(p_reason),
    'reversal', v_original.id, 'posted', 0,
    v_original.total_credit, v_original.total_debit,
    v_actor_id, v_actor_id, v_actor_id, v_original.id, now(), now()
  ) returning id into v_reversal_id;

  insert into public.journal_lines (
    organization_id, entry_id, line_no, account_id, summary,
    debit_amount, credit_amount, currency, original_amount, exchange_rate,
    counterparty_type, counterparty_id, department_id, project_code
  )
  select line.organization_id, v_reversal_id, line.line_no, line.account_id,
    '冲销：' || line.summary, line.credit_amount, line.debit_amount,
    line.currency, -line.original_amount, line.exchange_rate,
    line.counterparty_type, line.counterparty_id, line.department_id, line.project_code
  from public.journal_lines line where line.entry_id = v_original.id;

  update public.journal_entries set status = 'reversed', reversal_entry_id = v_reversal_id,
    version = version + 1 where id = v_original.id;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_organization_id, v_actor_id, 'journal_entry_reversed', 'journal_entry', v_original.id,
    '冲销会计凭证 ' || v_original.entry_no,
    jsonb_build_object('reversalEntryId', v_reversal_id, 'reversalEntryNo', v_entry_no, 'reason', btrim(p_reason))
  );
  return jsonb_build_object('id', v_reversal_id, 'entryNo', v_entry_no, 'originalEntryNo', v_original.entry_no);
end;
$function$;

create or replace function public.prevent_posted_journal_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  if old.status in ('posted', 'reversed') then
    if tg_op = 'UPDATE'
      and old.status = 'posted' and new.status = 'reversed'
      and old.reversal_entry_id is null and new.reversal_entry_id is not null
      and new.organization_id = old.organization_id and new.book_id = old.book_id
      and new.period_id = old.period_id and new.entry_no = old.entry_no
      and new.entry_date = old.entry_date and new.summary = old.summary
      and new.total_debit = old.total_debit and new.total_credit = old.total_credit
      and new.created_by_employee_id = old.created_by_employee_id
    then
      return new;
    end if;
    raise exception '已过账凭证不可直接修改或删除' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create or replace function public.account_trial_balance(
  p_book_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  account_id uuid, account_code text, account_name text, normal_balance text,
  opening_debit numeric, opening_credit numeric, period_debit numeric, period_credit numeric,
  ending_debit numeric, ending_credit numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with authorized as (
    select book.id from public.accounting_books book
    where book.id = p_book_id and book.organization_id = public.current_organization_id()
      and public.has_access_permission('finance.ledger.view')
      and p_from_date <= p_to_date
  ), movements as (
    select line.account_id,
      coalesce(sum(line.debit_amount) filter (where entry.entry_date < p_from_date), 0) as opening_dr,
      coalesce(sum(line.credit_amount) filter (where entry.entry_date < p_from_date), 0) as opening_cr,
      coalesce(sum(line.debit_amount) filter (where entry.entry_date between p_from_date and p_to_date), 0) as period_dr,
      coalesce(sum(line.credit_amount) filter (where entry.entry_date between p_from_date and p_to_date), 0) as period_cr
    from public.journal_lines line
    join public.journal_entries entry on entry.id = line.entry_id
    where entry.book_id = p_book_id and entry.status in ('posted', 'reversed')
      and entry.entry_date <= p_to_date and exists (select 1 from authorized)
    group by line.account_id
  )
  select account.id, account.code, account.name, account.normal_balance,
    greatest(coalesce(movement.opening_dr, 0) - coalesce(movement.opening_cr, 0), 0),
    greatest(coalesce(movement.opening_cr, 0) - coalesce(movement.opening_dr, 0), 0),
    coalesce(movement.period_dr, 0), coalesce(movement.period_cr, 0),
    greatest(coalesce(movement.opening_dr, 0) - coalesce(movement.opening_cr, 0)
      + coalesce(movement.period_dr, 0) - coalesce(movement.period_cr, 0), 0),
    greatest(coalesce(movement.opening_cr, 0) - coalesce(movement.opening_dr, 0)
      + coalesce(movement.period_cr, 0) - coalesce(movement.period_dr, 0), 0)
  from public.accounting_accounts account
  left join movements movement on movement.account_id = account.id
  where account.book_id = p_book_id and exists (select 1 from authorized)
  order by account.code
$function$;

create or replace function public.account_detail_ledger(
  p_book_id uuid,
  p_account_id uuid,
  p_from_date date,
  p_to_date date
)
returns table (
  entry_id uuid, entry_no text, entry_date date, summary text,
  debit_amount numeric, credit_amount numeric, balance_direction text, running_balance numeric
)
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  with authorized as (
    select account.id, account.normal_balance
    from public.accounting_accounts account
    where account.id = p_account_id and account.book_id = p_book_id
      and account.organization_id = public.current_organization_id()
      and public.has_access_permission('finance.ledger.view')
      and p_from_date <= p_to_date
  ), opening as (
    select coalesce(sum(line.debit_amount - line.credit_amount), 0) as amount
    from public.journal_lines line join public.journal_entries entry on entry.id = line.entry_id
    where line.account_id = p_account_id and entry.book_id = p_book_id
      and entry.status in ('posted', 'reversed') and entry.entry_date < p_from_date
      and exists (select 1 from authorized)
  ), rows as (
    select entry.id, entry.entry_no, entry.entry_date, line.line_no,
      line.summary, line.debit_amount, line.credit_amount,
      (select amount from opening) + sum(line.debit_amount - line.credit_amount)
        over (order by entry.entry_date, entry.entry_no, line.line_no) as signed_balance
    from public.journal_lines line join public.journal_entries entry on entry.id = line.entry_id
    where line.account_id = p_account_id and entry.book_id = p_book_id
      and entry.status in ('posted', 'reversed') and entry.entry_date between p_from_date and p_to_date
      and exists (select 1 from authorized)
  )
  select rows.id, rows.entry_no, rows.entry_date, rows.summary,
    rows.debit_amount, rows.credit_amount,
    case when rows.signed_balance >= 0 then 'debit' else 'credit' end,
    abs(rows.signed_balance)
  from rows order by rows.entry_date, rows.entry_no, rows.line_no
$function$;

revoke all on function public.manage_accounting_account(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, text) from public, anon;
revoke all on function public.transition_fiscal_period(uuid, text, text) from public, anon;
revoke all on function public.create_fiscal_year(uuid, integer) from public, anon;
revoke all on function public.reverse_journal_entry(uuid, date, text, text) from public, anon;
revoke all on function public.account_trial_balance(uuid, date, date) from public, anon;
revoke all on function public.account_detail_ledger(uuid, uuid, date, date) from public, anon;
grant execute on function public.manage_accounting_account(uuid, uuid, text, text, text, text, boolean, boolean, boolean, boolean, text) to authenticated;
grant execute on function public.transition_fiscal_period(uuid, text, text) to authenticated;
grant execute on function public.create_fiscal_year(uuid, integer) to authenticated;
grant execute on function public.reverse_journal_entry(uuid, date, text, text) to authenticated;
grant execute on function public.account_trial_balance(uuid, date, date) to authenticated;
grant execute on function public.account_detail_ledger(uuid, uuid, date, date) to authenticated;

commit;
