begin;

create table if not exists public.employee_performance_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  plan_name text not null,
  base_salary_cny numeric(14, 2)
    check (base_salary_cny is null or base_salary_cny >= 0),
  revenue_commission_rate numeric(12, 8) not null default 0
    check (revenue_commission_rate >= 0 and revenue_commission_rate <= 1),
  effective_from date not null,
  effective_until date,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (effective_until is null or effective_until >= effective_from),
  unique (organization_id, employee_id, effective_from)
);

create table if not exists public.employee_performance_metrics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  plan_id uuid not null references public.employee_performance_plans(id) on delete cascade,
  metric_code text not null
    check (metric_code in (
      'crm_sales_increment',
      'crm_profit_increment',
      'monthly_operating_revenue',
      'manual'
    )),
  metric_name text not null,
  unit text not null default '元',
  weight_percent numeric(6, 2)
    check (weight_percent is null or (weight_percent >= 0 and weight_percent <= 100)),
  target_value numeric(16, 2),
  formula_note text,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, metric_code)
);

create index if not exists employee_performance_plans_employee_period_idx
  on public.employee_performance_plans (
    organization_id,
    employee_id,
    status,
    effective_from desc
  );

create index if not exists employee_performance_metrics_plan_idx
  on public.employee_performance_metrics (plan_id, enabled, sort_order);

drop trigger if exists employee_performance_plans_set_updated_at
  on public.employee_performance_plans;
create trigger employee_performance_plans_set_updated_at
before update on public.employee_performance_plans
for each row execute function public.set_updated_at();

drop trigger if exists employee_performance_metrics_set_updated_at
  on public.employee_performance_metrics;
create trigger employee_performance_metrics_set_updated_at
before update on public.employee_performance_metrics
for each row execute function public.set_updated_at();

alter table public.employee_performance_plans enable row level security;
alter table public.employee_performance_metrics enable row level security;

drop policy if exists employee_performance_plans_select_authorized
  on public.employee_performance_plans;
create policy employee_performance_plans_select_authorized
on public.employee_performance_plans
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    employee_id = (select public.current_employee_id())
    or (select public.has_org_role('hr'))
    or (select public.has_org_role('finance'))
    or (select public.has_org_role('admin'))
    or (select public.has_org_role('chairman'))
  )
);

drop policy if exists employee_performance_metrics_select_authorized
  on public.employee_performance_metrics;
create policy employee_performance_metrics_select_authorized
on public.employee_performance_metrics
for select
to authenticated
using (
  organization_id = (select public.current_organization_id())
  and exists (
    select 1
    from public.employee_performance_plans plan
    where plan.id = employee_performance_metrics.plan_id
      and (
        plan.employee_id = (select public.current_employee_id())
        or (select public.has_org_role('hr'))
        or (select public.has_org_role('finance'))
        or (select public.has_org_role('admin'))
        or (select public.has_org_role('chairman'))
      )
  )
);

revoke all on table public.employee_performance_plans from anon, authenticated;
revoke all on table public.employee_performance_metrics from anon, authenticated;
grant select on table public.employee_performance_plans to authenticated;
grant select on table public.employee_performance_metrics to authenticated;

