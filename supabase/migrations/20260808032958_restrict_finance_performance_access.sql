begin;

-- A finance operator may use performance results as an upstream payroll input
-- only after a dedicated payroll data flow exists. The generic finance role must
-- not expose every employee's performance plan or metric.
drop policy if exists employee_performance_plans_select_authorized
on public.employee_performance_plans;

create policy employee_performance_plans_select_authorized
on public.employee_performance_plans for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    employee_id = public.current_employee_id()
    or public.has_org_role('hr')
    or public.has_org_role('chairman')
  )
);

drop policy if exists employee_performance_metrics_select_authorized
on public.employee_performance_metrics;

create policy employee_performance_metrics_select_authorized
on public.employee_performance_metrics for select to authenticated
using (
  organization_id = public.current_organization_id()
  and exists (
    select 1
    from public.employee_performance_plans plan
    where plan.id = employee_performance_metrics.plan_id
      and (
        plan.employee_id = public.current_employee_id()
        or public.has_org_role('hr')
        or public.has_org_role('chairman')
      )
  )
);

commit;
