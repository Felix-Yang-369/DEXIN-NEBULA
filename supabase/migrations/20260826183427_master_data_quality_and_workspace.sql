-- Master Data Quality Center and personal workspace preferences.

begin;

insert into public.access_permissions
  (code, module, resource, action, name, description, risk_level, sort_order)
values
  ('system.data_quality.view', 'system', 'data_quality', 'view', '查看数据质量', '查看主数据质量规则、问题和治理进度', 'sensitive', 50),
  ('system.data_quality.manage', 'system', 'data_quality', 'manage', '管理数据质量', '执行质量扫描并处置主数据问题', 'high', 60)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  risk_level = excluded.risk_level,
  sort_order = excluded.sort_order;

insert into public.access_role_permissions
  (role_id, permission_id, effect, data_scope, field_access)
select role.id, permission.id, 'allow', 'organization',
  case when role.source_role_code = 'chairman' then 'read' else 'full' end
from public.access_roles role
join public.access_permissions permission
  on permission.code in ('system.data_quality.view', 'system.data_quality.manage')
where role.source_role_code = 'admin'
   or (role.source_role_code = 'chairman' and permission.code = 'system.data_quality.view')
on conflict (role_id, permission_id) do nothing;

create table public.master_data_quality_issues (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  entity_type text not null check (entity_type in ('customer', 'supplier', 'product', 'employee')),
  entity_id uuid not null,
  entity_code text not null,
  entity_name text not null,
  rule_code text not null,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  title text not null,
  detail text not null,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  assigned_to_employee_id uuid references public.employees(id) on delete set null,
  first_detected_at timestamptz not null default now(),
  last_detected_at timestamptz not null default now(),
  last_scan_id uuid not null,
  resolved_at timestamptz,
  resolved_by_employee_id uuid references public.employees(id) on delete set null,
  resolution_note text,
  unique (organization_id, entity_type, entity_id, rule_code)
);

create table public.workspace_preferences (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  pinned_modules text[] not null default array['sales', 'inventory', 'approvals']::text[],
  hidden_widgets text[] not null default array[]::text[],
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  default_workspace text not null default 'dashboard' check (default_workspace in ('dashboard', 'sales', 'inventory', 'finance', 'oa')),
  updated_at timestamptz not null default now(),
  primary key (organization_id, employee_id),
  check (cardinality(pinned_modules) <= 8),
  check (cardinality(hidden_widgets) <= 12)
);

create index master_data_quality_issue_queue_idx
  on public.master_data_quality_issues (organization_id, status, severity, last_detected_at desc);
create index master_data_quality_entity_idx
  on public.master_data_quality_issues (organization_id, entity_type, entity_id);
create index master_data_quality_assignee_idx
  on public.master_data_quality_issues (assigned_to_employee_id, status, last_detected_at desc)
  where assigned_to_employee_id is not null;

alter table public.master_data_quality_issues enable row level security;
alter table public.workspace_preferences enable row level security;

create policy master_data_quality_issues_select_authorized
on public.master_data_quality_issues for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_access_permission('system.data_quality.view')
);

create policy workspace_preferences_select_own
on public.workspace_preferences for select to authenticated
using (
  organization_id = public.current_organization_id()
  and employee_id = public.current_employee_id()
);

revoke all on table public.master_data_quality_issues from public, anon, authenticated;
revoke all on table public.workspace_preferences from public, anon, authenticated;
grant select on table public.master_data_quality_issues to authenticated;
grant select on table public.workspace_preferences to authenticated;

create or replace function public.refresh_master_data_quality_issues()
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_scan uuid := gen_random_uuid();
  v_count integer;
