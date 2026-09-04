-- Sales loop V2: approval-gated confirmation, partial fulfillment and a
-- permission-checked order-to-stock-to-receivable trace model.
begin;

alter table public.sales_orders drop constraint if exists sales_orders_status_check;
alter table public.sales_orders add constraint sales_orders_status_check
  check (status in ('draft','pending_approval','confirmed','fulfilling','completed','cancelled'));
alter table public.sales_orders
  add column approval_request_id uuid references public.approval_requests(id) on delete restrict,
  add column approved_at timestamptz;
create unique index sales_orders_approval_request_unique_idx on public.sales_orders(approval_request_id) where approval_request_id is not null;

drop index if exists public.inventory_outbound_orders_sales_order_idx;
create index inventory_outbound_orders_sales_order_idx on public.inventory_outbound_orders(sales_order_id,created_at)
  where sales_order_id is not null;
drop index if exists public.finance_documents_sales_order_receivable_idx;
alter table public.finance_documents add column inventory_outbound_id uuid references public.inventory_outbound_orders(id) on delete restrict;
create unique index finance_documents_outbound_receivable_idx on public.finance_documents(inventory_outbound_id)
  where inventory_outbound_id is not null and document_type='receivable' and status<>'void';

create or replace function public.sync_sales_order_approval_status()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_order public.sales_orders%rowtype;v_actor_id uuid;
begin
  if new.request_type<>'sales_order' or new.source_type<>'sales_order' or old.status=new.status then return new;end if;
  select * into v_order from public.sales_orders where id=new.source_id and approval_request_id=new.id for update;
  if v_order.id is null then return new;end if;
  select step.approver_employee_id into v_actor_id from public.approval_steps step
  where step.approval_request_id=new.id and step.status='approved' order by step.step_order desc limit 1;
  v_actor_id:=coalesce(v_actor_id,new.applicant_employee_id);
  if new.status='approved' and v_order.status='pending_approval' then
    update public.sales_orders set status='confirmed',confirmed_at=now(),approved_at=now() where id=v_order.id;
    insert into public.sales_order_events(organization_id,order_id,actor_employee_id,from_status,to_status,note)
    values(v_order.organization_id,v_order.id,v_actor_id,'pending_approval','confirmed','统一审批流程已通过');
  elsif new.status='returned' and v_order.status='pending_approval' then
    update public.sales_orders set status='draft' where id=v_order.id;
  elsif new.status in ('rejected','withdrawn') and v_order.status='pending_approval' then
    update public.sales_orders set status='cancelled',cancelled_at=now(),cancellation_reason='审批未通过' where id=v_order.id;
  end if;
  return new;
end $function$;
create trigger approval_requests_sync_sales_order
after update of status on public.approval_requests for each row execute function public.sync_sales_order_approval_status();
revoke all on function public.sync_sales_order_approval_status() from public,anon,authenticated;

create or replace function public.transition_sales_order(p_order_id uuid,p_target_status text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype;v_order public.sales_orders%rowtype;v_approval jsonb;v_request public.approval_requests%rowtype;v_first public.approval_steps%rowtype;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_customers() then raise exception '当前账号无权更新销售订单' using errcode='42501';end if;
  select * into v_order from public.sales_orders where id=p_order_id and organization_id=v_actor.organization_id for update;
  if v_order.id is null then raise exception '销售订单不存在' using errcode='P0002';end if;
  if p_target_status='confirmed' then
    if v_order.status<>'draft' or v_order.legal_entity_id is null then raise exception '订单不是草稿或缺少客户法律实体' using errcode='23514';end if;
    if v_order.approval_request_id is null then
      v_approval:=public.start_approval_workflow_v2('sales_order','sales_order',v_order.id,'销售订单确认 '||v_order.order_no,
        coalesce(v_order.note,'订单金额与交付条款复核'),v_order.total_cny,jsonb_build_object('customerId',v_order.customer_id));
      update public.sales_orders set status='pending_approval',approval_request_id=(v_approval->>'id')::uuid where id=v_order.id;
    else
      select * into v_request from public.approval_requests where id=v_order.approval_request_id for update;
      if v_request.status<>'returned' then raise exception '订单已有不可重新提交的审批记录' using errcode='23514';end if;
      update public.approval_steps set status='pending',acted_at=null where approval_request_id=v_request.id;
      select * into v_first from public.approval_steps where approval_request_id=v_request.id order by step_order limit 1;
      update public.approval_steps set status='active' where id=v_first.id;
      update public.approval_requests set status='pending',current_step_order=1,current_approver_employee_id=v_first.approver_employee_id,
        version=version+1,completed_at=null,due_at=v_first.due_at where id=v_request.id;
      insert into public.approval_events(organization_id,approval_request_id,actor_employee_id,action,opinion,previous_status,next_status)
      values(v_actor.organization_id,v_request.id,v_actor.id,'resubmitted',coalesce(nullif(btrim(p_note),''),'销售订单重新提交'),'returned','pending');
      update public.sales_orders set status='pending_approval' where id=v_order.id;
    end if;
    insert into public.sales_order_events(organization_id,order_id,actor_employee_id,from_status,to_status,note)
    values(v_actor.organization_id,v_order.id,v_actor.id,'draft','pending_approval','提交统一审批');
  elsif p_target_status='cancelled' then
    if v_order.status not in ('draft','confirmed') or char_length(btrim(coalesce(p_note,'')))<2 then raise exception '当前状态不可取消或未填写原因' using errcode='23514';end if;
    update public.sales_orders set status='cancelled',cancelled_at=now(),cancellation_reason=btrim(p_note) where id=v_order.id;
    insert into public.sales_order_events(organization_id,order_id,actor_employee_id,from_status,to_status,note)
    values(v_actor.organization_id,v_order.id,v_actor.id,v_order.status,'cancelled',btrim(p_note));
  else raise exception '不支持的订单状态操作' using errcode='22023';end if;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary,metadata)
  values(v_actor.organization_id,v_actor.id,'sales_order_status_changed','sales_order',v_order.id,'销售订单状态更新：'||v_order.order_no,
    jsonb_build_object('fromStatus',v_order.status,'targetStatus',p_target_status));
