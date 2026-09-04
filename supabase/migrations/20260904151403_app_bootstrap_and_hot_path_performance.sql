-- Consolidate authenticated workspace bootstrap data and remove duplicated
-- permissive policies from the hottest application tables.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.current_app_bootstrap_impl()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_auth_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_auth_user_id is null then
    raise exception '登录状态已失效' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'employee', jsonb_build_object(
      'id', employee.id,
      'authUserId', employee.auth_user_id,
      'organizationId', employee.organization_id,
      'departmentId', employee.department_id,
      'departmentCode', department.code,
      'managerId', employee.manager_id,
      'employeeNo', employee.employee_no,
      'name', employee.name,
      'email', employee.email,
      'title', employee.title,
      'avatarPath', employee.avatar_path,
      'status', employee.status,
      'roleCodes', coalesce((
        select jsonb_agg(distinct role_code.code order by role_code.code)
        from (
          select role.code
          from public.employee_roles employee_role
          join public.roles role on role.id = employee_role.role_id
          where employee_role.employee_id = employee.id
          union
          select role.code
          from public.temporary_role_grants temporary_grant
          join public.roles role on role.id = temporary_grant.role_id
          where temporary_grant.employee_id = employee.id
            and temporary_grant.status = 'active'
            and temporary_grant.starts_at <= now()
            and temporary_grant.expires_at > now()
        ) role_code
      ), '[]'::jsonb),
      'accessPermissionCodes', coalesce((
        select jsonb_agg(permission.permission_code order by permission.permission_code)
        from public.effective_employee_permissions(employee.id) permission
        where permission.effect = 'allow'
      ), '[]'::jsonb)
    ),
    'workspace', jsonb_build_object(
      'sidebarMode', coalesce(preference.sidebar_mode, 'expanded'),
      'density', coalesce(preference.density, 'comfortable'),
      'defaultWorkspace', coalesce(preference.default_workspace, 'dashboard'),
      'pinnedModules', coalesce(to_jsonb(preference.pinned_modules), '[]'::jsonb),
      'hiddenWidgets', coalesce(to_jsonb(preference.hidden_widgets), '[]'::jsonb)
    ),
    'unreadCount', (
      select count(*)
      from public.notifications notification
      where notification.organization_id = employee.organization_id
        and notification.recipient_employee_id = employee.id
        and notification.read_at is null
    ),
    'pendingCount',
      (
        select count(*)
        from public.leave_requests request
        where request.organization_id = employee.organization_id
          and request.current_approver_employee_id = employee.id
          and request.status in (
            'pending_department',
            'pending_chairman',
            'pending_hr_filing'
          )
      )
      +
      (
        select count(*)
        from public.approval_requests request
        where request.organization_id = employee.organization_id
          and request.current_approver_employee_id = employee.id
          and request.status = 'pending'
      )
  )
  into v_result
  from public.employees employee
  left join public.departments department on department.id = employee.department_id
  left join public.workspace_preferences preference
    on preference.organization_id = employee.organization_id
   and preference.employee_id = employee.id
  where employee.auth_user_id = v_auth_user_id
    and employee.status = 'active'
  limit 1;

  if v_result is null then
    raise exception '账号未关联有效员工' using errcode = '42501';
  end if;

  return v_result;
end;
$function$;

revoke all on function private.current_app_bootstrap_impl() from public, anon, authenticated;

create or replace function public.current_app_bootstrap()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select private.current_app_bootstrap_impl()
$function$;

revoke all on function public.current_app_bootstrap() from public, anon;
grant execute on function public.current_app_bootstrap() to authenticated;

create index if not exists employees_org_status_name_idx
  on public.employees (organization_id, status, name);
create index if not exists customer_followups_org_created_idx
  on public.customer_followups (organization_id, created_at desc);

-- Existing unique/index definitions already cover products (organization_id,
-- code) and active inventory batches (organization_id, expiry_date).

drop policy if exists "customers visible to authorized crm users" on public.customers;
drop policy if exists "customers manageable by crm users" on public.customers;
create policy "customers visible to authorized crm users"
on public.customers for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.can_manage_customers())
    or (select public.has_org_role('chairman'))
  )
);
create policy "customers insert by crm users"
on public.customers for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
);
create policy "customers update by crm users"
on public.customers for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
);
create policy "customers delete by crm users"
on public.customers for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
);

drop policy if exists "contacts visible to authorized crm users" on public.customer_contacts;
drop policy if exists "contacts manageable by crm users" on public.customer_contacts;
create policy "contacts visible to authorized crm users"
on public.customer_contacts for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (
    (select public.can_manage_customers())
    or (select public.has_org_role('chairman'))
  )
);
create policy "contacts insert by crm users"
on public.customer_contacts for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
);
create policy "contacts update by crm users"
on public.customer_contacts for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
);
create policy "contacts delete by crm users"
on public.customer_contacts for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_customers())
);

drop policy if exists "products visible to active employees" on public.products;
drop policy if exists "products manageable by procurement" on public.products;
create policy "products visible to active employees"
on public.products for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.current_employee_id()) is not null
);
create policy "products insert by procurement"
on public.products for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
);
create policy "products update by procurement"
on public.products for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
);
create policy "products delete by procurement"
on public.products for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
);

drop policy if exists "product prices visible by type" on public.product_prices;
drop policy if exists "product prices manageable by procurement" on public.product_prices;
create policy "product prices visible by type"
on public.product_prices for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.current_employee_id()) is not null
  and (
    price_type = 'retail'
    or (
      price_type in ('group', 'dropship')
      and (select public.can_view_channel_prices())
    )
    or (
      price_type = 'procurement'
      and (select public.can_view_procurement_prices())
    )
  )
);
create policy "product prices insert by procurement"
on public.product_prices for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
);
create policy "product prices update by procurement"
on public.product_prices for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
);
create policy "product prices delete by procurement"
on public.product_prices for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_products())
);

drop policy if exists "warehouses visible to active employees" on public.warehouses;
drop policy if exists "warehouses manageable by inventory operators" on public.warehouses;
create policy "warehouses visible to active employees"
on public.warehouses for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.current_employee_id()) is not null
);
create policy "warehouses insert by inventory operators"
on public.warehouses for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "warehouses update by inventory operators"
on public.warehouses for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "warehouses delete by inventory operators"
on public.warehouses for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);

drop policy if exists "inventory visible to active employees" on public.inventory_items;
drop policy if exists "inventory manageable by inventory operators" on public.inventory_items;
create policy "inventory visible to active employees"
on public.inventory_items for select to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.current_employee_id()) is not null
);
create policy "inventory insert by inventory operators"
on public.inventory_items for insert to authenticated
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "inventory update by inventory operators"
on public.inventory_items for update to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
)
with check (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);
create policy "inventory delete by inventory operators"
on public.inventory_items for delete to authenticated
using (
  organization_id = (select public.current_organization_id())
  and (select public.can_manage_inventory())
);

commit;
