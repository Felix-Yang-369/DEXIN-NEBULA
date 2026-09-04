-- Unified workspace shell preferences and controlled accounting close/reopen flow.
begin;

alter table public.workspace_preferences
  add column sidebar_mode text not null default 'expanded'
    check (sidebar_mode in ('expanded', 'compact'));

create or replace function public.save_sidebar_mode(p_sidebar_mode text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_employee uuid := public.current_employee_id();
begin
  if v_org is null or v_employee is null then
    raise exception '登录状态已失效' using errcode = '42501';
  end if;
  if p_sidebar_mode not in ('expanded', 'compact') then
    raise exception '侧边栏偏好无效' using errcode = '22023';
  end if;
  insert into public.workspace_preferences
    (organization_id, employee_id, sidebar_mode, updated_at)
  values (v_org, v_employee, p_sidebar_mode, now())
  on conflict (organization_id, employee_id) do update set
    sidebar_mode = excluded.sidebar_mode,
    updated_at = now();
end;
$function$;

revoke all on function public.save_sidebar_mode(text) from public, anon;
grant execute on function public.save_sidebar_mode(text) to authenticated;

create or replace function public.current_shell_context()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select case when public.current_employee_id() is null then '{}'::jsonb else jsonb_build_object(
    'sidebarMode', coalesce(preference.sidebar_mode, 'expanded'),
    'density', coalesce(preference.density, 'comfortable'),
    'unreadCount', (select count(*) from public.notifications notification where notification.organization_id = public.current_organization_id() and notification.recipient_employee_id = public.current_employee_id() and notification.read_at is null),
    'pendingCount',
      (select count(*) from public.leave_requests request where request.organization_id = public.current_organization_id() and request.current_approver_employee_id = public.current_employee_id() and request.status in ('pending_department', 'pending_chairman', 'pending_hr_filing'))
      + (select count(*) from public.approval_requests request where request.organization_id = public.current_organization_id() and request.current_approver_employee_id = public.current_employee_id() and request.status = 'pending')
  ) end
  from (select 1) seed
  left join public.workspace_preferences preference
    on preference.organization_id = public.current_organization_id()
   and preference.employee_id = public.current_employee_id()
$function$;
revoke all on function public.current_shell_context() from public, anon;
grant execute on function public.current_shell_context() to authenticated;

insert into public.access_permissions
  (code, module, resource, action, name, description, risk_level, sort_order)
values
  ('finance.closing.reopen', 'finance', 'closing', 'reopen', '申请反结账', '生成反结转草稿并启动反结账流程', 'high', 255),
  ('finance.closing.acknowledge', 'finance', 'closing', 'acknowledge', '确认关账警告', '确认月末关账非阻断性风险', 'high', 256)
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
  'finance.closing.reopen', 'finance.closing.acknowledge'
)
where access_role.source_role_code = 'finance'
on conflict (role_id, permission_id) do nothing;

alter table public.fiscal_periods drop constraint if exists fiscal_periods_status_check;
alter table public.fiscal_periods add constraint fiscal_periods_status_check
  check (status in ('future', 'open', 'closing', 'closed', 'reopening'));
alter table public.fiscal_periods
  add column reopening_entry_id uuid references public.journal_entries(id) on delete restrict,
  add column close_version integer not null default 0 check (close_version >= 0);

create table public.accounting_close_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_id uuid not null references public.fiscal_periods(id) on delete cascade,
  warning_codes text[] not null default array[]::text[],
  note text not null check (char_length(btrim(note)) between 5 and 500),
  acknowledged_by_employee_id uuid not null references public.employees(id) on delete restrict,
  acknowledged_at timestamptz not null default now()
);

create index accounting_close_ack_period_idx
  on public.accounting_close_acknowledgements (period_id, acknowledged_at desc);

alter table public.accounting_close_acknowledgements enable row level security;
create policy accounting_close_ack_finance_read
on public.accounting_close_acknowledgements for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_access_permission('finance.period.close')
    or public.has_access_permission('finance.closing.generate')
    or public.has_access_permission('finance.closing.acknowledge')
  )
);
revoke all on table public.accounting_close_acknowledgements from public, anon, authenticated;
grant select on table public.accounting_close_acknowledgements to authenticated;

