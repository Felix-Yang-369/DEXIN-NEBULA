-- Remote smoke test for generic approvals, notifications and audit logs.
-- This script must run in one transaction and always rolls back.

begin;

create temporary table smoke_test_context (
  request_id uuid,
  employee_auth_id uuid,
  manager_auth_id uuid,
  finance_auth_id uuid
) on commit drop;

do $$
declare
  v_employee public.employees%rowtype;
  v_manager public.employees%rowtype;
  v_finance public.employees%rowtype;
  v_finance_role_id uuid;
  v_request_id uuid;
  v_request public.approval_requests%rowtype;
  v_notification_count integer;
  v_audit_count integer;
begin
  select *
  into v_employee
  from public.employees
  where email = 'employee.dev@dxmstech.cn'
    and status = 'active';

  select *
  into v_manager
  from public.employees
  where id = v_employee.manager_id
    and email = 'manager.dev@dxmstech.cn'
    and status = 'active';

  select *
  into v_finance
  from public.employees
  where email = 'yanglinjie@dxmstech.cn'
    and status = 'active';

  if v_employee.auth_user_id is null
    or v_manager.auth_user_id is null
    or v_finance.auth_user_id is null
  then
    raise exception 'Smoke test accounts are not linked';
  end if;

  select id
  into v_finance_role_id
  from public.roles
  where organization_id = v_employee.organization_id
    and code = 'finance';

  -- Use one linked account as the finance node only inside this transaction.
  delete from public.employee_roles
  where role_id = v_finance_role_id;

  insert into public.employee_roles (employee_id, role_id)
  values (v_finance.id, v_finance_role_id);

  perform set_config(
    'request.jwt.claim.sub',
    v_employee.auth_user_id::text,
    true
  );

  v_request_id := public.submit_expense_claim(
    'transport',
    current_date,
    88.50,
    '事务内测试商户',
    '验证通用审批、通知和审计的事务内测试',
    true,
    1
  );

  select *
  into v_request
  from public.approval_requests
  where id = v_request_id;

  if v_request.current_approver_employee_id <> v_manager.id
    or v_request.current_step_order <> 1
  then
    raise exception 'Expense was not assigned to the manager';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_manager.auth_user_id::text,
    true
  );

  perform public.process_approval_request(
    v_request_id,
    'approve',
    '负责人事务内验收通过',
    v_request.version
  );

  select *
  into v_request
  from public.approval_requests
  where id = v_request_id;

  if v_request.current_approver_employee_id <> v_finance.id
    or v_request.current_step_order <> 2
  then
    raise exception 'Expense was not assigned to finance';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_finance.auth_user_id::text,
    true
  );

  perform public.process_approval_request(
    v_request_id,
    'approve',
    '财务事务内验收通过',
    v_request.version
  );

  select *
  into v_request
  from public.approval_requests
  where id = v_request_id;

  if v_request.status <> 'approved'
    or v_request.current_approver_employee_id is not null
  then
    raise exception 'Expense did not reach approved status';
  end if;

  select count(*)
  into v_notification_count
  from public.notifications
  where entity_type = 'approval_request'
    and entity_id = v_request_id;

  select count(*)
  into v_audit_count
  from public.audit_logs
  where entity_type = 'approval_request'
    and entity_id = v_request_id;

  if v_notification_count <> 3 then
    raise exception 'Expected 3 notifications, got %', v_notification_count;
  end if;

  if v_audit_count <> 3 then
    raise exception 'Expected 3 audit records, got %', v_audit_count;
  end if;

  insert into smoke_test_context (
    request_id,
    employee_auth_id,
    manager_auth_id,
    finance_auth_id
  )
  values (
    v_request_id,
    v_employee.auth_user_id,
    v_manager.auth_user_id,
    v_finance.auth_user_id
  );
end;
$$;

select
  request_id,
  (
    select status
    from public.approval_requests
    where id = smoke_test_context.request_id
  ) as final_status,
  (
    select count(*)
    from public.notifications
    where entity_id = smoke_test_context.request_id
  ) as notification_count,
  (
    select count(*)
    from public.audit_logs
    where entity_id = smoke_test_context.request_id
  ) as audit_count
from smoke_test_context;

rollback;
