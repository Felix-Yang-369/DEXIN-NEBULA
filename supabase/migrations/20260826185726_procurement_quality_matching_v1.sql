-- Procurement V1.0: RFQ comparison, receiving quality, returns and three-way matching.
begin;

create table public.procurement_rfqs (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  rfq_no text not null, purchase_request_id uuid references public.purchase_requests(id) on delete set null,
  title text not null, due_at timestamptz, status text not null default 'open' check(status in('draft','open','awarded','closed','cancelled')),
  awarded_supplier_id uuid references public.suppliers(id) on delete set null, created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(), unique(organization_id,rfq_no)
);
create table public.procurement_rfq_suppliers (
  organization_id uuid not null references public.organizations(id) on delete cascade, rfq_id uuid not null references public.procurement_rfqs(id) on delete cascade,
  supplier_id uuid not null references public.suppliers(id) on delete restrict, quoted_amount numeric(14,2) check(quoted_amount>=0),
  promised_on date, payment_terms text, score numeric(5,2), submitted_at timestamptz, note text, primary key(rfq_id,supplier_id)
);
create table public.goods_receipt_inspections (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  inspection_no text not null, goods_receipt_id uuid not null unique references public.goods_receipts(id) on delete restrict,
  result text not null check(result in('passed','partial','failed')), inspected_quantity numeric(14,3) not null check(inspected_quantity>0),
  accepted_quantity numeric(14,3) not null check(accepted_quantity>=0), rejected_quantity numeric(14,3) not null check(rejected_quantity>=0),
  defect_reason text, inspected_by_employee_id uuid not null references public.employees(id), inspected_at timestamptz not null default now(),
  check(accepted_quantity+rejected_quantity=inspected_quantity), unique(organization_id,inspection_no)
);
create table public.purchase_returns (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  return_no text not null, inspection_id uuid not null unique references public.goods_receipt_inspections(id) on delete restrict,
  supplier_id uuid not null references public.suppliers(id), return_amount numeric(14,2) not null check(return_amount>=0),
  status text not null default 'completed' check(status in('completed','cancelled')), reason text not null,
  created_by_employee_id uuid not null references public.employees(id), created_at timestamptz not null default now(), unique(organization_id,return_no)
);
create table public.procurement_document_matches (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  finance_document_id uuid not null unique references public.finance_documents(id) on delete cascade,
  purchase_order_id uuid not null references public.purchase_orders(id), goods_receipt_id uuid not null references public.goods_receipts(id),
  order_amount numeric(14,2) not null, receipt_amount numeric(14,2) not null, invoice_amount numeric(14,2) not null,
  variance_amount numeric(14,2) not null, status text not null check(status in('matched','tolerance','blocked')),
  matched_by_employee_id uuid not null references public.employees(id), matched_at timestamptz not null default now()
);

create index procurement_rfqs_org_status_idx on public.procurement_rfqs(organization_id,status,due_at);
create index procurement_rfq_suppliers_score_idx on public.procurement_rfq_suppliers(rfq_id,score desc,quoted_amount);
create index goods_receipt_inspections_org_result_idx on public.goods_receipt_inspections(organization_id,result,inspected_at desc);
create index procurement_document_matches_org_status_idx on public.procurement_document_matches(organization_id,status,matched_at desc);

alter table public.procurement_rfqs enable row level security; alter table public.procurement_rfq_suppliers enable row level security;
alter table public.goods_receipt_inspections enable row level security; alter table public.purchase_returns enable row level security;
alter table public.procurement_document_matches enable row level security;
do $p$ declare t text; begin foreach t in array array['procurement_rfqs','procurement_rfq_suppliers','goods_receipt_inspections','purchase_returns','procurement_document_matches'] loop
  execute format('create policy %I on public.%I for select to authenticated using (organization_id=public.current_organization_id() and public.can_view_procurement_operations())',t||'_read',t);
  execute format('revoke all on table public.%I from public,anon,authenticated',t); execute format('grant select on table public.%I to authenticated',t);
end loop; end $p$;