create or replace function public.accounting_close_checklist(p_period_id uuid)
returns table (
  check_code text,
  severity text,
  issue_count bigint,
  title text,
  detail text,
  action_href text
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_period public.fiscal_periods%rowtype;
begin
  if v_org is null or not (
    public.has_access_permission('finance.period.close')
    or public.has_access_permission('finance.closing.generate')
    or public.has_access_permission('finance.statement.view')
  ) then
    raise exception '缺少关账检查权限' using errcode = '42501';
  end if;
  select * into v_period from public.fiscal_periods
  where id = p_period_id and organization_id = v_org;
  if v_period.id is null then
    raise exception '会计期间不存在' using errcode = 'P0002';
  end if;

  return query
  select 'unbalanced_entries', 'blocker', count(*), '借贷不平凭证', '借方与贷方合计不一致', '/finance/accounting'
  from public.journal_entries entry
  where entry.period_id = v_period.id and entry.status not in ('void')
    and entry.total_debit <> entry.total_credit
  union all
  select 'unposted_entries', 'blocker', count(*), '未过账凭证', '草稿或已审核凭证尚未过账', '/finance/accounting'
  from public.journal_entries entry
  where entry.period_id = v_period.id and entry.status in ('draft', 'reviewed')
    and entry.id is distinct from v_period.closing_entry_id
    and entry.id is distinct from v_period.reopening_entry_id
  union all
  select 'period_order', 'blocker', count(*), '期间顺序异常', '仍有更早的会计期间未结账', '/finance/accounting/settings#periods'
  from public.fiscal_periods earlier
  where earlier.book_id = v_period.book_id and earlier.starts_on < v_period.starts_on
    and earlier.status <> 'closed'
  union all
  select 'closing_entry', 'blocker',
    case when closing.id is null or closing.status <> 'posted' then 1 else 0 end,
    '损益结转', '损益结转凭证必须完成审核和过账', '/finance/accounting/closing'
  from (select 1) seed
  left join public.journal_entries closing on closing.id = v_period.closing_entry_id
  union all
  select 'bank_unreconciled', 'warning', count(*), '银行流水未对账', '期间内仍有未匹配或部分匹配的银行流水', '/finance/bank-reconciliation'
  from public.bank_statement_lines line
  where line.organization_id = v_org
    and line.transaction_date between v_period.starts_on and v_period.ends_on
    and line.status in ('unmatched', 'partial')
  union all
  select 'open_counterparties', 'warning', count(*), '往来余额待核对', '到期日在本期及以前的应收应付尚未结清', '/finance'
  from public.finance_documents document
  where document.organization_id = v_org and document.due_date <= v_period.ends_on
    and document.status in ('open', 'partial')
  union all
  select 'cashflow_unclassified', 'warning', count(distinct entry.id), '现金流分类待完善', '涉及货币资金的凭证存在未分类对方科目', '/finance/accounting/statements#cashflow-rules'
  from public.journal_entries entry
  join public.journal_lines cash_line on cash_line.entry_id = entry.id
  join public.accounting_accounts cash_account on cash_account.id = cash_line.account_id and cash_account.code in ('1001', '1002')
  join public.journal_lines other_line on other_line.entry_id = entry.id and other_line.account_id <> cash_line.account_id
  left join public.account_cash_flow_rules rule on rule.account_id = other_line.account_id
  where entry.period_id = v_period.id and entry.status in ('posted', 'reversed')
    and rule.account_id is null;
end;
$function$;

create or replace function public.acknowledge_accounting_close_warnings(
  p_period_id uuid,
  p_note text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_employee_id();
  v_id uuid;
  v_codes text[];
begin
  if v_actor is null or not public.has_access_permission('finance.closing.acknowledge') then
    raise exception '缺少关账警告确认权限' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_note, ''))) not between 5 and 500 then
    raise exception '请填写完整确认说明' using errcode = '22023';
  end if;
  if not exists (select 1 from public.fiscal_periods where id = p_period_id and organization_id = v_org) then
    raise exception '会计期间不存在' using errcode = 'P0002';
  end if;
  select coalesce(array_agg(check_code order by check_code), array[]::text[])
  into v_codes from public.accounting_close_checklist(p_period_id)
  where severity = 'warning' and issue_count > 0;

  insert into public.accounting_close_acknowledgements
    (organization_id, period_id, warning_codes, note, acknowledged_by_employee_id)
  values (v_org, p_period_id, v_codes, btrim(p_note), v_actor)
  returning id into v_id;
  insert into public.audit_logs
    (organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, v_actor, 'accounting_close_warnings_acknowledged', 'fiscal_period', p_period_id,
    '确认月末关账警告', jsonb_build_object('warningCodes', v_codes, 'note', btrim(p_note)));
  return v_id;
