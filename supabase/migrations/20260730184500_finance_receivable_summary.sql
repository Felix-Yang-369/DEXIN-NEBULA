begin;

create or replace function public.finance_receivable_summary(
  p_start_date date,
  p_end_date date,
  p_search text default null,
  p_include_zero boolean default false
)
returns table (
  customer_key text,
  customer_id uuid,
  customer_no text,
  customer_name text,
  salesperson_no text,
  salesperson_name text,
  opening_balance numeric,
  period_receivable numeric,
  period_received numeric,
  ending_balance numeric,
  overdue_balance numeric,
  document_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_organization_id uuid := public.current_organization_id();
  v_search text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if public.current_employee_id() is null or v_organization_id is null then
    raise exception '当前账号不是有效的在职员工'
      using errcode = '42501';
  end if;

  if not (
    public.has_org_role('finance')
    or public.has_org_role('chairman')
  ) then
    raise exception '当前账号无权查看应收汇总账'
      using errcode = '42501';
  end if;

  if p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or p_end_date - p_start_date > 1826
  then
    raise exception '查询期间无效，单次查询不能超过五年'
      using errcode = '22023';
  end if;

  if v_search is not null and char_length(v_search) > 100 then
    raise exception '查询关键词不能超过100个字符'
      using errcode = '22023';
  end if;

  return query
  with settlement_rollup as (
    select
      settlement.document_id,
      coalesce(sum(settlement.amount) filter (
        where settlement.settled_on < p_start_date
      ), 0)::numeric as received_before_start,
      coalesce(sum(settlement.amount) filter (
        where settlement.settled_on between p_start_date and p_end_date
      ), 0)::numeric as received_in_period,
      coalesce(sum(settlement.amount) filter (
        where settlement.settled_on <= p_end_date
      ), 0)::numeric as received_through_end
    from public.finance_settlements settlement
    where settlement.organization_id = v_organization_id
      and settlement.settlement_type = 'receipt'
      and settlement.settled_on <= p_end_date
    group by settlement.document_id
  ),
  document_rows as (
    select
      coalesce(document.customer_id::text, 'manual:' || lower(document.counterparty_name)) as row_key,
      document.customer_id as row_customer_id,
      customer.customer_no as row_customer_no,
      coalesce(customer.name, document.counterparty_name) as row_customer_name,
      salesperson.employee_no as row_salesperson_no,
      salesperson.name as row_salesperson_name,
      case
        when document.issue_date < p_start_date
          then greatest(
            document.total_amount - coalesce(settlement.received_before_start, 0),
            0
          )
        else 0
      end::numeric as row_opening_balance,
      case
        when document.issue_date between p_start_date and p_end_date
          then document.total_amount
        else 0
      end::numeric as row_period_receivable,
      coalesce(settlement.received_in_period, 0)::numeric as row_period_received,
      greatest(
        document.total_amount - coalesce(settlement.received_through_end, 0),
        0
      )::numeric as row_ending_balance,
      case
        when document.due_date < p_end_date
          then greatest(
            document.total_amount - coalesce(settlement.received_through_end, 0),
            0
          )
        else 0
      end::numeric as row_overdue_balance
    from public.finance_documents document
    left join public.customers customer
      on customer.id = document.customer_id
      and customer.organization_id = v_organization_id
    left join public.employees salesperson
      on salesperson.id = customer.owner_employee_id
      and salesperson.organization_id = v_organization_id
    left join settlement_rollup settlement
      on settlement.document_id = document.id
    where document.organization_id = v_organization_id
      and document.document_type = 'receivable'
      and document.status <> 'void'
      and document.issue_date <= p_end_date
      and (
        v_search is null
        or coalesce(customer.customer_no, '') ilike '%' || v_search || '%'
        or coalesce(customer.name, document.counterparty_name) ilike '%' || v_search || '%'
        or coalesce(salesperson.employee_no, '') ilike '%' || v_search || '%'
        or coalesce(salesperson.name, '') ilike '%' || v_search || '%'
      )
  ),
  grouped as (
    select
      row_key,
      row_customer_id as grouped_customer_id,
      row_customer_no as grouped_customer_no,
      row_customer_name as grouped_customer_name,
      row_salesperson_no as grouped_salesperson_no,
      row_salesperson_name as grouped_salesperson_name,
      sum(row_opening_balance)::numeric as grouped_opening_balance,
      sum(row_period_receivable)::numeric as grouped_period_receivable,
      sum(row_period_received)::numeric as grouped_period_received,
      sum(row_ending_balance)::numeric as grouped_ending_balance,
      sum(row_overdue_balance)::numeric as grouped_overdue_balance,
      count(*)::bigint as grouped_document_count
    from document_rows
    group by
      row_key,
      row_customer_id,
      row_customer_no,
      row_customer_name,
      row_salesperson_no,
      row_salesperson_name
  )
  select
    grouped.row_key,
    grouped.grouped_customer_id,
    grouped.grouped_customer_no,
    grouped.grouped_customer_name,
    grouped.grouped_salesperson_no,
    grouped.grouped_salesperson_name,
    grouped.grouped_opening_balance,
    grouped.grouped_period_receivable,
    grouped.grouped_period_received,
    grouped.grouped_ending_balance,
    grouped.grouped_overdue_balance,
    grouped.grouped_document_count
  from grouped
  where p_include_zero
    or grouped.grouped_opening_balance <> 0
    or grouped.grouped_period_receivable <> 0
    or grouped.grouped_period_received <> 0
    or grouped.grouped_ending_balance <> 0
  order by
    grouped.grouped_ending_balance desc,
    grouped.grouped_customer_name asc;
end;
$function$;

revoke all on function public.finance_receivable_summary(
  date,
  date,
  text,
  boolean
) from public;
grant execute on function public.finance_receivable_summary(
  date,
  date,
  text,
  boolean
) to authenticated;

comment on function public.finance_receivable_summary(date, date, text, boolean)
is '按客户和默认业务员汇总指定期间的应收期初、本期应收、回款、期末余额及逾期风险，仅财务和董事长可用。';

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
begin
  if v_employee_id is null or v_organization_id is null then
    raise exception '当前账号不是有效的在职员工'
      using errcode = '42501';
  end if;

  if not (
    public.has_org_role('finance')
    or public.has_org_role('chairman')
  ) then
    raise exception '当前账号无权导出财务报表'
      using errcode = '42501';
  end if;

  if p_report_code <> 'receivable_summary'
    or p_start_date is null
    or p_end_date is null
    or p_start_date > p_end_date
    or coalesce(p_row_count, -1) < 0
  then
    raise exception '财务报表导出参数无效'
      using errcode = '22023';
  end if;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    summary,
    metadata
  )
  values (
    v_organization_id,
    v_employee_id,
    'finance_report_export',
    'finance_report',
    '导出应收账款汇总 Excel',
    jsonb_build_object(
      'report_code', p_report_code,
      'start_date', p_start_date,
      'end_date', p_end_date,
      'row_count', p_row_count,
      'format', 'xlsx'
    )
  );
end;
$function$;

revoke all on function public.record_finance_report_export(
  text,
  date,
  date,
  integer
) from public;
grant execute on function public.record_finance_report_export(
  text,
  date,
  date,
  integer
) to authenticated;

comment on function public.record_finance_report_export(text, date, date, integer)
is '记录财务或董事长导出财务报表的审计事件，不存储查询关键词和报表内容。';

commit;