create or replace function public.save_employee_performance_plan(
  p_employee_id uuid,
  p_plan_name text,
  p_base_salary_cny numeric,
  p_revenue_commission_rate numeric,
  p_effective_from date,
  p_metrics jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor_id uuid := public.current_employee_id();
  v_organization_id uuid := public.current_organization_id();
  v_plan_id uuid;
  v_metric jsonb;
  v_metric_code text;
begin
  if v_actor_id is null or v_organization_id is null then
    raise exception '当前账号不是有效的在职员工'
      using errcode = '42501';
  end if;

  if not (
    public.has_org_role('hr')
    or public.has_org_role('admin')
    or public.has_org_role('chairman')
  ) then
    raise exception '只有人事、管理员或董事长可以配置绩效方案'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.employees employee
    where employee.id = p_employee_id
      and employee.organization_id = v_organization_id
      and employee.status = 'active'
  ) then
    raise exception '员工不存在或已停用'
      using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_plan_name, '')), '') is null
    or char_length(btrim(p_plan_name)) > 80
    or p_effective_from is null
    or (
      p_base_salary_cny is not null
      and (p_base_salary_cny < 0 or p_base_salary_cny > 1000000)
    )
    or p_revenue_commission_rate is null
    or p_revenue_commission_rate < 0
    or p_revenue_commission_rate > 1
    or jsonb_typeof(p_metrics) <> 'array'
    or jsonb_array_length(p_metrics) > 10
  then
    raise exception '绩效方案参数无效'
      using errcode = '22023';
  end if;

  insert into public.employee_performance_plans (
    organization_id,
    employee_id,
    plan_name,
    base_salary_cny,
    revenue_commission_rate,
    effective_from,
    status,
    created_by_employee_id
  )
  values (
    v_organization_id,
    p_employee_id,
    btrim(p_plan_name),
    p_base_salary_cny,
    p_revenue_commission_rate,
    p_effective_from,
    'active',
    v_actor_id
  )
  on conflict (organization_id, employee_id, effective_from)
  do update set
    plan_name = excluded.plan_name,
    base_salary_cny = excluded.base_salary_cny,
    revenue_commission_rate = excluded.revenue_commission_rate,
    status = 'active'
  returning id into v_plan_id;

  delete from public.employee_performance_metrics
  where plan_id = v_plan_id;

  for v_metric in
    select value from jsonb_array_elements(p_metrics)
  loop
    v_metric_code := v_metric ->> 'code';
    if v_metric_code not in (
      'crm_sales_increment',
      'crm_profit_increment',
      'monthly_operating_revenue',
      'manual'
    ) then
      raise exception '绩效指标类型无效'
        using errcode = '22023';
    end if;

    insert into public.employee_performance_metrics (
      organization_id,
      plan_id,
      metric_code,
      metric_name,
      unit,
      weight_percent,
      target_value,
      formula_note,
      sort_order
    )
    values (
      v_organization_id,
      v_plan_id,
      v_metric_code,
      left(coalesce(nullif(btrim(v_metric ->> 'name'), ''), v_metric_code), 80),
      left(coalesce(nullif(btrim(v_metric ->> 'unit'), ''), '元'), 20),
      case
        when nullif(v_metric ->> 'weightPercent', '') is null then null
        else (v_metric ->> 'weightPercent')::numeric
      end,
      case
        when nullif(v_metric ->> 'targetValue', '') is null then null
        else (v_metric ->> 'targetValue')::numeric
      end,
      left(coalesce(v_metric ->> 'formulaNote', ''), 300),
      coalesce((v_metric ->> 'sortOrder')::integer, 0)
    );
  end loop;

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
    v_organization_id,
    v_actor_id,
    'performance_plan_saved',
    'employee_performance_plan',
    v_plan_id,
    '保存员工绩效方案',
    jsonb_build_object(
      'employee_id', p_employee_id,
      'effective_from', p_effective_from,
      'metric_count', jsonb_array_length(p_metrics)
    )
  );

  return v_plan_id;
end;
$function$;

revoke all on function public.save_employee_performance_plan(
  uuid,
  text,
  numeric,
  numeric,
  date,
  jsonb
) from public;
grant execute on function public.save_employee_performance_plan(
  uuid,
  text,
  numeric,
  numeric,
  date,
  jsonb
) to authenticated;