end $function$;

create or replace function public.fulfill_sales_order_v2(
  p_order_id uuid,p_warehouse_id uuid,p_recipient_name text,p_recipient_phone text,p_delivery_address text,p_note text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype;v_order public.sales_orders%rowtype;v_entity public.customer_legal_entities%rowtype;
  v_payload jsonb;v_line public.sales_order_items%rowtype;v_stock public.inventory_items%rowtype;v_out_id uuid;v_out_no text;v_delivery jsonb;
  v_doc_id uuid;v_doc_no text;v_batch_total numeric(14,2):=0;v_cost numeric(14,2):=0;v_qty numeric(14,3);v_unit_cost numeric(14,2);v_position int:=0;v_complete boolean;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null or not public.can_manage_inventory() then raise exception '只有仓储人员或管理员可以执行销售履约' using errcode='42501';end if;
  select * into v_order from public.sales_orders where id=p_order_id and organization_id=v_actor.organization_id for update;
  if v_order.id is null or v_order.status not in ('confirmed','fulfilling') or v_order.legal_entity_id is null
    or jsonb_typeof(coalesce(p_items,'[]'::jsonb))<>'array' or jsonb_array_length(coalesce(p_items,'[]'::jsonb))<1
    then raise exception '销售订单状态或履约明细无效' using errcode='23514';end if;
  if (select count(*) from jsonb_array_elements(p_items)) <> (select count(distinct value->>'orderItemId') from jsonb_array_elements(p_items))
    then raise exception '同一订单行不能重复履约' using errcode='22023';end if;
  if not exists(select 1 from public.warehouses where id=p_warehouse_id and organization_id=v_actor.organization_id and status='active')
    then raise exception '履约仓库无效' using errcode='42501';end if;
  select * into v_entity from public.customer_legal_entities where id=v_order.legal_entity_id and organization_id=v_actor.organization_id and status='active';
  if v_entity.id is null then raise exception '客户法律实体无效' using errcode='23514';end if;
  v_out_no:='DXOB-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.inventory_outbound_orders(organization_id,outbound_no,warehouse_id,sales_order_id,source_type,source_no,requested_on,
    recipient_name,recipient_phone,delivery_address,note,created_by_employee_id)
  values(v_actor.organization_id,v_out_no,p_warehouse_id,v_order.id,'sales',v_order.order_no,v_order.requested_delivery_on,
    nullif(btrim(coalesce(p_recipient_name,'')),''),nullif(btrim(coalesce(p_recipient_phone,'')),''),nullif(btrim(coalesce(p_delivery_address,'')),''),
    nullif(btrim(coalesce(p_note,'')),''),v_actor.id) returning id into v_out_id;
  for v_payload in select value from jsonb_array_elements(p_items) loop
    v_position:=v_position+1;v_qty:=(v_payload->>'quantity')::numeric;
    select * into v_line from public.sales_order_items where id=(v_payload->>'orderItemId')::uuid and order_id=v_order.id for update;
    if v_line.id is null or v_qty<=0 or v_qty>v_line.quantity-v_line.delivered_quantity then raise exception '履约数量超过订单未交数量' using errcode='23514';end if;
    select * into v_stock from public.inventory_items where organization_id=v_actor.organization_id and warehouse_id=p_warehouse_id
      and product_id=v_line.product_id and status='active' order by available_quantity desc limit 1 for update;
    if v_stock.id is null or v_stock.available_quantity<v_qty then raise exception '商品 % 在所选仓库可用库存不足',v_line.product_name using errcode='23514';end if;
    insert into public.inventory_outbound_items(organization_id,outbound_order_id,inventory_item_id,product_name,sku,quantity,unit,position)
    values(v_actor.organization_id,v_out_id,v_stock.id,v_line.product_name,v_line.product_code,v_qty,v_line.unit,v_position);
    update public.sales_order_items set delivered_quantity=delivered_quantity+v_qty where id=v_line.id;
    v_batch_total:=v_batch_total+round(v_line.unit_price_cny*v_qty,2);
    select price.amount_cny into v_unit_cost from public.product_prices price where price.product_id=v_line.product_id
      and price.organization_id=v_actor.organization_id and price.price_type='procurement' and price.status='active'
      and price.valid_from<=current_date and (price.valid_until is null or price.valid_until>=current_date) order by price.valid_from desc limit 1;
    v_cost:=v_cost+round(coalesce(v_unit_cost,0)*v_qty,2);
  end loop;
  v_delivery:=public.complete_inventory_outbound(v_out_id);
  select not exists(select 1 from public.sales_order_items item where item.order_id=v_order.id and item.delivered_quantity<item.quantity) into v_complete;
  update public.sales_orders set status=case when v_complete then 'completed' else 'fulfilling' end where id=v_order.id;
  v_doc_no:='DXR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.finance_documents(organization_id,document_no,document_type,customer_id,legal_entity_id,sales_order_id,inventory_outbound_id,
    counterparty_name,source_type,source_no,issue_date,due_date,total_amount,summary,note,created_by_employee_id)
  values(v_actor.organization_id,v_doc_no,'receivable',v_order.customer_id,v_order.legal_entity_id,v_order.id,v_out_id,v_entity.legal_name,'order',
    v_order.order_no,current_date,current_date+30,v_batch_total,'销售订单分批履约应收 '||v_order.order_no,coalesce(v_order.payment_terms,'默认履约后 30 天'),v_actor.id) returning id into v_doc_id;
  insert into public.sales_order_profitability(order_id,organization_id,revenue_cny,cost_cny,cost_status)
  values(v_order.id,v_actor.organization_id,v_batch_total,v_cost,'estimated') on conflict(order_id) do update set
    revenue_cny=public.sales_order_profitability.revenue_cny+excluded.revenue_cny,cost_cny=public.sales_order_profitability.cost_cny+excluded.cost_cny,cost_status='estimated';
  insert into public.sales_order_events(organization_id,order_id,actor_employee_id,from_status,to_status,note)
  values(v_actor.organization_id,v_order.id,v_actor.id,v_order.status,case when v_complete then 'completed' else 'fulfilling' end,
    '分批出库并生成应收 '||v_doc_no);
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary,metadata)
  values(v_actor.organization_id,v_actor.id,'sales_order_partially_fulfilled','sales_order',v_order.id,'销售履约 '||v_order.order_no,
    jsonb_build_object('outboundNo',v_out_no,'receivableNo',v_doc_no,'amount',v_batch_total,'completed',v_complete));
  return jsonb_build_object('outboundNo',v_out_no,'deliveryNo',v_delivery->>'deliveryNo','receivableNo',v_doc_no,'receivableId',v_doc_id,'completed',v_complete);
