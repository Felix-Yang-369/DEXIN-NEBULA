alter table public.inventory_outbound_orders
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;
create unique index if not exists inventory_outbound_orders_sales_order_idx
  on public.inventory_outbound_orders(sales_order_id) where sales_order_id is not null;

alter table public.finance_documents
  add column if not exists sales_order_id uuid references public.sales_orders(id) on delete set null;
create unique index if not exists finance_documents_sales_order_receivable_idx
  on public.finance_documents(sales_order_id)
  where sales_order_id is not null and document_type='receivable' and status<>'void';

create table if not exists public.finance_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_record_no text not null,
  direction text not null check (direction in ('issued','received')),
  invoice_type text not null default 'vat_general'
    check (invoice_type in ('vat_general','vat_special','electronic','other')),
  finance_document_id uuid references public.finance_documents(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  legal_entity_id uuid references public.customer_legal_entities(id) on delete set null,
  supplier_id uuid references public.suppliers(id) on delete set null,
  counterparty_name text not null,
  invoice_code text,
  invoice_no text not null,
  issued_on date not null,
  amount_excluding_tax numeric(14,2) not null check (amount_excluding_tax>=0),
  tax_amount numeric(14,2) not null default 0 check (tax_amount>=0),
  total_amount numeric(14,2) generated always as (amount_excluding_tax+tax_amount) stored,
  status text not null default 'recorded' check (status in ('recorded','verified','void')),
  verification_note text,
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id,direction,invoice_no)
);

create index if not exists finance_invoices_org_date_idx
  on public.finance_invoices(organization_id,direction,issued_on desc);
create index if not exists finance_invoices_document_idx
  on public.finance_invoices(finance_document_id) where finance_document_id is not null;
create index if not exists finance_invoices_customer_idx
  on public.finance_invoices(customer_id) where customer_id is not null;
create index if not exists finance_invoices_legal_entity_idx
  on public.finance_invoices(legal_entity_id) where legal_entity_id is not null;
create index if not exists finance_invoices_supplier_idx
  on public.finance_invoices(supplier_id) where supplier_id is not null;
create index if not exists finance_invoices_created_by_idx
  on public.finance_invoices(created_by_employee_id);

create trigger set_finance_invoices_updated_at before update on public.finance_invoices
for each row execute function public.set_updated_at();

alter table public.finance_invoices enable row level security;
create policy finance_invoices_finance_read on public.finance_invoices for select to authenticated
using (organization_id=public.current_organization_id() and (
  public.has_org_role('finance') or public.has_org_role('chairman') or public.has_org_role('admin')
));
revoke all on table public.finance_invoices from anon,authenticated;
grant select on table public.finance_invoices to authenticated;