create or replace function public.hr_performance_monthly_summary(
  p_month date
)
returns table (
  employee_id uuid,
  employee_no text,
  employee_name text,
  department_name text,
  plan_id uuid,
  plan_name text,
  base_salary_cny numeric,
  revenue_commission_rate numeric,
  monthly_operating_revenue numeric,
  crm_sales_current numeric,
  crm_sales_previous numeric,
  crm_sales_increment numeric,
  crm_profit_current numeric,
  crm_profit_previous numeric,
  crm_profit_increment numeric,
  estimated_variable_pay numeric,
  estimated_total_compensation numeric,
  metrics jsonb
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
    or public.has_org_role('finance')
    or public.has_org_role('admin')
    or public.has_org_role('chairman');

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
      coalesce(customer.owner_employee_id, quote.owner_employee_id) as owner_employee_id,
      accepted.accepted_at,
      quote.total_cny::numeric as sales_amount,
      coalesce(sum(
        item.quantity * coalesce(procurement.amount_cny, 0)
      ), 0)::numeric as estimated_cost
    from public.sales_quotes quote
    join accepted_events accepted
      on accepted.quote_id = quote.id
    join public.customers customer
      on customer.id = quote.customer_id
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
      customer.owner_employee_id,
      quote.owner_employee_id,
      accepted.accepted_at,
      quote.total_cny
  ),
  crm_totals as (
    select
      financial.owner_employee_id,
      coalesce(sum(financial.sales_amount) filter (
        where financial.accepted_at >= v_month_start
          and financial.accepted_at < v_month_end
      ), 0)::numeric as current_sales,
      coalesce(sum(financial.sales_amount) filter (
        where financial.accepted_at >= v_previous_start
          and financial.accepted_at < v_month_start
      ), 0)::numeric as previous_sales,
      coalesce(sum(financial.sales_amount - financial.estimated_cost) filter (
        where financial.accepted_at >= v_month_start
          and financial.accepted_at < v_month_end
      ), 0)::numeric as current_profit,
      coalesce(sum(financial.sales_amount - financial.estimated_cost) filter (
        where financial.accepted_at >= v_previous_start
          and financial.accepted_at < v_month_start
      ), 0)::numeric as previous_profit
    from quote_financials financial
    group by financial.owner_employee_id
  ),
  organization_revenue as (
    select coalesce(sum(transaction.amount), 0)::numeric as amount
    from public.finance_transactions transaction
    where transaction.organization_id = v_organization_id
      and transaction.transaction_type = 'income'
      and transaction.status = 'confirmed'
      and transaction.occurred_on >= v_month_start
      and transaction.occurred_on < v_month_end
  ),
  employee_rows as (
    select
      employee.id,
      employee.employee_no,
      employee.name,
      coalesce(department.name, '未分配部门') as department_name,
      plan.id as plan_id,
      plan.plan_name,
      plan.base_salary_cny,
      coalesce(plan.revenue_commission_rate, 0)::numeric as commission_rate,
      case
        when v_full_access or exists (
          select 1
          from public.employee_performance_metrics revenue_metric
          where revenue_metric.plan_id = plan.id
            and revenue_metric.metric_code = 'monthly_operating_revenue'
            and revenue_metric.enabled
        ) then revenue.amount
        else 0
      end as operating_revenue,
      coalesce(crm.current_sales, 0)::numeric as current_sales,
      coalesce(crm.previous_sales, 0)::numeric as previous_sales,
      coalesce(crm.current_profit, 0)::numeric as current_profit,
      coalesce(crm.previous_profit, 0)::numeric as previous_profit
    from public.employees employee
    left join public.departments department
      on department.id = employee.department_id
    left join lateral (
      select performance_plan.*
      from public.employee_performance_plans performance_plan
      where performance_plan.organization_id = v_organization_id
        and performance_plan.employee_id = employee.id
        and performance_plan.status = 'active'
        and performance_plan.effective_from < v_month_end
        and (
          performance_plan.effective_until is null
          or performance_plan.effective_until >= v_month_start
        )
      order by performance_plan.effective_from desc
      limit 1
    ) plan on true
    left join crm_totals crm
      on crm.owner_employee_id = employee.id
    cross join organization_revenue revenue
    where employee.organization_id = v_organization_id
      and employee.status = 'active'
      and (v_full_access or employee.id = v_employee_id)
  )
  select
    employee.id,
    employee.employee_no,
    employee.name,
    employee.department_name,
    employee.plan_id,
    employee.plan_name,
    employee.base_salary_cny,
    employee.commission_rate,
    employee.operating_revenue,
    employee.current_sales,
    employee.previous_sales,
    employee.current_sales - employee.previous_sales,
    employee.current_profit,
    employee.previous_profit,
    employee.current_profit - employee.previous_profit,
    round(employee.operating_revenue * employee.commission_rate, 2),
    case
      when employee.base_salary_cny is null then null
      else round(
        employee.base_salary_cny
        + employee.operating_revenue * employee.commission_rate,
        2
      )
    end,
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'code', metric.metric_code,
          'name', metric.metric_name,
          'unit', metric.unit,
          'weightPercent', metric.weight_percent,
          'targetValue', metric.target_value,
          'formulaNote', metric.formula_note,
          'value', case metric.metric_code
            when 'crm_sales_increment' then employee.current_sales - employee.previous_sales
            when 'crm_profit_increment' then employee.current_profit - employee.previous_profit
            when 'monthly_operating_revenue' then employee.operating_revenue
            else null
          end
        )
        order by metric.sort_order, metric.metric_name
      )
      from public.employee_performance_metrics metric
      where metric.plan_id = employee.plan_id
        and metric.enabled
    ), '[]'::jsonb)
  from employee_rows employee
  order by
    case when employee.plan_id is null then 1 else 0 end,
    employee.department_name,
    employee.name;
end;
$function$;

