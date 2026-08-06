begin;

create or replace function public.finance_customer_statement(
  p_customer_id uuid,
  p_start_date date,
  p_end_date date
)
returns table (
  entry_date date,
  entry_type text,
  document_no text,
  source_no text,
  summary text,
  debit_amount numeric,
  credit_amount numeric,
  running_balance numeric
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_organization_id uuid := public.current_organization_id();
  v_opening_balance numeric := 0;
begin
  if public.current_employee_id() is null or v_organization_id is null then
    raise exception '当前账号不是有效的在职员工'
      using errcode = '42501';
  end if;

  if not (
    public.has_org_role('finance')
    or public.has_org_role('chairman')
  ) then
    raise exception '当前账号无权查看客户对账单'
      using errcode = '42501';
  end if;

  if p_customer_id is null
    or p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_end_date - p_start_date > 1826
  then
    raise exception '客户或查询期间无效'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.customers customer
    where customer.id = p_customer_id
      and customer.organization_id = v_organization_id
  ) then
    raise exception '客户不存在或不属于当前组织'
      using errcode = '22023';
  end if;

  select
    coalesce(sum(document.total_amount), 0)
    - coalesce((
      select sum(settlement.amount)
      from public.finance_settlements settlement
      join public.finance_documents settled_document
        on settled_document.id = settlement.document_id
      where settlement.organization_id = v_organization_id
        and settlement.settlement_type = 'receipt'
        and settlement.settled_on < p_start_date
        and settled_document.organization_id = v_organization_id
        and settled_document.customer_id = p_customer_id
        and settled_document.document_type = 'receivable'
        and settled_document.status <> 'void'
    ), 0)
  into v_opening_balance
  from public.finance_documents document
  where document.organization_id = v_organization_id
    and document.customer_id = p_customer_id
    and document.document_type = 'receivable'
    and document.status <> 'void'
    and document.issue_date < p_start_date;

  return query
  with events as (
    select
      document.issue_date as event_date,
      1 as event_order,
      'receivable'::text as event_type,
      document.document_no as event_document_no,
      document.source_no as event_source_no,
      document.summary as event_summary,
      document.total_amount::numeric as event_debit,
      0::numeric as event_credit
    from public.finance_documents document
    where document.organization_id = v_organization_id
      and document.customer_id = p_customer_id
      and document.document_type = 'receivable'
      and document.status <> 'void'
      and document.issue_date between p_start_date and p_end_date

    union all

    select
      settlement.settled_on as event_date,
      2 as event_order,
      'receipt'::text as event_type,
      settlement.settlement_no as event_document_no,
      document.document_no as event_source_no,
      coalesce(nullif(settlement.note, ''), '收款核销 ' || document.document_no) as event_summary,
      0::numeric as event_debit,
      settlement.amount::numeric as event_credit
    from public.finance_settlements settlement
    join public.finance_documents document
      on document.id = settlement.document_id
    where settlement.organization_id = v_organization_id
      and settlement.settlement_type = 'receipt'
      and settlement.settled_on between p_start_date and p_end_date
      and document.organization_id = v_organization_id
      and document.customer_id = p_customer_id
      and document.document_type = 'receivable'
      and document.status <> 'void'
  ),
  ordered_events as (
    select
      event.*,
      row_number() over (
        order by event.event_date, event.event_order, event.event_document_no
      ) as event_sequence
    from events event
  ),
  statement_rows as (
    select
      p_start_date as row_date,
      0 as row_order,
      0::bigint as row_sequence,
      'opening'::text as row_type,
      'OPENING'::text as row_document_no,
      null::text as row_source_no,
      '期初余额'::text as row_summary,
      0::numeric as row_debit,
      0::numeric as row_credit,
      v_opening_balance::numeric as row_balance

    union all

    select
      event.event_date,
      event.event_order,
      event.event_sequence,
      event.event_type,
      event.event_document_no,
      event.event_source_no,
      event.event_summary,
      event.event_debit,
      event.event_credit,
      (
        v_opening_balance
        + sum(event.event_debit - event.event_credit) over (
          order by event.event_date, event.event_order, event.event_document_no
          rows between unbounded preceding and current row
        )
      )::numeric
    from ordered_events event
  )
  select
    statement.row_date,
    statement.row_type,
    statement.row_document_no,
    statement.row_source_no,
    statement.row_summary,
    statement.row_debit,
    statement.row_credit,
    statement.row_balance
  from statement_rows statement
  order by statement.row_date, statement.row_order, statement.row_sequence;
end;
$function$;

revoke all on function public.finance_customer_statement(
  uuid,
  date,
  date
) from public;
grant execute on function public.finance_customer_statement(
  uuid,
  date,
  date
) to authenticated;

comment on function public.finance_customer_statement(uuid, date, date)
is '生成客户指定期间的应收对账单，包含期初、应收开单、收款核销与逐笔余额，仅财务和董事长可用。';

commit;
