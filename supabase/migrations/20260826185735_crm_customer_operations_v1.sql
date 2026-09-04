-- CRM V1.0: public pool, assignment history, credit control and customer 360.
begin;
alter table public.customers add column pool_status text not null default 'assigned' check(pool_status in('assigned','public_pool')),
 add column pool_entered_at timestamptz,add column last_assigned_at timestamptz;
create table public.customer_credit_profiles(
 customer_id uuid primary key references public.customers(id) on delete cascade,organization_id uuid not null references public.organizations(id) on delete cascade,
 credit_limit numeric(14,2) not null default 0 check(credit_limit>=0),payment_term_days integer not null default 30 check(payment_term_days between 0 and 365),
 risk_level text not null default 'normal' check(risk_level in('low','normal','high','blocked')),status text not null default 'active' check(status in('active','suspended')),
 reviewed_by_employee_id uuid references public.employees(id),reviewed_at timestamptz,note text,updated_at timestamptz not null default now()
);
create table public.customer_assignment_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 customer_id uuid not null references public.customers(id) on delete cascade,from_owner_employee_id uuid references public.employees(id),to_owner_employee_id uuid references public.employees(id),
 event_type text not null check(event_type in('released','claimed','assigned')),reason text,created_by_employee_id uuid not null references public.employees(id),created_at timestamptz not null default now()
);
insert into public.customer_credit_profiles(customer_id,organization_id) select id,organization_id from public.customers on conflict do nothing;
create index customers_public_pool_idx on public.customers(organization_id,pool_entered_at) where pool_status='public_pool';
create index customer_assignment_events_customer_idx on public.customer_assignment_events(customer_id,created_at desc);
create index customer_credit_profiles_org_risk_idx on public.customer_credit_profiles(organization_id,risk_level,status);
alter table public.customer_credit_profiles enable row level security;alter table public.customer_assignment_events enable row level security;
create policy customer_credit_profiles_read on public.customer_credit_profiles for select to authenticated using(organization_id=public.current_organization_id() and (public.can_manage_customers() or public.has_org_role('finance') or public.has_org_role('chairman')));
create policy customer_assignment_events_read on public.customer_assignment_events for select to authenticated using(organization_id=public.current_organization_id() and (public.can_manage_customers() or public.has_org_role('chairman')));
revoke all on table public.customer_credit_profiles from public,anon,authenticated;revoke all on table public.customer_assignment_events from public,anon,authenticated;
grant select on table public.customer_credit_profiles to authenticated;grant select on table public.customer_assignment_events to authenticated;