create or replace function public.fulfill_sales_order(
  p_order_id uuid,p_warehouse_id uuid,p_recipient_name text,p_recipient_phone text,p_delivery_address text,p_note text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $f$
declare
  v_actor public.employees%rowtype; v_order public.sales_orders%rowtype; v_entity public.customer_legal_entities%rowtype;
  v_sales_item record; v_stock public.inventory_items%rowtype; v_out_id uuid; v_out_no text; v_delivery jsonb;
  v_document_id uuid; v_document_no text; v_cost numeric(14,2):=0; v_unit_cost numeric(14,2);
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_inventory() then raise exception '只有仓储人员或管理员可以执行销售履约' using errcode='42501'; end if;
  select * into v_order from public.sales_orders where id=p_order_id and organization_id=v_actor.organization_id for update;
  if v_order.id is null or v_order.status<>'confirmed' or v_order.legal_entity_id is null
    then raise exception '销售订单不存在、未确认或缺少法律实体' using errcode='23514'; end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and organization_id=v_actor.organization_id and status='active')
    then raise exception '履约仓库无效' using errcode='42501'; end if;
  select * into v_entity from public.customer_legal_entities where id=v_order.legal_entity_id and status='active';
  v_out_no:='DXOB-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.inventory_outbound_orders(
    organization_id,outbound_no,warehouse_id,sales_order_id,source_type,source_no,requested_on,
    recipient_name,recipient_phone,delivery_address,note,created_by_employee_id
  ) values(v_actor.organization_id,v_out_no,p_warehouse_id,v_order.id,'sales',v_order.order_no,v_order.requested_delivery_on,
    nullif(btrim(coalesce(p_recipient_name,'')),''),nullif(btrim(coalesce(p_recipient_phone,'')),''),
    nullif(btrim(coalesce(p_delivery_address,'')),''),nullif(btrim(coalesce(p_note,'')),''),v_actor.id) returning id into v_out_id;
  for v_sales_item in select * from public.sales_order_items where order_id=v_order.id order by position for update loop
    select * into v_stock from public.inventory_items where organization_id=v_actor.organization_id and warehouse_id=p_warehouse_id
      and product_id=v_sales_item.product_id and status='active' order by available_quantity desc limit 1 for update;
    if v_stock.id is null or v_stock.available_quantity<(v_sales_item.quantity-v_sales_item.delivered_quantity)
      then raise exception '商品 % 在所选仓库可用库存不足',v_sales_item.product_name using errcode='23514'; end if;
    insert into public.inventory_outbound_items(
      organization_id,outbound_order_id,inventory_item_id,product_name,sku,quantity,unit,position
    ) values(v_actor.organization_id,v_out_id,v_stock.id,v_sales_item.product_name,v_sales_item.product_code,
      v_sales_item.quantity-v_sales_item.delivered_quantity,v_sales_item.unit,v_sales_item.position);
    select price.amount_cny into v_unit_cost from public.product_prices price where price.product_id=v_sales_item.product_id
      and price.organization_id=v_actor.organization_id and price.price_type='procurement' and price.status='active'
      and price.valid_from<=current_date and (price.valid_until is null or price.valid_until>=current_date)
      order by price.valid_from desc limit 1;
    v_cost:=v_cost+round(coalesce(v_unit_cost,0)*(v_sales_item.quantity-v_sales_item.delivered_quantity),2);
  end loop;
  update public.sales_orders set status='fulfilling' where id=v_order.id;
  v_delivery:=public.complete_inventory_outbound(v_out_id);
  update public.sales_order_items set delivered_quantity=quantity where order_id=v_order.id;
  update public.sales_orders set status='completed' where id=v_order.id;
  v_document_no:='DXR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.finance_documents(
    organization_id,document_no,document_type,customer_id,legal_entity_id,sales_order_id,counterparty_name,
    source_type,source_no,issue_date,due_date,total_amount,summary,note,created_by_employee_id
  ) values(v_actor.organization_id,v_document_no,'receivable',v_order.customer_id,v_order.legal_entity_id,v_order.id,
    v_entity.legal_name,'order',v_order.order_no,current_date,current_date+30,v_order.total_cny,
    '销售订单履约应收 '||v_order.order_no,coalesce(v_order.payment_terms,'默认履约后 30 天'),v_actor.id)
  returning id into v_document_id;
  insert into public.sales_order_profitability(order_id,organization_id,revenue_cny,cost_cny,cost_status)
  values(v_order.id,v_actor.organization_id,v_order.total_cny,v_cost,'estimated')
  on conflict(order_id) do update set revenue_cny=excluded.revenue_cny,cost_cny=excluded.cost_cny,cost_status='estimated';
  insert into public.sales_order_events(organization_id,order_id,actor_employee_id,from_status,to_status,note)
  values(v_actor.organization_id,v_order.id,v_actor.id,'confirmed','completed','出库、配送与应收已联动生成');
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary,metadata)
  values(v_actor.organization_id,v_actor.id,'sales_order_fulfilled','sales_order',v_order.id,'完成销售履约 '||v_order.order_no,
    jsonb_build_object('outbound_no',v_out_no,'delivery_no',v_delivery->>'deliveryNo','receivable_no',v_document_no));
  return jsonb_build_object('outboundNo',v_out_no,'deliveryNo',v_delivery->>'deliveryNo','receivableNo',v_document_no,'receivableId',v_document_id);
end $f$;

create or replace function public.create_finance_invoice(
  p_direction text,p_invoice_type text,p_finance_document_id uuid,p_counterparty_name text,
  p_invoice_code text,p_invoice_no text,p_issued_on date,p_amount_excluding_tax numeric,p_tax_amount numeric,p_note text
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $f$
declare
  v_actor public.employees%rowtype; v_doc public.finance_documents%rowtype; v_id uuid; v_record_no text;
  v_customer uuid; v_entity uuid; v_supplier uuid; v_name text;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not (public.has_org_role('finance') or public.has_org_role('admin'))
    then raise exception '只有财务或管理员可以登记发票' using errcode='42501'; end if;
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
end $f$;

create or replace function public.update_finance_invoice_status(p_invoice_id uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_actor public.employees%rowtype; v_invoice public.finance_invoices%rowtype;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not (public.has_org_role('finance') or public.has_org_role('admin'))
    then raise exception '当前账号无权操作发票' using errcode='42501'; end if;
  select * into v_invoice from public.finance_invoices where id=p_invoice_id and organization_id=v_actor.organization_id for update;
  if v_invoice.id is null or p_status not in ('verified','void') then raise exception '发票状态操作无效' using errcode='22023'; end if;
  if p_status='void' and char_length(btrim(coalesce(p_note,'')))<2 then raise exception '作废必须填写原因' using errcode='22023'; end if;
  update public.finance_invoices set status=p_status,verification_note=nullif(btrim(coalesce(p_note,'')),'') where id=v_invoice.id;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary)
  values(v_actor.organization_id,v_actor.id,'finance_invoice_'||p_status,'finance_invoice',v_invoice.id,'发票 '||v_invoice.invoice_no||' 更新为 '||p_status);
end $f$;

revoke all on function public.fulfill_sales_order(uuid,uuid,text,text,text,text) from public,anon;
grant execute on function public.fulfill_sales_order(uuid,uuid,text,text,text,text) to authenticated;
revoke all on function public.create_finance_invoice(text,text,uuid,text,text,text,date,numeric,numeric,text) from public,anon;
grant execute on function public.create_finance_invoice(text,text,uuid,text,text,text,date,numeric,numeric,text) to authenticated;
revoke all on function public.update_finance_invoice_status(uuid,text,text) from public,anon;
grant execute on function public.update_finance_invoice_status(uuid,text,text) to authenticated;