end $function$;

create or replace function public.sales_order_trace_v2(p_order_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $function$
  select case when not public.can_view_sales_order(p_order_id) then null else jsonb_build_object(
    'outbounds',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'no',o.outbound_no,'status',o.status,'createdAt',o.created_at) order by o.created_at) from public.inventory_outbound_orders o where o.sales_order_id=p_order_id),'[]'::jsonb),
    'receivables',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'no',d.document_no,'total',d.total_amount,'settled',d.settled_amount,'status',d.status,'dueDate',d.due_date) order by d.issue_date) from public.finance_documents d where d.sales_order_id=p_order_id and d.document_type='receivable' and d.status<>'void'),'[]'::jsonb),
    'approval',coalesce((select jsonb_build_object('id',r.id,'no',r.request_no,'status',r.status,'currentStep',r.current_step_order,'totalSteps',r.total_steps) from public.approval_requests r join public.sales_orders s on s.approval_request_id=r.id where s.id=p_order_id),'null'::jsonb)
  ) end
$function$;

revoke all on function public.fulfill_sales_order(uuid,uuid,text,text,text,text) from authenticated;
revoke all on function public.fulfill_sales_order_v2(uuid,uuid,text,text,text,text,jsonb) from public,anon;
revoke all on function public.sales_order_trace_v2(uuid) from public,anon;
grant execute on function public.fulfill_sales_order_v2(uuid,uuid,text,text,text,text,jsonb) to authenticated;
grant execute on function public.sales_order_trace_v2(uuid) to authenticated;

commit;