begin
  if v_org is null or not public.has_access_permission('system.data_quality.manage') then
    raise exception '无权执行主数据质量扫描' using errcode = '42501';
  end if;

  insert into public.master_data_quality_issues
    (organization_id, entity_type, entity_id, entity_code, entity_name, rule_code, severity, title, detail, status, last_detected_at, last_scan_id, resolved_at, resolved_by_employee_id, resolution_note)
  select v_org, finding.entity_type, finding.entity_id, finding.entity_code, finding.entity_name,
    finding.rule_code, finding.severity, finding.title, finding.detail, 'open', now(), v_scan, null, null, null
  from (
    select 'customer'::text entity_type, customer.id entity_id, customer.customer_no entity_code,
      customer.name entity_name, 'customer.owner_missing'::text rule_code, 'critical'::text severity,
      '客户缺少负责人'::text title, '潜客或有效客户必须指定负责人'::text detail
    from public.customers customer
    where customer.organization_id = v_org and customer.status in ('prospect', 'active') and customer.owner_employee_id is null
    union all
    select 'customer', customer.id, customer.customer_no, customer.name, 'customer.primary_contact_missing', 'warning',
      '客户缺少主联系人', '客户没有设置主联系人，销售跟进和履约通知可能中断'
    from public.customers customer
    where customer.organization_id = v_org and customer.status in ('prospect', 'active')
      and not exists (select 1 from public.customer_contacts contact where contact.customer_id = customer.id and contact.is_primary)
    union all
    select 'customer', customer.id, customer.customer_no, customer.name, 'customer.legal_entity_missing', 'critical',
      '客户缺少结算主体', '有效客户没有有效结算主体，无法形成规范订单和应收'
    from public.customers customer
    where customer.organization_id = v_org and customer.status = 'active'
      and not exists (select 1 from public.customer_legal_entities entity where entity.customer_id = customer.id and entity.status = 'active')
    union all
    select 'supplier', supplier.id, supplier.supplier_no, supplier.name, 'supplier.credit_code_missing', 'critical',
      '供应商缺少统一信用代码', '候选或合作中供应商必须补全统一社会信用代码'
    from public.suppliers supplier
    where supplier.organization_id = v_org and supplier.cooperation_status in ('candidate', 'active')
      and nullif(btrim(supplier.unified_credit_code), '') is null
    union all
    select 'supplier', supplier.id, supplier.supplier_no, supplier.name, 'supplier.qualification_expired', 'critical',
      '供应商资质缺失或过期', '合作中供应商没有当前有效资质，请立即复核'
    from public.suppliers supplier
    where supplier.organization_id = v_org and supplier.cooperation_status = 'active'
      and not exists (
        select 1 from public.supplier_qualifications qualification
        where qualification.supplier_id = supplier.id and qualification.status = 'active'
          and (qualification.expires_on is null or qualification.expires_on >= current_date)
      )
    union all
    select 'product', product.id, product.code, product.name, 'product.image_missing', 'warning',
      '商品缺少主图', '有效商品没有主图，影响检索、报价和客户展示'
    from public.products product
    where product.organization_id = v_org and product.status = 'active' and nullif(btrim(product.image_path), '') is null
    union all
    select 'product', product.id, product.code, product.name, 'product.barcode_missing', 'warning',
      '商品缺少条码', '有效商品没有条码，影响仓库扫码作业'
    from public.products product
    where product.organization_id = v_org and product.status = 'active' and nullif(btrim(product.barcode), '') is null
    union all
    select 'product', product.id, product.code, product.name, 'product.price_missing', 'critical',
      '商品缺少有效价格', '有效商品没有任何生效价格，无法进入销售或采购流程'
    from public.products product
    where product.organization_id = v_org and product.status = 'active'
      and not exists (select 1 from public.product_prices price where price.product_id = product.id and price.status = 'active')
    union all
    select 'employee', employee.id, employee.employee_no, employee.name, 'employee.department_missing', 'critical',
      '员工缺少所属部门', '在职员工必须归属一个有效部门'
    from public.employees employee
    where employee.organization_id = v_org and employee.status = 'active' and employee.department_id is null
    union all
    select 'employee', employee.id, employee.employee_no, employee.name, 'employee.account_missing', 'warning',
      '员工尚未绑定账号', '在职员工没有登录账号，无法使用个人工作台和流程待办'
    from public.employees employee
    where employee.organization_id = v_org and employee.status = 'active' and employee.auth_user_id is null
  ) finding
  on conflict (organization_id, entity_type, entity_id, rule_code) do update set
    entity_code = excluded.entity_code,
    entity_name = excluded.entity_name,
    severity = excluded.severity,
    title = excluded.title,
    detail = excluded.detail,
    status = case when master_data_quality_issues.status = 'ignored' then 'ignored' else 'open' end,
    last_detected_at = now(),
    last_scan_id = v_scan,
    resolved_at = null,
    resolved_by_employee_id = null,
    resolution_note = case when master_data_quality_issues.status = 'ignored' then master_data_quality_issues.resolution_note else null end;

  update public.master_data_quality_issues
  set status = 'resolved', resolved_at = now(), resolution_note = coalesce(resolution_note, '后续扫描已确认问题消失')
  where organization_id = v_org and status = 'open' and last_scan_id <> v_scan;

  select count(*)::integer into v_count
  from public.master_data_quality_issues
  where organization_id = v_org and status = 'open';
  return v_count;
