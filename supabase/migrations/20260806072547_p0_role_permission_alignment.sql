begin;

-- P0 permission boundary: system administrators configure the platform but do
-- not implicitly receive sensitive business-data access. Business access is
-- granted through an explicit functional role or department membership.

create or replace function public.can_manage_customers()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.auth_user_id = (select auth.uid())
      and employee.status = 'active'
      and department.code in ('DX-SALES', 'DX-CS')
  )
$function$;

create or replace function public.can_manage_products()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.auth_user_id = (select auth.uid())
      and employee.status = 'active'
      and department.code = 'DX-PROC'
  )
$function$;

create or replace function public.can_view_channel_prices()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.auth_user_id = (select auth.uid())
      and employee.status = 'active'
      and (
        department.code in ('DX-SALES', 'DX-CS', 'DX-PROC', 'DX-FIN')
        or public.has_org_role('chairman')
      )
  )
$function$;

create or replace function public.can_view_procurement_prices()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.auth_user_id = (select auth.uid())
      and employee.status = 'active'
      and (
        department.code in ('DX-PROC', 'DX-FIN')
        or public.has_org_role('chairman')
      )
  )
$function$;

create or replace function public.can_manage_inventory()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.auth_user_id = (select auth.uid())
      and employee.status = 'active'
      and department.code = 'DX-WH'
  )
$function$;

create or replace function public.can_manage_suppliers()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.id = public.current_employee_id()
      and employee.status = 'active'
      and department.code = 'DX-PROC'
  )
$function$;

create or replace function public.can_manage_hr()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select public.current_employee_id() is not null
    and public.has_org_role('hr')
$function$;

create or replace function public.can_view_sales_quote(p_quote_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.sales_quotes quote
    where quote.id = p_quote_id
      and quote.organization_id = public.current_organization_id()
      and (
        quote.owner_employee_id = public.current_employee_id()
        or public.can_manage_customers()
        or public.has_org_role('chairman')
        or public.has_org_role('finance')
      )
  )
$function$;

create or replace function public.can_view_sales_order(p_order_id uuid)
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.sales_orders sales_order
    where sales_order.id = p_order_id
      and sales_order.organization_id = public.current_organization_id()
      and (
        sales_order.owner_employee_id = public.current_employee_id()
        or public.can_manage_customers()
        or public.has_org_role('chairman')
        or public.has_org_role('finance')
      )
  )
$function$;

create or replace function public.can_view_procurement_operations()
returns boolean language sql stable security definer
set search_path = public, pg_temp as $function$
  select exists (
    select 1 from public.employees employee
    left join public.departments department on department.id = employee.department_id
    where employee.id = public.current_employee_id()
      and employee.status = 'active'
      and (
        department.code in ('DX-PROC', 'DX-FIN')
        or public.has_org_role('chairman')
        or public.has_org_role('finance')
      )
  )
$function$;

drop policy if exists sales_opportunities_select_authorized on public.sales_opportunities;
create policy sales_opportunities_select_authorized
on public.sales_opportunities for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    owner_employee_id = public.current_employee_id()
    or public.can_manage_customers()
    or public.has_org_role('chairman')
    or public.has_org_role('finance')
  )
);

drop policy if exists sales_order_profitability_select_sensitive on public.sales_order_profitability;
create policy sales_order_profitability_select_sensitive
on public.sales_order_profitability for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_org_role('finance')
    or public.has_org_role('chairman')
  )
);

drop policy if exists finance_invoices_finance_read on public.finance_invoices;
create policy finance_invoices_finance_read
on public.finance_invoices for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    public.has_org_role('finance')
    or public.has_org_role('chairman')
  )
);

drop policy if exists employee_performance_plans_select_authorized on public.employee_performance_plans;
create policy employee_performance_plans_select_authorized
on public.employee_performance_plans for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    employee_id = public.current_employee_id()
    or public.has_org_role('hr')
    or public.has_org_role('finance')
    or public.has_org_role('chairman')
  )
);

drop policy if exists employee_performance_metrics_select_authorized on public.employee_performance_metrics;
create policy employee_performance_metrics_select_authorized
on public.employee_performance_metrics for select to authenticated
using (
  organization_id = public.current_organization_id()
  and exists (
    select 1 from public.employee_performance_plans plan
    where plan.id = employee_performance_metrics.plan_id
      and (
        plan.employee_id = public.current_employee_id()
        or public.has_org_role('hr')
        or public.has_org_role('finance')
        or public.has_org_role('chairman')
      )
  )
);