end;
$function$;

create or replace function public.prevent_posted_journal_mutation()
returns trigger language plpgsql set search_path = public, pg_temp as $function$
begin
  if old.status in ('posted', 'reversed') then
    if tg_op = 'UPDATE'
      and old.status = 'posted' and new.status = 'reversed'
      and old.reversal_entry_id is null and new.reversal_entry_id is not null
      and new.version = old.version + 1
      and (
        new.source_type = old.source_type
        or (old.source_type = 'period_close' and new.source_type like 'period_close_history_%')
      )
      and (
        to_jsonb(new) - array['status', 'reversal_entry_id', 'source_type', 'version']::text[]
      ) = (
        to_jsonb(old) - array['status', 'reversal_entry_id', 'source_type', 'version']::text[]
      )
    then
      return new;
    end if;
    raise exception '已过账凭证不可直接修改或删除' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

create or replace function public.request_period_reopening(
  p_period_id uuid,
  p_reason text,
  p_confirmation text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_employee_id();
  v_period public.fiscal_periods%rowtype;
  v_closing public.journal_entries%rowtype;
  v_reversal_id uuid;
  v_entry_no text;
begin
  if v_actor is null or not (
    public.has_access_permission('finance.closing.reopen') or public.has_org_role('chairman')
  ) then
    raise exception '缺少反结账权限' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 5 and 200 then
    raise exception '请填写完整反结账原因' using errcode = '22023';
  end if;
  select * into v_period from public.fiscal_periods
  where id = p_period_id and organization_id = v_org for update;
  if v_period.id is null or v_period.status <> 'closed'
    or btrim(coalesce(p_confirmation, '')) <> v_period.name
    or v_period.closing_entry_id is null then
    raise exception '期间状态或确认名称无效' using errcode = '23514';
  end if;
  if exists (
    select 1 from public.fiscal_periods later
    where later.book_id = v_period.book_id and later.starts_on > v_period.starts_on
      and later.status = 'closed'
  ) then
    raise exception '必须先处理更晚的已结账期间' using errcode = '23514';
  end if;
  select * into v_closing from public.journal_entries
  where id = v_period.closing_entry_id and status = 'posted';
  if v_closing.id is null then
    raise exception '损益结转凭证不可反结转' using errcode = '23514';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_period.book_id::text || ':reopen:' || v_period.id::text, 0));
  v_entry_no := '反结-' || to_char(v_period.ends_on, 'YYYYMM') || '-' || lpad((v_period.close_version + 1)::text, 2, '0');
  insert into public.journal_entries (
    organization_id, book_id, period_id, entry_no, entry_date, summary,
    source_type, source_id, status, attachment_count, total_debit, total_credit,
    created_by_employee_id
  ) values (
    v_org, v_period.book_id, v_period.id, v_entry_no, v_period.ends_on,
    v_period.name || '反结转：' || btrim(p_reason), 'period_close_reversal', v_closing.id,
    'draft', 0, v_closing.total_credit, v_closing.total_debit, v_actor
  ) returning id into v_reversal_id;
  insert into public.journal_lines (
    organization_id, entry_id, line_no, account_id, summary, debit_amount, credit_amount,
    currency, original_amount, exchange_rate, counterparty_type, counterparty_id,
    department_id, project_code
  )
  select v_org, v_reversal_id, line.line_no, line.account_id, '反结转：' || line.summary,
    line.credit_amount, line.debit_amount, line.currency, -line.original_amount,
    line.exchange_rate, line.counterparty_type, line.counterparty_id, line.department_id, line.project_code
  from public.journal_lines line where line.entry_id = v_closing.id order by line.line_no;

  update public.fiscal_periods set status = 'reopening', reopening_entry_id = v_reversal_id
  where id = v_period.id;
  insert into public.audit_logs
    (organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, v_actor, 'period_reopening_requested', 'fiscal_period', v_period.id,
    '申请反结账 ' || v_period.name,
    jsonb_build_object('reversalEntryId', v_reversal_id, 'reason', btrim(p_reason)));
  return jsonb_build_object('id', v_reversal_id, 'entryNo', v_entry_no, 'status', 'draft');
