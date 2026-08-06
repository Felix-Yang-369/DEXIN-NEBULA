begin;

create or replace function public.hr_crm_contribution_summary(
  p_month date
)
returns table (
  employee_id uuid,
  employee_no text,
  employee_name text,
  department_name text,
  customer_count bigint,
  active_customer_count bigint,
  accepted_quote_count bigint,
  sales_amount numeric,
  estimated_cost numeric,
  estimated_gross_profit numeric,
  previous_gross_profit numeric,
  profit_increment numeric,
  missing_cost_item_count bigint
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_employee_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_month_start date := date_trunc('month', p_month)::date;
  v_month_end date := (date_trunc('month', p_month) + interval '1 month')::date;
  v_previous_start date := (date_trunc('month', p_month) - interval '1 month')::date;
  v_full_access boolean;
  v_customer_team boolean;
begin
  if v_employee_id is null or v_organization_id is null then
    raise exception '当前账号不是有效的在职员工'
      using errcode = '42501';
  end if;

  if p_month is null
    or v_month_start < date '2020-01-01'
    or v_month_start > (current_date + interval '1 year')::date
  then
    raise exception '统计月份无效'
      using errcode = '22023';
  end if;

  v_full_access :=
    public.has_org_role('hr')
    or public.has_org_role('admin')
    or public.has_org_role('chairman')
    or public.has_org_role('finance');

  select exists (
    select 1
    from public.employees employee
    join public.departments department
      on department.id = employee.department_id
    where employee.id = v_employee_id
      and employee.organization_id = v_organization_id
      and employee.status = 'active'
      and department.code in ('DX-CS', 'DX-SALES')
  )
  into v_customer_team;

  if not v_full_access and not v_customer_team then
    raise exception '当前账号无权查看客户利润贡献'
      using errcode = '42501';
  end if;

  return query
  with accepted_events as (
    select distinct on (event.quote_id)
      event.quote_id,
      event.created_at as accepted_at
    from public.sales_quote_events event
    where event.organization_id = v_organization_id
      and event.to_status = 'accepted'
    order by event.quote_id, event.created_at
  ),
  quote_financials as (
    select
      quote.id as quote_id,
      quote.owner_employee_id,
      accepted.accepted_at,
      quote.total_cny::numeric as quote_sales,
      coalesce(sum(
        item.quantity * coalesce(procurement.amount_cny, 0)
      ), 0)::numeric as quote_cost,
      count(item.id) filter (
        where procurement.amount_cny is null
      )::bigint as missing_cost_items
    from public.sales_quotes quote
    join accepted_events accepted
      on accepted.quote_id = quote.id
    left join public.sales_quote_items item
      on item.quote_id = quote.id
    left join lateral (
      select price.amount_cny
      from public.product_prices price
      where price.organization_id = v_organization_id
        and price.product_id = item.product_id
        and price.price_type = 'procurement'
        and price.status = 'active'
        and price.valid_from <= accepted.accepted_at::date
        and (
          price.valid_until is null
          or price.valid_until >= accepted.accepted_at::date
        )
      order by price.valid_from desc, price.created_at desc
      limit 1
    ) procurement on true
    where quote.organization_id = v_organization_id
      and quote.status = 'accepted'
    group by
      quote.id,
      quote.owner_employee_id,
      accepted.accepted_at,
      quote.total_cny
  ),
  quote_totals as (
    select
      financial.owner_employee_id,
      count(*) filter (
        where financial.accepted_at >= v_month_start
          and financial.accepted_at < v_month_end
      )::bigint as current_quote_count,
      coalesce(sum(financial.quote_sales) filter (
        where financial.accepted_at >= v_month_start
          and financial.accepted_at < v_month_end
      ), 0)::numeric as current_sales,
      coalesce(sum(financial.quote_cost) filter (
        where financial.accepted_at >= v_month_start
          and financial.accepted_at < v_month_end
      ), 0)::numeric as current_cost,
      coalesce(sum(financial.quote_sales - financial.quote_cost) filter (
        where financial.accepted_at >= v_month_start
          and financial.accepted_at < v_month_end
      ), 0)::numeric as current_profit,
      coalesce(sum(financial.quote_sales - financial.quote_cost) filter (
        where financial.accepted_at >= v_previous_start
          and financial.accepted_at < v_month_start
      ), 0)::numeric as previous_profit,
      coalesce(sum(financial.missing_cost_items) filter (
        where financial.accepted_at >= v_month_start
          and financial.accepted_at < v_month_end
      ), 0)::bigint as missing_cost_items
    from quote_financials financial
    group by financial.owner_employee_id
  ),
  customer_totals as (
    select
      customer.owner_employee_id,
      count(*)::bigint as all_customers,
      count(*) filter (
        where customer.status = 'active'
      )::bigint as active_customers
    from public.customers customer
    where customer.organization_id = v_organization_id
      and customer.owner_employee_id is not null
    group by customer.owner_employee_id
  ),
  responsible_employees as (
    select employee.*
    from public.employees employee
    left join public.departments department
      on department.id = employee.department_id
    where employee.organization_id = v_organization_id
      and employee.status = 'active'
      and (
        employee.id = v_employee_id
        or (
          v_full_access
          and (
            department.code in ('DX-CS', 'DX-SALES')
            or exists (
              select 1
              from customer_totals customer_total
              where customer_total.owner_employee_id = employee.id
            )
            or exists (
              select 1
              from quote_totals quote_total
              where quote_total.owner_employee_id = employee.id
            )
          )
        )
      )
  )
  select
    employee.id,
    employee.employee_no,
    employee.name,
    coalesce(department.name, '未分配部门'),
    coalesce(customer.all_customers, 0),
    coalesce(customer.active_customers, 0),
    coalesce(quote.current_quote_count, 0),
    coalesce(quote.current_sales, 0),
    coalesce(quote.current_cost, 0),
    coalesce(quote.current_profit, 0),
    coalesce(quote.previous_profit, 0),
    coalesce(quote.current_profit, 0) - coalesce(quote.previous_profit, 0),
    coalesce(quote.missing_cost_items, 0)
  from responsible_employees employee
  left join public.departments department
    on department.id = employee.department_id
  left join customer_totals customer
    on customer.owner_employee_id = employee.id
  left join quote_totals quote
    on quote.owner_employee_id = employee.id
  order by
    coalesce(quote.current_profit, 0) desc,
    employee.name;
end;
$function$;

revoke all on function public.hr_crm_contribution_summary(date) from public;
grant execute on function public.hr_crm_contribution_summary(date) to authenticated;

comment on function public.hr_crm_contribution_summary(date)
is '按 CRM 客户负责人和已接受报价测算月度销售、采购成本、预计毛利及环比增量；客服销售仅看本人，HR/财务/管理员/董事长可看团队。';

commit;
