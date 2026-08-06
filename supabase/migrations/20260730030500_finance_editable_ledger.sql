-- Finance phase 3: spreadsheet-style batch editing with optimistic locking.

begin;

create or replace function public.update_finance_documents(
  p_updates jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_item jsonb;
  v_document public.finance_documents%rowtype;
  v_document_id uuid;
  v_expected_updated_at timestamptz;
  v_document_type text;
  v_counterparty_name text;
  v_source_type text;
  v_source_no text;
  v_issue_date date;
  v_due_date date;
  v_total_amount numeric(14, 2);
  v_invoice_no text;
  v_summary text;
  v_note text;
  v_requested_status text;
  v_next_status text;
  v_updated_at timestamptz;
  v_result jsonb := '[]'::jsonb;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.has_org_role('finance') then
    raise exception '只有财务角色可以编辑应收应付台账'
      using errcode = '42501';
  end if;

  if jsonb_typeof(p_updates) <> 'array'
    or jsonb_array_length(p_updates) < 1
    or jsonb_array_length(p_updates) > 100
  then
    raise exception '批量更新数据无效'
      using errcode = '22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(p_updates)
  loop
    begin
      v_document_id := (v_item ->> 'id')::uuid;
      v_expected_updated_at := (v_item ->> 'expectedUpdatedAt')::timestamptz;
      v_document_type := btrim(v_item ->> 'documentType');
      v_counterparty_name := btrim(v_item ->> 'counterpartyName');
      v_source_type := btrim(v_item ->> 'sourceType');
      v_source_no := nullif(btrim(coalesce(v_item ->> 'sourceNo', '')), '');
      v_issue_date := (v_item ->> 'issueDate')::date;
      v_due_date := (v_item ->> 'dueDate')::date;
      v_total_amount := round((v_item ->> 'totalAmount')::numeric, 2);
      v_invoice_no := nullif(btrim(coalesce(v_item ->> 'invoiceNo', '')), '');
      v_summary := btrim(v_item ->> 'summary');
      v_note := nullif(btrim(coalesce(v_item ->> 'note', '')), '');
      v_requested_status := btrim(v_item ->> 'status');
    exception
      when others then
        raise exception '应收应付更新参数无效'
          using errcode = '22023';
    end;

    select *
    into v_document
    from public.finance_documents
    where id = v_document_id
      and organization_id = v_actor.organization_id
    for update;

    if v_document.id is null then
      raise exception '往来单据不存在或不属于当前组织'
        using errcode = '42501';
    end if;

    if v_document.updated_at <> v_expected_updated_at then
      raise exception '数据已由其他人更新，请刷新后重试（concurrent update）'
        using errcode = '40001';
    end if;

    if v_document_type not in ('receivable', 'payable')
      or v_source_type not in ('manual', 'order', 'purchase', 'expense', 'other')
      or v_requested_status not in ('open', 'partial', 'settled', 'void')
      or char_length(v_counterparty_name) < 1
      or char_length(v_counterparty_name) > 100
      or char_length(v_summary) < 1
      or char_length(v_summary) > 160
      or char_length(coalesce(v_source_no, '')) > 100
      or char_length(coalesce(v_invoice_no, '')) > 100
      or char_length(coalesce(v_note, '')) > 500
      or v_total_amount <= 0
      or v_total_amount > 100000000
      or v_due_date < v_issue_date
    then
      raise exception '应收应付更新参数无效'
        using errcode = '22023';
    end if;

    if v_document.settled_amount > 0
      and (
        v_document_type <> v_document.document_type
        or v_total_amount <> v_document.total_amount
      )
    then
      raise exception '已发生核销的单据不能修改类型或原始金额（settlement locked）'
        using errcode = '23514';
    end if;

    if v_total_amount < v_document.settled_amount then
      raise exception '单据金额不能低于已核销金额'
        using errcode = '23514';
    end if;

    if v_requested_status = 'void' then
      if v_document.settled_amount > 0 then
        raise exception '已发生核销的单据不能作废'
          using errcode = '23514';
      end if;
      v_next_status := 'void';
    elsif v_document.settled_amount = 0 then
      v_next_status := 'open';
    elsif v_document.settled_amount < v_total_amount then
      v_next_status := 'partial';
    else
      v_next_status := 'settled';
    end if;

    update public.finance_documents
    set
      document_type = v_document_type,
      counterparty_name = v_counterparty_name,
      source_type = v_source_type,
      source_no = v_source_no,
      issue_date = v_issue_date,
      due_date = v_due_date,
      total_amount = v_total_amount,
      invoice_no = v_invoice_no,
      summary = v_summary,
      note = v_note,
      status = v_next_status
    where id = v_document.id
    returning updated_at into v_updated_at;

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
      'finance_document_updated',
      'finance_document',
      v_document.id,
      '编辑应收应付台账：' || v_document.document_no,
      jsonb_build_object(
        'document_no', v_document.document_no,
        'before', jsonb_build_object(
          'document_type', v_document.document_type,
          'counterparty_name', v_document.counterparty_name,
          'due_date', v_document.due_date,
          'total_amount', v_document.total_amount,
          'status', v_document.status
        ),
        'after', jsonb_build_object(
          'document_type', v_document_type,
          'counterparty_name', v_counterparty_name,
          'due_date', v_due_date,
          'total_amount', v_total_amount,
          'status', v_next_status
        )
      )
    );

    v_result := v_result || jsonb_build_array(
      jsonb_build_object(
        'id', v_document.id,
        'updatedAt', v_updated_at
      )
    );
  end loop;

  return v_result;
end;
$function$;

revoke all on function public.update_finance_documents(jsonb) from public;
grant execute on function public.update_finance_documents(jsonb) to authenticated;

comment on function public.update_finance_documents(jsonb) is
  '财务角色批量编辑应收应付台账；使用 updated_at 乐观锁并记录逐行审计。';

commit;