end;
$function$;

create or replace function public.finalize_period_reopening()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_period public.fiscal_periods%rowtype;
begin
  if new.source_type <> 'period_close_reversal' or new.status <> 'posted' or old.status = 'posted' then
    return new;
  end if;
  select * into v_period from public.fiscal_periods
  where reopening_entry_id = new.id for update;
  if v_period.id is null or v_period.status <> 'reopening' then
    raise exception '反结转凭证与期间状态不匹配' using errcode = '23514';
  end if;
  update public.journal_entries set status = 'reversed', reversal_entry_id = new.id,
    source_type = 'period_close_history_' || lpad((v_period.close_version + 1)::text, 3, '0'),
    version = version + 1
  where id = v_period.closing_entry_id;
  update public.fiscal_periods set status = 'open', closing_entry_id = null,
    reopening_entry_id = null, closed_at = null, closed_by_employee_id = null,
    close_version = close_version + 1 where id = v_period.id;
  insert into public.audit_logs
    (organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata)
  values (new.organization_id, new.posted_by_employee_id, 'period_reopened', 'fiscal_period', v_period.id,
    '完成反结账 ' || v_period.name,
    jsonb_build_object('reversalEntryId', new.id, 'originalClosingEntryId', v_period.closing_entry_id));
  return new;
end;
$function$;