create or replace function public.move_customer_to_public_pool(p_customer_id uuid,p_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();v_owner uuid;begin
 if not public.can_manage_customers() or char_length(btrim(coalesce(p_reason,'')))<2 then raise exception '无权操作或必须填写原因' using errcode='42501';end if;
 select owner_employee_id into v_owner from public.customers where id=p_customer_id and organization_id=v_org for update;
 if not found then raise exception '客户不存在' using errcode='P0002';end if;
 update public.customers set owner_employee_id=null,pool_status='public_pool',pool_entered_at=now() where id=p_customer_id;
 insert into public.customer_assignment_events(organization_id,customer_id,from_owner_employee_id,event_type,reason,created_by_employee_id) values(v_org,p_customer_id,v_owner,'released',btrim(p_reason),v_actor);
end;$f$;
create or replace function public.claim_customer_from_public_pool(p_customer_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();begin
 if not public.can_manage_customers() then raise exception '无权领取客户' using errcode='42501';end if;
 update public.customers set owner_employee_id=v_actor,pool_status='assigned',pool_entered_at=null,last_assigned_at=now() where id=p_customer_id and organization_id=v_org and pool_status='public_pool';
 if not found then raise exception '客户已被领取或不在公海' using errcode='23514';end if;
 insert into public.customer_assignment_events(organization_id,customer_id,to_owner_employee_id,event_type,created_by_employee_id) values(v_org,p_customer_id,v_actor,'claimed',v_actor);
end;$f$;
create or replace function public.update_customer_credit(p_customer_id uuid,p_credit_limit numeric,p_payment_term_days integer,p_risk_level text,p_status text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();begin
 if v_actor is null or not(public.has_org_role('finance') or public.has_org_role('chairman')) then raise exception '只有财务或董事长可以维护信用额度' using errcode='42501';end if;
 if p_credit_limit<0 or p_payment_term_days not between 0 and 365 or p_risk_level not in('low','normal','high','blocked') or p_status not in('active','suspended') then raise exception '信用参数无效' using errcode='22023';end if;
 insert into public.customer_credit_profiles(customer_id,organization_id,credit_limit,payment_term_days,risk_level,status,reviewed_by_employee_id,reviewed_at,note)
 select id,v_org,p_credit_limit,p_payment_term_days,p_risk_level,p_status,v_actor,now(),nullif(btrim(p_note),'') from public.customers where id=p_customer_id and organization_id=v_org
 on conflict(customer_id) do update set credit_limit=excluded.credit_limit,payment_term_days=excluded.payment_term_days,risk_level=excluded.risk_level,status=excluded.status,reviewed_by_employee_id=v_actor,reviewed_at=now(),note=excluded.note,updated_at=now();
 if not found then raise exception '客户不存在' using errcode='P0002';end if;
end;$f$;
create or replace function app_private.enforce_sales_customer_credit()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $f$
declare c public.customer_credit_profiles%rowtype;used numeric;begin
 if new.status not in('confirmed','fulfilling') then return new;end if;
 select * into c from public.customer_credit_profiles where customer_id=new.customer_id;
 if c.status='suspended' or c.risk_level='blocked' then raise exception '客户信用已冻结，不能确认订单' using errcode='23514';end if;
 if c.credit_limit>0 then
  select coalesce(sum(total_amount-settled_amount),0) into used from public.finance_documents where customer_id=new.customer_id and document_type='receivable' and status in('open','partial');
  if used+new.total_cny>c.credit_limit then raise exception '订单超过客户可用信用额度' using errcode='23514';end if;
 end if;return new;
end;$f$;
revoke all on function app_private.enforce_sales_customer_credit() from public,anon,authenticated;
create trigger sales_orders_enforce_customer_credit before insert or update of status,total_cny,customer_id on public.sales_orders for each row execute function app_private.enforce_sales_customer_credit();
create or replace function public.customer_360_summary(p_customer_id uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $f$
 select jsonb_build_object(
  'orders',(select count(*) from public.sales_orders o where o.customer_id=c.id and o.status<>'cancelled'),
  'salesAmount',coalesce((select sum(o.total_cny) from public.sales_orders o where o.customer_id=c.id and o.status<>'cancelled'),0),
  'receivableOutstanding',coalesce((select sum(d.total_amount-d.settled_amount) from public.finance_documents d where d.customer_id=c.id and d.document_type='receivable' and d.status in('open','partial')),0),
  'lastOrderOn',(select max(o.order_date) from public.sales_orders o where o.customer_id=c.id and o.status<>'cancelled'),
  'followups',(select count(*) from public.customer_followups f where f.customer_id=c.id),
  'opportunities',(select count(*) from public.sales_opportunities s where s.customer_id=c.id and s.stage not in('won','lost')))
 from public.customers c where c.id=p_customer_id and c.organization_id=public.current_organization_id()
 and (public.can_manage_customers() or public.has_org_role('finance') or public.has_org_role('chairman'));
$f$;
revoke all on function public.move_customer_to_public_pool(uuid,text) from public,anon;grant execute on function public.move_customer_to_public_pool(uuid,text) to authenticated;
revoke all on function public.claim_customer_from_public_pool(uuid) from public,anon;grant execute on function public.claim_customer_from_public_pool(uuid) to authenticated;
revoke all on function public.update_customer_credit(uuid,numeric,integer,text,text,text) from public,anon;grant execute on function public.update_customer_credit(uuid,numeric,integer,text,text,text) to authenticated;
revoke all on function public.customer_360_summary(uuid) from public,anon;grant execute on function public.customer_360_summary(uuid) to authenticated;
commit;