create or replace function public.create_procurement_rfq(p_purchase_request_id uuid,p_title text,p_due_at timestamptz,p_supplier_ids uuid[])
returns uuid language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();v_id uuid;v_no text;
begin
 if v_actor is null or not public.can_manage_suppliers() then raise exception '无权创建询价单' using errcode='42501';end if;
 if char_length(btrim(coalesce(p_title,''))) not between 2 and 120 or cardinality(p_supplier_ids)<2 or cardinality(p_supplier_ids)>20 then raise exception '询价参数无效' using errcode='22023';end if;
 if p_purchase_request_id is not null and not exists(select 1 from public.purchase_requests where id=p_purchase_request_id and organization_id=v_org and status='approved') then raise exception '采购申请无效' using errcode='23514';end if;
 if exists(select 1 from unnest(p_supplier_ids) s left join public.suppliers x on x.id=s and x.organization_id=v_org and x.cooperation_status='active' where x.id is null) then raise exception '询价供应商无效' using errcode='23514';end if;
 v_no:='DXRFQ-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.procurement_rfqs(organization_id,rfq_no,purchase_request_id,title,due_at,status,created_by_employee_id) values(v_org,v_no,p_purchase_request_id,btrim(p_title),p_due_at,'open',v_actor) returning id into v_id;
 insert into public.procurement_rfq_suppliers(organization_id,rfq_id,supplier_id) select v_org,v_id,s from unnest(p_supplier_ids) s;
 return v_id;
end;$f$;

