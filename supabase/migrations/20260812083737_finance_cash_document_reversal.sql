begin;

alter table public.finance_cash_documents
  add column reversal_status text
    check (reversal_status in ('pending', 'reversed')),
  add column reversal_reason text,
  add column reversal_requested_by_employee_id uuid references public.employees(id),
  add column reversal_requested_at timestamptz,
  add column reversal_reviewed_by_employee_id uuid references public.employees(id),
  add column reversal_reviewed_at timestamptz,
  add column reversal_transaction_id uuid references public.finance_transactions(id) on delete restrict,
  add column reversal_voucher_id uuid references public.finance_vouchers(id) on delete restrict;

alter table public.finance_settlements
  drop constraint finance_settlements_amount_check,
  add constraint finance_settlements_amount_nonzero_check check (amount <> 0),
  add column reverses_settlement_id uuid references public.finance_settlements(id) on delete restrict,
  add column reversal_cash_document_id uuid references public.finance_cash_documents(id) on delete restrict;

create unique index finance_settlements_reverses_unique_idx
  on public.finance_settlements (reverses_settlement_id)
  where reverses_settlement_id is not null;
create index finance_settlements_reversal_cash_idx
  on public.finance_settlements (reversal_cash_document_id)
  where reversal_cash_document_id is not null;
create index finance_cash_documents_reversal_queue_idx
  on public.finance_cash_documents (organization_id, reversal_status, reversal_requested_at)
  where reversal_status is not null;
create index finance_cash_documents_reversal_requester_idx
  on public.finance_cash_documents (reversal_requested_by_employee_id)
  where reversal_requested_by_employee_id is not null;
create index finance_cash_documents_reversal_reviewer_idx
  on public.finance_cash_documents (reversal_reviewed_by_employee_id)
  where reversal_reviewed_by_employee_id is not null;
create index finance_cash_documents_reversal_transaction_idx
  on public.finance_cash_documents (reversal_transaction_id)
  where reversal_transaction_id is not null;
create index finance_cash_documents_reversal_voucher_idx
  on public.finance_cash_documents (reversal_voucher_id)
  where reversal_voucher_id is not null;