create or replace function public.create_finance_invoice(
  p_direction text,p_invoice_type text,p_finance_document_id uuid,p_counterparty_name text,
  p_invoice_code text,p_invoice_no text,p_issued_on date,p_amount_excluding_tax numeric,p_tax_amount numeric,p_note text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_actor public.employees%rowtype; v_doc public.finance_documents%rowtype; v_id uuid; v_record_no text;
  v_customer uuid; v_entity uuid; v_supplier uuid; v_name text;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.has_org_role('finance')
    then raise exception '只有财务可以登记发票' using errcode='42501'; end if;
  if p_direction not in ('issued','received') or p_invoice_type not in ('vat_general','vat_special','electronic','other')
    or char_length(btrim(coalesce(p_invoice_no,'')))<3 or p_issued_on is null
    or p_amount_excluding_tax<0 or p_tax_amount<0 or p_amount_excluding_tax+p_tax_amount<=0
    then raise exception '发票参数无效' using errcode='22023'; end if;
  if p_finance_document_id is not null then
    select * into v_doc from public.finance_documents where id=p_finance_document_id and organization_id=v_actor.organization_id;
    if v_doc.id is null or (p_direction='issued' and v_doc.document_type<>'receivable')
      or (p_direction='received' and v_doc.document_type<>'payable')
      then raise exception '发票与应收应付单据不匹配' using errcode='23514'; end if;
    v_customer:=v_doc.customer_id; v_entity:=v_doc.legal_entity_id; v_supplier:=v_doc.supplier_id; v_name:=v_doc.counterparty_name;
  else
    v_name:=btrim(coalesce(p_counterparty_name,''));
  end if;
  if char_length(coalesce(v_name,''))<2 then raise exception '请填写发票往来单位' using errcode='22023'; end if;
  v_record_no:='DXINV-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.finance_invoices(
    organization_id,invoice_record_no,direction,invoice_type,finance_document_id,customer_id,legal_entity_id,supplier_id,
    counterparty_name,invoice_code,invoice_no,issued_on,amount_excluding_tax,tax_amount,note,created_by_employee_id
  ) values(v_actor.organization_id,v_record_no,p_direction,p_invoice_type,p_finance_document_id,v_customer,v_entity,v_supplier,
    v_name,nullif(btrim(coalesce(p_invoice_code,'')),''),btrim(p_invoice_no),p_issued_on,p_amount_excluding_tax,p_tax_amount,
    nullif(btrim(coalesce(p_note,'')),''),v_actor.id) returning id into v_id;
  update public.finance_documents set invoice_no=btrim(p_invoice_no) where id=v_doc.id;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'finance_invoice_recorded','finance_invoice',v_id,'登记发票 '||p_invoice_no);
  return jsonb_build_object('id',v_id,'recordNo',v_record_no);
end $function$;

create or replace function public.update_finance_invoice_status(p_invoice_id uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype; v_invoice public.finance_invoices%rowtype;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.has_org_role('finance')
    then raise exception '当前账号无权操作发票' using errcode='42501'; end if;
  select * into v_invoice from public.finance_invoices where id=p_invoice_id and organization_id=v_actor.organization_id for update;
  if v_invoice.id is null or p_status not in ('verified','void') then raise exception '发票状态操作无效' using errcode='22023'; end if;
  if p_status='void' and char_length(btrim(coalesce(p_note,'')))<2 then raise exception '作废必须填写原因' using errcode='22023'; end if;
  update public.finance_invoices set status=p_status,verification_note=nullif(btrim(coalesce(p_note,'')),'') where id=v_invoice.id;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'finance_invoice_'||p_status,'finance_invoice',v_invoice.id,'发票 '||v_invoice.invoice_no||' 更新为 '||p_status);
end $function$;

revoke all on function public.can_manage_customers() from public, anon;
revoke all on function public.can_manage_products() from public, anon;
revoke all on function public.can_view_channel_prices() from public, anon;
revoke all on function public.can_view_procurement_prices() from public, anon;
revoke all on function public.can_manage_inventory() from public, anon;
revoke all on function public.can_manage_suppliers() from public, anon;
revoke all on function public.can_manage_hr() from public, anon;
revoke all on function public.can_view_sales_quote(uuid) from public, anon;
revoke all on function public.can_view_sales_order(uuid) from public, anon;
revoke all on function public.can_view_procurement_operations() from public, anon;
revoke all on function public.create_finance_invoice(text,text,uuid,text,text,text,date,numeric,numeric,text) from public, anon;
revoke all on function public.update_finance_invoice_status(uuid,text,text) from public, anon;

grant execute on function public.can_manage_customers() to authenticated;
grant execute on function public.can_manage_products() to authenticated;
grant execute on function public.can_view_channel_prices() to authenticated;
grant execute on function public.can_view_procurement_prices() to authenticated;
grant execute on function public.can_manage_inventory() to authenticated;
grant execute on function public.can_manage_suppliers() to authenticated;
grant execute on function public.can_manage_hr() to authenticated;
grant execute on function public.can_view_sales_quote(uuid) to authenticated;
grant execute on function public.can_view_sales_order(uuid) to authenticated;
grant execute on function public.can_view_procurement_operations() to authenticated;
grant execute on function public.create_finance_invoice(text,text,uuid,text,text,text,date,numeric,numeric,text) to authenticated;
grant execute on function public.update_finance_invoice_status(uuid,text,text) to authenticated;

commit;
