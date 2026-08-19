begin;

create table public.finance_cash_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_no text not null,
  document_type text not null check (document_type in ('receipt', 'payment')),
  counterparty_name text not null,
  document_date date not null default current_date,
  payment_channel text not null default 'bank'
    check (payment_channel in ('bank', 'wechat', 'alipay', 'cash', 'other')),
  account_name text,
  total_amount numeric(14, 2) not null check (total_amount > 0),
  allocated_amount numeric(14, 2) not null default 0
    check (allocated_amount >= 0 and allocated_amount <= total_amount),
  bank_reference text,
  summary text not null,
  note text,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'approved', 'completed', 'void')),
  version integer not null default 1 check (version > 0),
  transaction_id uuid references public.finance_transactions(id) on delete restrict,
  voucher_id uuid references public.finance_vouchers(id) on delete restrict,
  created_by_employee_id uuid not null references public.employees(id),
  submitted_by_employee_id uuid references public.employees(id),
  approved_by_employee_id uuid references public.employees(id),
  completed_by_employee_id uuid references public.employees(id),
  submitted_at timestamptz,
  approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, document_no)
);

create table public.finance_cash_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  cash_document_id uuid not null references public.finance_cash_documents(id) on delete cascade,
  finance_document_id uuid not null references public.finance_documents(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  settlement_id uuid references public.finance_settlements(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (cash_document_id, finance_document_id)
);

create index finance_cash_documents_org_status_date_idx
  on public.finance_cash_documents (organization_id, document_type, status, document_date desc);
create index finance_cash_documents_creator_idx
  on public.finance_cash_documents (created_by_employee_id, created_at desc);
create index finance_cash_allocations_cash_idx
  on public.finance_cash_allocations (cash_document_id);
create index finance_cash_allocations_finance_document_idx
  on public.finance_cash_allocations (finance_document_id);

create trigger finance_cash_documents_set_updated_at
before update on public.finance_cash_documents
for each row execute function public.set_updated_at();

alter table public.finance_cash_documents enable row level security;
alter table public.finance_cash_allocations enable row level security;

create policy finance_cash_documents_select_authorized
on public.finance_cash_documents for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

create policy finance_cash_allocations_select_authorized
on public.finance_cash_allocations for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.has_org_role('finance'))
    or (select public.has_org_role('chairman'))
  )
);

revoke all on table public.finance_cash_documents from public, anon, authenticated;
revoke all on table public.finance_cash_allocations from public, anon, authenticated;
grant select on table public.finance_cash_documents to authenticated;
grant select on table public.finance_cash_allocations to authenticated;

create or replace function public.create_finance_cash_document(
  p_document_type text,
  p_counterparty_name text,
  p_document_date date,
  p_payment_channel text,
  p_account_name text,
  p_total_amount numeric,
  p_bank_reference text,
  p_summary text,
  p_note text,
  p_allocations jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_id uuid;
  v_document_no text;
  v_prefix text;
  v_allocated numeric(14, 2);
  v_allocation_count integer;
  v_distinct_count integer;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;

  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以创建收付款单' using errcode = '42501';
  end if;
  if p_document_type not in ('receipt', 'payment')
    or p_document_date is null
    or p_payment_channel not in ('bank', 'wechat', 'alipay', 'cash', 'other')
    or p_total_amount <= 0
    or char_length(btrim(coalesce(p_counterparty_name, ''))) < 2
    or char_length(btrim(coalesce(p_summary, ''))) < 2
    or jsonb_typeof(coalesce(p_allocations, '[]'::jsonb)) <> 'array'
  then
    raise exception '收付款单参数无效' using errcode = '22023';
  end if;

  select coalesce(sum(item.amount), 0), count(*), count(distinct item.document_id)
  into v_allocated, v_allocation_count, v_distinct_count
  from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
    as item(document_id uuid, amount numeric);

  if v_allocated > p_total_amount or v_allocation_count <> v_distinct_count then
    raise exception '核销明细重复或超过收付款金额' using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
      as item(document_id uuid, amount numeric)
    left join public.finance_documents document on document.id = item.document_id
    where item.document_id is null
      or item.amount is null
      or item.amount <= 0
      or document.id is null
      or document.organization_id <> v_actor.organization_id
      or document.status not in ('open', 'partial')
      or document.document_type <> case when p_document_type = 'receipt' then 'receivable' else 'payable' end
      or item.amount > document.total_amount - document.settled_amount
  ) then
    raise exception '核销明细与应收应付单据不匹配' using errcode = '22023';
  end if;

  v_prefix := case when p_document_type = 'receipt' then 'DXRC' else 'DXPM' end;
  v_document_no := v_prefix || '-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
    || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  insert into public.finance_cash_documents (
    organization_id, document_no, document_type, counterparty_name,
    document_date, payment_channel, account_name, total_amount,
    allocated_amount, bank_reference, summary, note, created_by_employee_id
  ) values (
    v_actor.organization_id, v_document_no, p_document_type,
    btrim(p_counterparty_name), p_document_date, p_payment_channel,
    nullif(btrim(coalesce(p_account_name, '')), ''), p_total_amount,
    v_allocated, nullif(btrim(coalesce(p_bank_reference, '')), ''),
    btrim(p_summary), nullif(btrim(coalesce(p_note, '')), ''), v_actor.id
  ) returning id into v_id;

  insert into public.finance_cash_allocations (
    organization_id, cash_document_id, finance_document_id, amount
  )
  select v_actor.organization_id, v_id, item.document_id, item.amount
  from jsonb_to_recordset(coalesce(p_allocations, '[]'::jsonb))
    as item(document_id uuid, amount numeric);

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'finance_cash_document_created',
    'finance_cash_document', v_id, '创建' || case when p_document_type = 'receipt' then '收款单 ' else '付款单 ' end || v_document_no,
    jsonb_build_object('documentType', p_document_type, 'amount', p_total_amount, 'allocatedAmount', v_allocated)
  );

  return jsonb_build_object('id', v_id, 'documentNo', v_document_no, 'status', 'draft');