create or replace function public.record_procurement_quote(p_rfq_id uuid,p_supplier_id uuid,p_amount numeric,p_promised_on date,p_payment_terms text,p_score numeric,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();begin
 if not public.can_manage_suppliers() then raise exception '无权登记报价' using errcode='42501';end if;
 if p_amount<0 or p_score not between 0 and 100 then raise exception '报价参数无效' using errcode='22023';end if;
 update public.procurement_rfq_suppliers s set quoted_amount=p_amount,promised_on=p_promised_on,payment_terms=nullif(btrim(p_payment_terms),''),score=p_score,note=nullif(btrim(p_note),''),submitted_at=now()
 from public.procurement_rfqs r where s.rfq_id=r.id and r.id=p_rfq_id and s.supplier_id=p_supplier_id and r.organization_id=v_org and r.status='open';
 if not found then raise exception '询价单或供应商无效' using errcode='23514';end if;
end;$f$;

create or replace function public.inspect_goods_receipt(p_goods_receipt_id uuid,p_accepted_quantity numeric,p_rejected_quantity numeric,p_defect_reason text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();v_receipt public.goods_receipts%rowtype;v_total numeric;v_id uuid;v_result text;line record;v_reject numeric;v_ratio numeric;
begin
 if v_actor is null or not public.can_manage_inventory() then raise exception '无权执行到货质检' using errcode='42501';end if;
 select * into v_receipt from public.goods_receipts where id=p_goods_receipt_id and organization_id=v_org and status='posted' for update;
 select coalesce(sum(quantity),0) into v_total from public.goods_receipt_items where goods_receipt_id=p_goods_receipt_id;
 if v_receipt.id is null or p_accepted_quantity<0 or p_rejected_quantity<0 or p_accepted_quantity+p_rejected_quantity<>v_total then raise exception '质检数量必须等于到货数量' using errcode='23514';end if;
 if p_rejected_quantity>0 and char_length(btrim(coalesce(p_defect_reason,'')))<2 then raise exception '不合格时必须填写原因' using errcode='22023';end if;
 v_result:=case when p_rejected_quantity=0 then 'passed' when p_accepted_quantity=0 then 'failed' else 'partial' end;
 insert into public.goods_receipt_inspections(organization_id,inspection_no,goods_receipt_id,result,inspected_quantity,accepted_quantity,rejected_quantity,defect_reason,inspected_by_employee_id)
 values(v_org,'DXQI-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),p_goods_receipt_id,v_result,v_total,p_accepted_quantity,p_rejected_quantity,nullif(btrim(p_defect_reason),''),v_actor) returning id into v_id;
 if p_rejected_quantity>0 then
   v_ratio:=p_rejected_quantity/v_total;
   for line in select * from public.goods_receipt_items where goods_receipt_id=p_goods_receipt_id loop
     v_reject:=least(line.quantity,round(line.quantity*v_ratio,3));
     update public.inventory_batches set status=case when quantity=v_reject then 'quarantined' else status end,note=concat_ws('；',note,'质检不合格隔离 '||v_reject) where id=line.inventory_batch_id;
     update public.inventory_items set available_quantity=available_quantity-v_reject,quarantined_quantity=quarantined_quantity+v_reject where id=line.inventory_item_id and available_quantity>=v_reject;
   end loop;
 end if;
 return v_id;
end;$f$;

create or replace function public.perform_procurement_three_way_match(p_finance_document_id uuid,p_tolerance numeric default 1)
returns text language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();d public.finance_documents%rowtype;o numeric;r numeric;i numeric;v numeric;s text;
begin
 if v_actor is null or not public.has_org_role('finance') then raise exception '只有财务可以执行三单匹配' using errcode='42501';end if;
 select * into d from public.finance_documents where id=p_finance_document_id and organization_id=v_org and document_type='payable' and status<>'void';
 if d.id is null or d.purchase_order_id is null or d.goods_receipt_id is null then raise exception '应付单缺少采购或到货来源' using errcode='23514';end if;
 select total_amount into o from public.purchase_orders where id=d.purchase_order_id;select total_amount into r from public.goods_receipts where id=d.goods_receipt_id;
 select coalesce(sum(total_amount),0) into i from public.finance_invoices where finance_document_id=d.id and direction='received' and status<>'void';
 v:=greatest(abs(o-r),abs(r-i));s:=case when i=0 then 'blocked' when v=0 then 'matched' when v<=greatest(0,p_tolerance) then 'tolerance' else 'blocked' end;
 insert into public.procurement_document_matches(organization_id,finance_document_id,purchase_order_id,goods_receipt_id,order_amount,receipt_amount,invoice_amount,variance_amount,status,matched_by_employee_id)
 values(v_org,d.id,d.purchase_order_id,d.goods_receipt_id,o,r,i,v,s,v_actor) on conflict(finance_document_id) do update set order_amount=excluded.order_amount,receipt_amount=excluded.receipt_amount,invoice_amount=excluded.invoice_amount,variance_amount=excluded.variance_amount,status=excluded.status,matched_by_employee_id=v_actor,matched_at=now();return s;
end;$f$;

create or replace function public.complete_purchase_return(p_inspection_id uuid,p_reason text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();q public.goods_receipt_inspections%rowtype;g public.goods_receipts%rowtype;v_id uuid;v_amount numeric:=0;line record;v_qty numeric;v_no text;
begin
 if v_actor is null or not public.can_manage_inventory() then raise exception '无权办理采购退货' using errcode='42501';end if;
 select * into q from public.goods_receipt_inspections where id=p_inspection_id and organization_id=v_org and rejected_quantity>0 for update;
 if q.id is null or exists(select 1 from public.purchase_returns where inspection_id=q.id) or char_length(btrim(coalesce(p_reason,'')))<2 then raise exception '质检单不可退货或原因无效' using errcode='23514';end if;
 select * into g from public.goods_receipts where id=q.goods_receipt_id;
 for line in select * from public.goods_receipt_items where goods_receipt_id=g.id loop
  v_qty:=least(line.quantity,round(line.quantity*q.rejected_quantity/q.inspected_quantity,3));v_amount:=v_amount+round(v_qty*line.unit_cost,2);
  update public.inventory_batches set quantity=quantity-v_qty,status=case when quantity-v_qty<=0 then 'depleted' else status end where id=line.inventory_batch_id and quantity>=v_qty;
  update public.inventory_items set quantity=quantity-v_qty,quarantined_quantity=quarantined_quantity-v_qty where id=line.inventory_item_id and quarantined_quantity>=v_qty;
 end loop;
 v_no:='DXPR-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
 insert into public.purchase_returns(organization_id,return_no,inspection_id,supplier_id,return_amount,reason,created_by_employee_id) values(v_org,v_no,q.id,g.supplier_id,v_amount,btrim(p_reason),v_actor) returning id into v_id;
 update public.finance_documents set
   status=case when total_amount=v_amount and settled_amount=0 then 'void' else status end,
   total_amount=case when total_amount=v_amount and settled_amount=0 then total_amount else total_amount-v_amount end,
   note=concat_ws('；',note,'采购退货 '||v_no||' 冲减 '||v_amount)
 where goods_receipt_id=g.id and document_type='payable' and status='open'
   and v_amount<=total_amount and settled_amount<=total_amount-v_amount;
 if not found then raise exception '应付单已结算或退货金额无法冲减' using errcode='23514';end if;
 return v_id;
end;$f$;

revoke all on function public.create_procurement_rfq(uuid,text,timestamptz,uuid[]) from public,anon;grant execute on function public.create_procurement_rfq(uuid,text,timestamptz,uuid[]) to authenticated;
revoke all on function public.record_procurement_quote(uuid,uuid,numeric,date,text,numeric,text) from public,anon;grant execute on function public.record_procurement_quote(uuid,uuid,numeric,date,text,numeric,text) to authenticated;
revoke all on function public.inspect_goods_receipt(uuid,numeric,numeric,text) from public,anon;grant execute on function public.inspect_goods_receipt(uuid,numeric,numeric,text) to authenticated;
revoke all on function public.perform_procurement_three_way_match(uuid,numeric) from public,anon;grant execute on function public.perform_procurement_three_way_match(uuid,numeric) to authenticated;
revoke all on function public.complete_purchase_return(uuid,text) from public,anon;grant execute on function public.complete_purchase_return(uuid,text) to authenticated;
commit;