revoke all on function public.hr_performance_monthly_summary(date) from public;
grant execute on function public.hr_performance_monthly_summary(date) to authenticated;

do $seed$
declare
  v_organization_id uuid;
  v_creator_id uuid;
  v_employee public.employees%rowtype;
  v_plan_id uuid;
begin
  select organization.id
  into v_organization_id
  from public.organizations organization
  where organization.name = '德馨淼盛'
  order by organization.created_at
  limit 1;

  select employee.id
  into v_creator_id
  from public.employees employee
  left join public.employee_roles employee_role
    on employee_role.employee_id = employee.id
  left join public.roles role
    on role.id = employee_role.role_id
  where employee.organization_id = v_organization_id
    and employee.status = 'active'
    and role.code in ('chairman', 'admin', 'hr')
  order by
    case role.code when 'chairman' then 0 when 'admin' then 1 else 2 end,
    employee.created_at
  limit 1;

  if v_organization_id is null or v_creator_id is null then
    return;
  end if;

  for v_employee in
    select employee.*
    from public.employees employee
    join public.departments department
      on department.id = employee.department_id
    where employee.organization_id = v_organization_id
      and employee.status = 'active'
      and department.code = 'DX-CS'
  loop
    insert into public.employee_performance_plans (
      organization_id,
      employee_id,
      plan_name,
      base_salary_cny,
      revenue_commission_rate,
      effective_from,
      status,
      created_by_employee_id
    )
    values (
      v_organization_id,
      v_employee.id,
      '客服客户经营绩效',
      null,
      0,
      date '2026-07-01',
      'active',
      v_creator_id
    )
    on conflict (organization_id, employee_id, effective_from)
    do update set
      plan_name = excluded.plan_name,
      status = 'active'
    returning id into v_plan_id;

    insert into public.employee_performance_metrics (
      organization_id,
      plan_id,
      metric_code,
      metric_name,
      unit,
      formula_note,
      sort_order
    )
    values
      (
        v_organization_id,
        v_plan_id,
        'crm_sales_increment',
        '负责客户销售增量',
        '元',
        '本月负责客户已接受报价额－上月负责客户已接受报价额',
        10
      ),
      (
        v_organization_id,
        v_plan_id,
        'crm_profit_increment',
        '负责客户预计利润增量',
        '元',
        '本月负责客户报价预计毛利－上月预计毛利',
        20
      )
    on conflict (plan_id, metric_code) do update set
      metric_name = excluded.metric_name,
      formula_note = excluded.formula_note,
      enabled = true;
  end loop;

  select employee.*
  into v_employee
  from public.employees employee
  where employee.organization_id = v_organization_id
    and employee.name = '刘春荣'
    and employee.status = 'active'
  limit 1;

  if v_employee.id is not null then
    insert into public.employee_performance_plans (
      organization_id,
      employee_id,
      plan_name,
      base_salary_cny,
      revenue_commission_rate,
      effective_from,
      status,
      created_by_employee_id
    )
    values (
      v_organization_id,
      v_employee.id,
      '财务主管月度薪酬绩效',
      5000,
      0.0001,
      date '2026-07-01',
      'active',
      v_creator_id
    )
    on conflict (organization_id, employee_id, effective_from)
    do update set
      plan_name = excluded.plan_name,
      base_salary_cny = excluded.base_salary_cny,
      revenue_commission_rate = excluded.revenue_commission_rate,
      status = 'active'
    returning id into v_plan_id;

    insert into public.employee_performance_metrics (
      organization_id,
      plan_id,
      metric_code,
      metric_name,
      unit,
      formula_note,
      sort_order
    )
    values (
      v_organization_id,
      v_plan_id,
      'monthly_operating_revenue',
      '公司月度营业收入',
      '元',
      '当前暂按财务中心当月已确认收入流水汇总；提成=月度营业收入×0.0001',
      10
    )
    on conflict (plan_id, metric_code) do update set
      metric_name = excluded.metric_name,
      formula_note = excluded.formula_note,
      enabled = true;
  end if;
end;
$seed$;

comment on table public.employee_performance_plans is
'员工个人绩效与薪酬测算方案；工资信息属于敏感数据。';
comment on table public.employee_performance_metrics is
'绩效方案的个性化指标、目标、权重和计算说明。';
comment on function public.hr_performance_monthly_summary(date) is
'按员工个人方案返回月度 CRM 增量、营业收入和薪酬测算；本人及授权管理角色可见。';

commit;