end;
$function$;

create or replace function public.transition_finance_cash_document(
  p_cash_document_id uuid,
  p_action text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_cash public.finance_cash_documents%rowtype;
  v_transaction_id uuid;
  v_voucher_id uuid;
  v_transaction_no text;
  v_voucher_no text;
  v_settlement_id uuid;
  v_allocation record;
  v_document public.finance_documents%rowtype;
  v_sequence integer := 0;
begin
  select * into v_actor
  from public.employees
  where auth_user_id = (select auth.uid()) and status = 'active'
  limit 1;
  if v_actor.id is null then
    raise exception '当前员工账号不可用' using errcode = '42501';
  end if;

  select * into v_cash
  from public.finance_cash_documents
  where id = p_cash_document_id and organization_id = v_actor.organization_id
  for update;
  if v_cash.id is null then
    raise exception '收付款单不存在' using errcode = 'P0002';
  end if;

  if p_action = 'submit' then
    if not public.has_org_role('finance') or v_cash.status <> 'draft' then
      raise exception '当前状态不能提交' using errcode = '42501';
    end if;
    update public.finance_cash_documents
    set status = 'submitted', submitted_by_employee_id = v_actor.id,
        submitted_at = now(), version = version + 1
    where id = v_cash.id;

  elsif p_action = 'approve' then
    if v_cash.document_type <> 'payment' or v_cash.status <> 'submitted'
      or not public.has_org_role('chairman') then
      raise exception '只有董事长可以审批已提交付款单' using errcode = '42501';
    end if;
    update public.finance_cash_documents
    set status = 'approved', approved_by_employee_id = v_actor.id,
        approved_at = now(), version = version + 1
    where id = v_cash.id;

  elsif p_action = 'reject' then
    if v_cash.document_type <> 'payment' or v_cash.status <> 'submitted'
      or not public.has_org_role('chairman')
      or char_length(btrim(coalesce(p_note, ''))) < 2 then
      raise exception '付款单退回必须由董事长填写原因' using errcode = '42501';
    end if;
    update public.finance_cash_documents
    set status = 'draft', submitted_by_employee_id = null, submitted_at = null,
        note = concat_ws(E'\n', note, '审批退回：' || btrim(p_note)), version = version + 1
    where id = v_cash.id;

  elsif p_action = 'void' then
    if v_cash.status = 'completed'
      or not (
        (public.has_org_role('finance') and v_cash.status = 'draft')
        or (public.has_org_role('chairman') and v_cash.status in ('submitted', 'approved'))
      )
      or char_length(btrim(coalesce(p_note, ''))) < 2 then
      raise exception '当前状态不能作废或未填写原因' using errcode = '42501';
    end if;
    update public.finance_cash_documents
    set status = 'void', note = concat_ws(E'\n', note, '作废：' || btrim(p_note)), version = version + 1
    where id = v_cash.id;

  elsif p_action = 'complete' then
    if not public.has_org_role('finance')
      or not (
        (v_cash.document_type = 'receipt' and v_cash.status = 'submitted')
        or (v_cash.document_type = 'payment' and v_cash.status = 'approved')
      ) then
      raise exception '当前收付款单尚未满足执行条件' using errcode = '42501';
    end if;

    perform document.id
    from public.finance_documents document
    join public.finance_cash_allocations allocation on allocation.finance_document_id = document.id
    where allocation.cash_document_id = v_cash.id
    order by document.id
    for update of document;

    if exists (
      select 1
      from public.finance_cash_allocations allocation
      join public.finance_documents document on document.id = allocation.finance_document_id
      where allocation.cash_document_id = v_cash.id
        and (
          document.organization_id <> v_actor.organization_id
          or document.status not in ('open', 'partial')
          or document.document_type <> case when v_cash.document_type = 'receipt' then 'receivable' else 'payable' end
          or allocation.amount > document.total_amount - document.settled_amount
        )
    ) then
      raise exception '应收应付余额已变化，请重新制单' using errcode = '40001';
    end if;

    v_transaction_no := 'DXF-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    v_voucher_no := 'DXV-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    insert into public.finance_transactions (
      organization_id, transaction_no, transaction_type, category,
      counterparty, amount, occurred_on, payment_channel, account_name,
      voucher_no, status, note, created_by_employee_id
    ) values (
      v_actor.organization_id, v_transaction_no,
      case when v_cash.document_type = 'receipt' then 'income' else 'expense' end,
      case when v_cash.document_type = 'receipt' then '收款单' else '付款单' end,
      v_cash.counterparty_name, v_cash.total_amount, v_cash.document_date,
      v_cash.payment_channel, v_cash.account_name, v_voucher_no, 'confirmed',
      v_cash.document_no || ' · ' || v_cash.summary, v_actor.id
    ) returning id into v_transaction_id;

    insert into public.finance_vouchers (
      organization_id, voucher_no, voucher_date, voucher_type, summary,
      debit_account, credit_account, amount, attachment_count, status,
      created_by_employee_id
    ) values (
      v_actor.organization_id, v_voucher_no, v_cash.document_date,
      v_cash.document_type, v_cash.summary,
      case when v_cash.document_type = 'receipt' then coalesce(v_cash.account_name, '银行存款') else '应付账款/预付账款' end,
      case when v_cash.document_type = 'receipt' then '应收账款/预收账款' else coalesce(v_cash.account_name, '银行存款') end,
      v_cash.total_amount, 0, 'posted', v_actor.id
    ) returning id into v_voucher_id;

    for v_allocation in
      select allocation.*
      from public.finance_cash_allocations allocation
      where allocation.cash_document_id = v_cash.id
      order by allocation.id
    loop
      v_sequence := v_sequence + 1;
      select * into v_document
      from public.finance_documents
      where id = v_allocation.finance_document_id;

      insert into public.finance_settlements (
        organization_id, settlement_no, document_id, transaction_id,
        voucher_id, settlement_type, amount, settled_on, payment_channel,
        account_name, note, created_by_employee_id
      ) values (
        v_actor.organization_id,
        'DXS-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
          || upper(substr(replace(v_cash.id::text, '-', ''), 1, 4))
          || lpad(v_sequence::text, 2, '0'),
        v_document.id, v_transaction_id, v_voucher_id, v_cash.document_type,
        v_allocation.amount, v_cash.document_date, v_cash.payment_channel,
        v_cash.account_name, '来源：' || v_cash.document_no, v_actor.id
      ) returning id into v_settlement_id;

      update public.finance_cash_allocations
      set settlement_id = v_settlement_id
      where id = v_allocation.id;

      update public.finance_documents
      set settled_amount = settled_amount + v_allocation.amount,
          status = case
            when settled_amount + v_allocation.amount >= total_amount then 'settled'
            else 'partial'
          end
      where id = v_document.id;
    end loop;

    update public.finance_cash_documents
    set status = 'completed', transaction_id = v_transaction_id,
        voucher_id = v_voucher_id, completed_by_employee_id = v_actor.id,
        completed_at = now(), version = version + 1
    where id = v_cash.id;

  else
    raise exception '未知的收付款单操作' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'finance_cash_document_' || p_action,
    'finance_cash_document', v_cash.id,
    v_cash.document_no || ' 执行操作：' || p_action,
    jsonb_build_object('beforeStatus', v_cash.status, 'action', p_action, 'note', p_note)
  );

  return (
    select jsonb_build_object(
      'id', document.id,
      'documentNo', document.document_no,
      'status', document.status,
      'transactionId', document.transaction_id,
      'voucherId', document.voucher_id
    )
    from public.finance_cash_documents document
    where document.id = v_cash.id
  );
end;
$function$;

revoke all on function public.create_finance_cash_document(
  text, text, date, text, text, numeric, text, text, text, jsonb
) from public, anon;
revoke all on function public.transition_finance_cash_document(uuid, text, text)
  from public, anon;
grant execute on function public.create_finance_cash_document(
  text, text, date, text, text, numeric, text, text, text, jsonb
) to authenticated;
grant execute on function public.transition_finance_cash_document(uuid, text, text)
  to authenticated;

comment on table public.finance_cash_documents is
  '独立收款单与付款单，完成时生成资金流水、凭证并执行多单核销。';
comment on table public.finance_cash_allocations is
  '收付款单对应的应收应付核销明细，允许一张资金单据分配至多张往来单据。';

commit;