end;
$function$;

create or replace function public.update_master_data_quality_issue(
  p_issue_id uuid,
  p_status text,
  p_assigned_to_employee_id uuid default null,
  p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_actor uuid := public.current_employee_id();
begin
  if v_org is null or not public.has_access_permission('system.data_quality.manage') then
    raise exception '无权处置数据质量问题' using errcode = '42501';
  end if;
  if p_status not in ('open', 'resolved', 'ignored') then
    raise exception '无效的问题状态' using errcode = '22023';
  end if;
  if p_assigned_to_employee_id is not null and not exists (
    select 1 from public.employees where id = p_assigned_to_employee_id and organization_id = v_org and status = 'active'
  ) then
    raise exception '负责人不属于当前组织' using errcode = '22023';
  end if;
  update public.master_data_quality_issues
  set status = p_status,
      assigned_to_employee_id = p_assigned_to_employee_id,
      resolution_note = nullif(btrim(p_resolution_note), ''),
      resolved_at = case when p_status in ('resolved', 'ignored') then now() else null end,
      resolved_by_employee_id = case when p_status in ('resolved', 'ignored') then v_actor else null end
  where id = p_issue_id and organization_id = v_org;
  if not found then raise exception '问题不存在' using errcode = 'P0002'; end if;
end;
$function$;

create or replace function public.save_workspace_preferences(
  p_pinned_modules text[],
  p_hidden_widgets text[],
  p_density text,
  p_default_workspace text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_employee uuid := public.current_employee_id();
  v_allowed_modules constant text[] := array['sales','inventory','approvals','customers','products','finance','oa','system'];
  v_allowed_widgets constant text[] := array['health','kpis','sales_trend','business_source','products','inventory','todos','quick_actions'];
begin
  if v_org is null or v_employee is null then raise exception '登录状态已失效' using errcode = '42501'; end if;
  if cardinality(p_pinned_modules) > 8 or p_pinned_modules && array(select unnest(p_pinned_modules) except select unnest(v_allowed_modules)) then
    raise exception '工作台快捷入口无效' using errcode = '22023';
  end if;
  if cardinality(p_hidden_widgets) > 12 or p_hidden_widgets && array(select unnest(p_hidden_widgets) except select unnest(v_allowed_widgets)) then
    raise exception '工作台组件设置无效' using errcode = '22023';
  end if;
  if p_density not in ('comfortable','compact') or p_default_workspace not in ('dashboard','sales','inventory','finance','oa') then
    raise exception '工作台偏好无效' using errcode = '22023';
  end if;
  insert into public.workspace_preferences (organization_id, employee_id, pinned_modules, hidden_widgets, density, default_workspace, updated_at)
  values (v_org, v_employee, p_pinned_modules, p_hidden_widgets, p_density, p_default_workspace, now())
  on conflict (organization_id, employee_id) do update set
    pinned_modules = excluded.pinned_modules,
    hidden_widgets = excluded.hidden_widgets,
    density = excluded.density,
    default_workspace = excluded.default_workspace,
    updated_at = now();
end;
$function$;

revoke all on function public.refresh_master_data_quality_issues() from public, anon;
revoke all on function public.update_master_data_quality_issue(uuid, text, uuid, text) from public, anon;
revoke all on function public.save_workspace_preferences(text[], text[], text, text) from public, anon;
grant execute on function public.refresh_master_data_quality_issues() to authenticated;
grant execute on function public.update_master_data_quality_issue(uuid, text, uuid, text) to authenticated;
grant execute on function public.save_workspace_preferences(text[], text[], text, text) to authenticated;

commit;