create or replace function public.enforce_period_close_readiness()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $function$
begin
  if old.status = 'closed' and new.status = 'open' and old.closing_entry_id is not null then
    raise exception '含已过账损益结转的期间必须使用受控反结账流程' using errcode = '23514';
  end if;
  if old.status = 'open' and new.status = 'closed' then
    if exists (
      select 1 from public.accounting_close_checklist(old.id)
      where severity = 'blocker' and issue_count > 0
    ) then
      raise exception '月末关账仍存在阻断项' using errcode = '23514';
    end if;
    if exists (
      select 1 from public.accounting_close_checklist(old.id)
      where severity = 'warning' and issue_count > 0
    ) and not exists (
      select 1 from public.accounting_close_acknowledgements acknowledgement
      where acknowledgement.period_id = old.id
        and acknowledgement.acknowledged_at >= now() - interval '24 hours'
        and acknowledgement.warning_codes = (
          select coalesce(array_agg(check_code order by check_code), array[]::text[])
          from public.accounting_close_checklist(old.id)
          where severity = 'warning' and issue_count > 0
        )
    ) then
      raise exception '存在未确认的关账警告' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.transition_period_reopening_entry(
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
  v_actor uuid := public.current_employee_id();
  v_org uuid := public.current_organization_id();
  v_entry public.journal_entries%rowtype;
  v_period_status text;
  v_next_status text;
begin
  if v_actor is null then raise exception '登录账号不可用' using errcode = '42501'; end if;
  if p_action = 'review' and not public.has_access_permission('finance.voucher.review') then
    raise exception '缺少凭证审核权限' using errcode = '42501';
  end if;
  if p_action = 'post' and not public.has_access_permission('finance.voucher.post') then
    raise exception '缺少凭证过账权限' using errcode = '42501';
  end if;
  select * into v_entry from public.journal_entries
  where id = p_entry_id and organization_id = v_org for update;
  if v_entry.id is null or v_entry.version <> p_expected_version
    or v_entry.source_type <> 'period_close_reversal' then
    raise exception '反结转凭证不存在或版本已变化' using errcode = '40001';
  end if;
  select status into v_period_status from public.fiscal_periods where id = v_entry.period_id;
  if v_period_status <> 'reopening' then
    raise exception '会计期间不在反结账中' using errcode = '23514';
  end if;
  if v_entry.created_by_employee_id = v_actor then
    raise exception '制单人不能审核或过账本人凭证' using errcode = '23514';
  end if;
  if p_action = 'review' and v_entry.status = 'draft' then
    v_next_status := 'reviewed';
    update public.journal_entries set status = v_next_status,
      reviewed_by_employee_id = v_actor, reviewed_at = now(), version = version + 1
    where id = p_entry_id;
  elsif p_action = 'post' and v_entry.status = 'reviewed' then
    if v_entry.total_debit <= 0 or v_entry.total_debit <> v_entry.total_credit then
      raise exception '借贷不平衡凭证不能过账' using errcode = '23514';
    end if;
    v_next_status := 'posted';
    update public.journal_entries set status = v_next_status,
      posted_by_employee_id = v_actor, posted_at = now(), version = version + 1
    where id = p_entry_id;
  else
    raise exception '凭证状态不允许执行该操作' using errcode = '23514';
  end if;
  insert into public.audit_logs
    (organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata)
  values (v_org, v_actor, 'period_reopening_entry_' || p_action, 'journal_entry', p_entry_id,
    case when p_action = 'review' then '审核反结转凭证 ' else '过账反结转凭证 ' end || v_entry.entry_no,
    jsonb_build_object('beforeStatus', v_entry.status, 'afterStatus', v_next_status));
  return jsonb_build_object('id', p_entry_id, 'entryNo', v_entry.entry_no, 'status', v_next_status);
end;
$function$;

drop trigger if exists journal_entries_finalize_period_reopening on public.journal_entries;
create trigger journal_entries_finalize_period_reopening
after update of status on public.journal_entries
for each row execute function public.finalize_period_reopening();

revoke all on function public.accounting_close_checklist(uuid) from public, anon;
revoke all on function public.acknowledge_accounting_close_warnings(uuid, text) from public, anon;
revoke all on function public.request_period_reopening(uuid, text, text) from public, anon;
revoke all on function public.transition_period_reopening_entry(uuid, text, integer) from public, anon;
revoke all on function public.finalize_period_reopening() from public, anon, authenticated;
grant execute on function public.accounting_close_checklist(uuid) to authenticated;
grant execute on function public.acknowledge_accounting_close_warnings(uuid, text) to authenticated;
grant execute on function public.request_period_reopening(uuid, text, text) to authenticated;
grant execute on function public.transition_period_reopening_entry(uuid, text, integer) to authenticated;

create table public.business_saved_views (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  view_key text not null check (view_key ~ '^[a-z][a-z0-9_.-]{2,79}$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  config jsonb not null default '{}'::jsonb check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 10000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, employee_id, view_key, name)
);
create index business_saved_views_owner_idx on public.business_saved_views (employee_id, view_key, updated_at desc);
alter table public.business_saved_views enable row level security;
create policy business_saved_views_select_own on public.business_saved_views for select to authenticated
using (organization_id = public.current_organization_id() and employee_id = public.current_employee_id());
revoke all on table public.business_saved_views from public, anon, authenticated;
grant select on table public.business_saved_views to authenticated;

create or replace function public.save_business_view(p_view_key text, p_name text, p_config jsonb)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_employee uuid := public.current_employee_id();
  v_id uuid;
begin
  if v_org is null or v_employee is null then raise exception '登录状态已失效' using errcode = '42501'; end if;
  if p_view_key !~ '^[a-z][a-z0-9_.-]{2,79}$' or char_length(btrim(coalesce(p_name, ''))) not between 2 and 40
    or jsonb_typeof(p_config) <> 'object' or octet_length(p_config::text) > 10000 then
    raise exception '保存视图参数无效' using errcode = '22023';
  end if;
  insert into public.business_saved_views (organization_id, employee_id, view_key, name, config)
  values (v_org, v_employee, p_view_key, btrim(p_name), p_config)
  on conflict (organization_id, employee_id, view_key, name) do update set
    config = excluded.config, updated_at = now()
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.save_business_view(text, text, jsonb) from public, anon;
grant execute on function public.save_business_view(text, text, jsonb) to authenticated;

commit;