create or replace function public.reverse_finance_cash_document(
  p_cash_document_id uuid,
  p_action text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_cash public.finance_cash_documents%rowtype;
  v_allocation record;
  v_document public.finance_documents%rowtype;
  v_original_settlement public.finance_settlements%rowtype;
  v_transaction_id uuid;
  v_voucher_id uuid;
  v_transaction_no text;
  v_voucher_no text;
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

  if p_action = 'request' then
    if not public.has_org_role('finance')
      or v_cash.status <> 'completed'
      or v_cash.reversal_status is not null
      or char_length(btrim(coalesce(p_note, ''))) < 4 then
      raise exception '只有财务可以为已完成单据发起红冲并填写原因' using errcode = '42501';
    end if;

    update public.finance_cash_documents
    set reversal_status = 'pending', reversal_reason = btrim(p_note),
        reversal_requested_by_employee_id = v_actor.id,
        reversal_requested_at = now(), reversal_reviewed_by_employee_id = null,
        reversal_reviewed_at = null, version = version + 1
    where id = v_cash.id;

  elsif p_action = 'reject' then
    if not public.has_org_role('chairman')
      or v_cash.status <> 'completed'
      or v_cash.reversal_status <> 'pending'
      or char_length(btrim(coalesce(p_note, ''))) < 2 then
      raise exception '只有董事长可以退回待审批红冲申请并填写意见' using errcode = '42501';
    end if;

    update public.finance_cash_documents
    set reversal_status = null,
        reversal_reason = concat_ws(E'\n', reversal_reason, '红冲退回：' || btrim(p_note)),
        reversal_reviewed_by_employee_id = v_actor.id,
        reversal_reviewed_at = now(), version = version + 1
    where id = v_cash.id;

  elsif p_action = 'approve' then
    if not public.has_org_role('chairman')
      or v_cash.status <> 'completed'
      or v_cash.reversal_status <> 'pending' then
      raise exception '只有董事长可以批准待审批红冲申请' using errcode = '42501';
    end if;

    perform document.id
    from public.finance_documents document
    join public.finance_cash_allocations allocation
      on allocation.finance_document_id = document.id
    where allocation.cash_document_id = v_cash.id
    order by document.id
    for update of document;

    if exists (
      select 1
      from public.finance_cash_allocations allocation
      join public.finance_documents document on document.id = allocation.finance_document_id
      left join public.finance_settlements original on original.id = allocation.settlement_id
      left join public.finance_settlements reversal on reversal.reverses_settlement_id = original.id
      where allocation.cash_document_id = v_cash.id
        and (
          original.id is null
          or reversal.id is not null
          or document.organization_id <> v_actor.organization_id
          or document.status = 'void'
          or document.settled_amount < allocation.amount
        )
    ) then
      raise exception '核销记录或往来余额已变化，无法红冲' using errcode = '40001';
    end if;

    v_transaction_no := 'DXFR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    v_voucher_no := 'DXVR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
      || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    insert into public.finance_transactions (
      organization_id, transaction_no, transaction_type, category,
      counterparty, amount, occurred_on, payment_channel, account_name,
      voucher_no, status, note, created_by_employee_id
    ) values (
      v_actor.organization_id, v_transaction_no,
      case when v_cash.document_type = 'receipt' then 'expense' else 'income' end,
      case when v_cash.document_type = 'receipt' then '收款红冲' else '付款红冲' end,
      v_cash.counterparty_name, v_cash.total_amount, current_date,
      v_cash.payment_channel, v_cash.account_name, v_voucher_no, 'confirmed',
      '红冲 ' || v_cash.document_no || ' · ' || v_cash.reversal_reason, v_actor.id
    ) returning id into v_transaction_id;

    insert into public.finance_vouchers (
      organization_id, voucher_no, voucher_date, voucher_type, summary,
      debit_account, credit_account, amount, attachment_count, status,
      created_by_employee_id
    ) values (
      v_actor.organization_id, v_voucher_no, current_date, v_cash.document_type,
      '红冲 ' || v_cash.document_no || ' · ' || v_cash.summary,
      case when v_cash.document_type = 'receipt' then '应收账款/预收账款' else coalesce(v_cash.account_name, '银行存款') end,
      case when v_cash.document_type = 'receipt' then coalesce(v_cash.account_name, '银行存款') else '应付账款/预付账款' end,
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
      select * into v_original_settlement
      from public.finance_settlements
      where id = v_allocation.settlement_id;

      insert into public.finance_settlements (
        organization_id, settlement_no, document_id, transaction_id,
        voucher_id, settlement_type, amount, settled_on, payment_channel,
        account_name, note, created_by_employee_id, reverses_settlement_id,
        reversal_cash_document_id
      ) values (
        v_actor.organization_id,
        'DXSR-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-'
          || upper(substr(replace(v_cash.id::text, '-', ''), 1, 4))
          || lpad(v_sequence::text, 2, '0'),
        v_document.id, v_transaction_id, v_voucher_id, v_cash.document_type,
        -v_allocation.amount, current_date, v_cash.payment_channel,
        v_cash.account_name, '红冲来源：' || v_cash.document_no, v_actor.id,
        v_original_settlement.id, v_cash.id
      );

      update public.finance_documents
      set settled_amount = settled_amount - v_allocation.amount,
          status = case
            when settled_amount - v_allocation.amount <= 0 then 'open'
            else 'partial'
          end
      where id = v_document.id;
    end loop;

    update public.finance_cash_documents
    set reversal_status = 'reversed', reversal_transaction_id = v_transaction_id,
        reversal_voucher_id = v_voucher_id,
        reversal_reviewed_by_employee_id = v_actor.id,
        reversal_reviewed_at = now(), version = version + 1
    where id = v_cash.id;

  else
    raise exception '未知的红冲操作' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'finance_cash_document_reversal_' || p_action,
    'finance_cash_document', v_cash.id,
    v_cash.document_no || ' 红冲操作：' || p_action,
    jsonb_build_object('action', p_action, 'note', p_note, 'previousReversalStatus', v_cash.reversal_status)
  );

  return (
    select jsonb_build_object(
      'id', document.id, 'documentNo', document.document_no,
      'reversalStatus', document.reversal_status,
      'reversalTransactionId', document.reversal_transaction_id,
      'reversalVoucherId', document.reversal_voucher_id
    )
    from public.finance_cash_documents document
    where document.id = v_cash.id
  );
end;
$function$;

revoke all on function public.reverse_finance_cash_document(uuid, text, text)
  from public, anon;
grant execute on function public.reverse_finance_cash_document(uuid, text, text)
  to authenticated;

create or replace function public.record_finance_report_export(
  p_report_code text,
  p_start_date date,
  p_end_date date,
  p_row_count integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_employee_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_report_name text;
begin
  if v_employee_id is null or v_organization_id is null then
    raise exception '当前账号不是有效的在职员工' using errcode = '42501';
  end if;
  if not (public.has_org_role('finance') or public.has_org_role('chairman')) then
    raise exception '当前账号无权导出财务报表' using errcode = '42501';
  end if;
  if p_report_code not in ('receivable_summary', 'cash_documents')
    or p_start_date is null or p_end_date is null or p_start_date > p_end_date
    or coalesce(p_row_count, -1) < 0 then
    raise exception '财务报表导出参数无效' using errcode = '22023';
  end if;

  v_report_name := case p_report_code
    when 'cash_documents' then '收付款单台账'
    else '应收账款汇总'
  end;
  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, summary, metadata
  ) values (
    v_organization_id, v_employee_id, 'finance_report_export', 'finance_report',
    '导出' || v_report_name || ' Excel',
    jsonb_build_object('report_code', p_report_code, 'start_date', p_start_date,
      'end_date', p_end_date, 'row_count', p_row_count, 'format', 'xlsx')
  );
end;
$function$;

comment on column public.finance_cash_documents.reversal_status is
  '红冲流程状态：财务发起 pending，董事长批准后 reversed。';
comment on column public.finance_settlements.reverses_settlement_id is
  '负数红冲核销指向原核销记录，保留完整审计链。';

commit;
