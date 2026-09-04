-- Unified Approval V2: versioned route definitions, condition evaluation,
-- route preview and source-document linkage. Existing V1 requests stay valid.
begin;

alter table public.approval_requests drop constraint if exists approval_requests_request_type_check;
alter table public.approval_requests add constraint approval_requests_request_type_check
  check (request_type in ('expense','seal','folder_access','sales_order'));

create table public.approval_workflow_definitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_code text not null check (workflow_code ~ '^[a-z][a-z0-9_]{2,49}$'),
  request_type text not null,
  name text not null,
  version integer not null default 1 check (version > 0),
  status text not null default 'active' check (status in ('draft','active','retired')),
  description text,
  created_at timestamptz not null default now(),
  unique (organization_id, workflow_code, version)
);

create table public.approval_workflow_nodes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workflow_definition_id uuid not null references public.approval_workflow_definitions(id) on delete cascade,
  step_order integer not null check (step_order > 0),
  step_code text not null,
  step_name text not null,
  approver_type text not null check (approver_type in ('manager','role','employee')),
  approver_role_code text,
  approver_employee_id uuid references public.employees(id) on delete restrict,
  condition_rules jsonb not null default '{}'::jsonb check (jsonb_typeof(condition_rules) = 'object'),
  sla_hours integer not null default 24 check (sla_hours between 1 and 720),
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workflow_definition_id, step_order),
  check ((approver_type = 'role' and approver_role_code is not null)
    or (approver_type = 'employee' and approver_employee_id is not null)
    or approver_type = 'manager')
);

alter table public.approval_requests
  add column workflow_definition_id uuid references public.approval_workflow_definitions(id) on delete restrict,
  add column source_type text,
  add column source_id uuid,
  add column amount_cny numeric(14,2),
  add column context_data jsonb not null default '{}'::jsonb,
  add column due_at timestamptz;
alter table public.approval_steps
  add column workflow_node_id uuid references public.approval_workflow_nodes(id) on delete restrict,
  add column due_at timestamptz;
create unique index approval_requests_source_unique_idx on public.approval_requests
  (organization_id, source_type, source_id) where source_id is not null;
create index approval_requests_pending_due_idx on public.approval_requests
  (organization_id, status, due_at) where status = 'pending';

alter table public.approval_workflow_definitions enable row level security;
alter table public.approval_workflow_nodes enable row level security;
create policy approval_workflow_definitions_org_read on public.approval_workflow_definitions for select to authenticated
using (organization_id = public.current_organization_id() and public.current_employee_id() is not null);
create policy approval_workflow_nodes_org_read on public.approval_workflow_nodes for select to authenticated
using (organization_id = public.current_organization_id() and public.current_employee_id() is not null);
revoke all on table public.approval_workflow_definitions from public,anon,authenticated;
revoke all on table public.approval_workflow_nodes from public,anon,authenticated;
grant select on table public.approval_workflow_definitions to authenticated;
grant select on table public.approval_workflow_nodes to authenticated;

insert into public.access_permissions(code,module,resource,action,name,description,risk_level,sort_order)
values ('system.approval_workflow.manage','system','approval_workflow','manage','管理审批流程','配置审批节点、条件与时限','high',280)
on conflict(code) do update set name=excluded.name,description=excluded.description,risk_level=excluded.risk_level,sort_order=excluded.sort_order;
insert into public.access_role_permissions(role_id,permission_id,effect,data_scope,field_access)
select role.id,permission.id,'allow','organization','full' from public.access_roles role
join public.access_permissions permission on permission.code='system.approval_workflow.manage'
where role.source_role_code in ('admin','chairman') on conflict(role_id,permission_id) do nothing;

insert into public.approval_workflow_definitions(organization_id,workflow_code,request_type,name,version,description)
select organization.id,'sales_order_standard','sales_order','销售订单确认审批',1,'直属负责人审批；订单金额达到 50000 元时追加董事长审批'
from public.organizations organization on conflict(organization_id,workflow_code,version) do nothing;
insert into public.approval_workflow_nodes(
  organization_id,workflow_definition_id,step_order,step_code,step_name,approver_type,approver_role_code,condition_rules,sla_hours
)
select definition.organization_id,definition.id,node.step_order,node.step_code,node.step_name,node.approver_type,node.role_code,node.rules,node.sla
from public.approval_workflow_definitions definition cross join (values
  (1,'manager_review','直属负责人审批','manager',null,'{}'::jsonb,24),
  (2,'chairman_review','董事长审批','role','chairman',jsonb_build_object('minAmount',50000),24)
) node(step_order,step_code,step_name,approver_type,role_code,rules,sla)
where definition.workflow_code='sales_order_standard' and definition.version=1
on conflict(workflow_definition_id,step_order) do nothing;

insert into public.approval_workflow_definitions(organization_id,workflow_code,request_type,name,version,description)
select organization.id,seed.code,seed.request_type,seed.name,1,seed.description from public.organizations organization cross join (values
  ('expense_standard','expense','费用报销审批','直属负责人、财务复核；超过 5000 元追加董事长审批'),
  ('seal_standard','seal','用印审批','直属负责人、重要用印董事长审批、行政用印登记')
) seed(code,request_type,name,description) on conflict(organization_id,workflow_code,version) do nothing;
insert into public.approval_workflow_nodes(organization_id,workflow_definition_id,step_order,step_code,step_name,approver_type,approver_role_code,condition_rules,sla_hours)
select definition.organization_id,definition.id,node.step_order,node.code,node.name,node.approver_type,node.role_code,node.rules,node.sla
from public.approval_workflow_definitions definition join lateral (values
  (1,'department_review','直属负责人审批','manager',null,'{}'::jsonb,24),
  (2,'finance_review','财务复核','role','finance','{}'::jsonb,24),
  (3,'chairman_approval','董事长审批','role','chairman',jsonb_build_object('minAmount',5000.01),24)
) node(step_order,code,name,approver_type,role_code,rules,sla) on definition.workflow_code='expense_standard'
on conflict(workflow_definition_id,step_order) do nothing;
insert into public.approval_workflow_nodes(organization_id,workflow_definition_id,step_order,step_code,step_name,approver_type,approver_role_code,condition_rules,sla_hours)
select definition.organization_id,definition.id,node.step_order,node.code,node.name,node.approver_type,node.role_code,node.rules,node.sla
from public.approval_workflow_definitions definition join lateral (values
  (1,'department_review','直属负责人审批','manager',null,'{}'::jsonb,24),
  (2,'chairman_approval','董事长审批','role','chairman',jsonb_build_object('contextEquals',jsonb_build_object('requiresChairman',true)),24),
  (3,'seal_custodian','行政用印登记','role','hr','{}'::jsonb,24)
) node(step_order,code,name,approver_type,role_code,rules,sla) on definition.workflow_code='seal_standard'
on conflict(workflow_definition_id,step_order) do nothing;

create or replace function public.approval_node_matches(p_rules jsonb,p_amount numeric,p_context jsonb)
returns boolean language sql immutable set search_path=public,pg_temp as $function$
  select (not (coalesce(p_rules,'{}'::jsonb) ? 'minAmount') or coalesce(p_amount,0) >= (p_rules->>'minAmount')::numeric)
    and (not (coalesce(p_rules,'{}'::jsonb) ? 'maxAmount') or coalesce(p_amount,0) <= (p_rules->>'maxAmount')::numeric)
    and (not (coalesce(p_rules,'{}'::jsonb) ? 'contextEquals')
      or coalesce(p_context,'{}'::jsonb) @> (p_rules->'contextEquals'))
$function$;

create or replace function public.start_approval_workflow_v2(
  p_request_type text,p_source_type text,p_source_id uuid,p_title text,p_summary text,p_amount_cny numeric,p_context jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype; v_definition public.approval_workflow_definitions%rowtype;
  v_node record; v_request_id uuid; v_request_no text; v_approver_id uuid; v_first_approver uuid;
  v_first_order integer; v_total integer:=0; v_due_at timestamptz;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null then raise exception '当前账号未绑定在职员工' using errcode='42501'; end if;
  if p_source_id is null or char_length(btrim(coalesce(p_title,'')))<2 or coalesce(p_amount_cny,0)<0
    then raise exception '审批申请参数无效' using errcode='22023'; end if;
  if p_request_type='sales_order' and (p_source_type<>'sales_order' or not exists(
    select 1 from public.sales_orders sales_order where sales_order.id=p_source_id
      and sales_order.organization_id=v_actor.organization_id
      and (sales_order.owner_employee_id=v_actor.id or public.can_manage_customers())
  )) then raise exception '无权为该销售订单发起审批' using errcode='42501';
  elsif p_request_type='expense' and p_source_type<>'expense_claim' then raise exception '报销审批来源无效' using errcode='22023';
  elsif p_request_type='seal' and p_source_type<>'seal_request' then raise exception '用印审批来源无效' using errcode='22023';
  elsif p_request_type not in ('sales_order','expense','seal') then raise exception '该申请类型尚未接入审批引擎 V2' using errcode='22023';end if;
  select * into v_definition from public.approval_workflow_definitions definition
  where definition.organization_id=v_actor.organization_id and definition.request_type=p_request_type and definition.status='active'
  order by definition.version desc limit 1;
  if v_definition.id is null then raise exception '未配置启用的审批流程' using errcode='23514'; end if;
  v_request_no:='DXA-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  insert into public.approval_requests(organization_id,request_no,request_type,title,summary,applicant_employee_id,
    status,current_step_order,total_steps,workflow_definition_id,source_type,source_id,amount_cny,context_data)
  values(v_actor.organization_id,v_request_no,p_request_type,btrim(p_title),nullif(btrim(coalesce(p_summary,'')),''),v_actor.id,
    'pending',1,1,v_definition.id,p_source_type,p_source_id,p_amount_cny,coalesce(p_context,'{}'::jsonb)) returning id into v_request_id;
  for v_node in select * from public.approval_workflow_nodes node where node.workflow_definition_id=v_definition.id
    and node.is_enabled and public.approval_node_matches(node.condition_rules,p_amount_cny,p_context) order by node.step_order loop
    if v_node.approver_type='manager' then v_approver_id:=v_actor.manager_id;
    elsif v_node.approver_type='role' then v_approver_id:=public.find_active_role_holder(v_actor.organization_id,v_node.approver_role_code);
    else v_approver_id:=v_node.approver_employee_id; end if;
    if v_approver_id is null or v_approver_id=v_actor.id then raise exception '审批节点 % 未配置有效且独立的处理人',v_node.step_name using errcode='23514'; end if;
    v_total:=v_total+1;
    if v_first_approver is null then v_first_approver:=v_approver_id;v_first_order:=v_total;v_due_at:=now()+make_interval(hours=>v_node.sla_hours);end if;
    insert into public.approval_steps(organization_id,approval_request_id,step_order,step_code,step_name,approver_employee_id,status,workflow_node_id,due_at)
    values(v_actor.organization_id,v_request_id,v_total,v_node.step_code,v_node.step_name,v_approver_id,
      case when v_total=1 then 'active' else 'pending' end,v_node.id,now()+make_interval(hours=>v_node.sla_hours));
  end loop;
  if v_total=0 then raise exception '审批流程没有可执行节点' using errcode='23514'; end if;
  update public.approval_requests set current_approver_employee_id=v_first_approver,current_step_order=v_first_order,total_steps=v_total,due_at=v_due_at where id=v_request_id;
  insert into public.approval_events(organization_id,approval_request_id,actor_employee_id,action,opinion,previous_status,next_status)
  values(v_actor.organization_id,v_request_id,v_actor.id,'submitted','通过统一审批引擎 V2 提交','draft','pending');
  return jsonb_build_object('id',v_request_id,'requestNo',v_request_no,'totalSteps',v_total);
end $function$;

create or replace function public.submit_expense_claim_v2(
  p_expense_category text,p_occurred_on date,p_amount numeric,p_vendor text,p_description text,p_has_invoice boolean default false,p_invoice_count integer default 0
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype;v_claim_id uuid:=gen_random_uuid();v_flow jsonb;v_request_id uuid;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null then raise exception '当前账号未绑定在职员工档案' using errcode='42501';end if;
  if p_expense_category not in ('travel','transport','hospitality','office','purchase','other') or p_occurred_on is null or p_occurred_on>current_date
    or p_amount is null or p_amount<=0 or p_amount>1000000 or char_length(btrim(coalesce(p_description,'')))<5
    or coalesce(p_invoice_count,0) not between 0 and 100 or (coalesce(p_has_invoice,false) and coalesce(p_invoice_count,0)=0)
    then raise exception '报销申请参数无效' using errcode='22023';end if;
  v_flow:=public.start_approval_workflow_v2('expense','expense_claim',v_claim_id,'费用报销',btrim(p_description),p_amount,
    jsonb_build_object('category',p_expense_category,'hasInvoice',coalesce(p_has_invoice,false)));
  v_request_id:=(v_flow->>'id')::uuid;
  insert into public.expense_claims(id,organization_id,approval_request_id,expense_category,occurred_on,amount,vendor,description,has_invoice,invoice_count)
  values(v_claim_id,v_actor.organization_id,v_request_id,p_expense_category,p_occurred_on,p_amount,nullif(btrim(coalesce(p_vendor,'')),''),btrim(p_description),coalesce(p_has_invoice,false),coalesce(p_invoice_count,0));
  return v_request_id;
end $function$;

create or replace function public.submit_seal_request_v2(
  p_seal_type text,p_use_date date,p_document_title text,p_purpose text,p_counterparty text,p_copies integer,
  p_is_external boolean,p_expected_return_on date,p_note text
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype;v_seal_id uuid:=gen_random_uuid();v_flow jsonb;v_request_id uuid;v_important boolean;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null then raise exception '当前账号未绑定在职员工档案' using errcode='42501';end if;
  if p_seal_type not in ('company','contract','finance','legal_representative','other') or p_use_date is null or p_use_date<current_date
    or char_length(btrim(coalesce(p_document_title,'')))<2 or char_length(btrim(coalesce(p_purpose,'')))<5
    or p_copies not between 1 and 100 or (coalesce(p_is_external,false) and p_expected_return_on is null)
    or (p_expected_return_on is not null and p_expected_return_on<p_use_date) then raise exception '用印申请参数无效' using errcode='22023';end if;
  v_important:=p_seal_type in ('company','contract','finance','legal_representative') or coalesce(p_is_external,false);
  v_flow:=public.start_approval_workflow_v2('seal','seal_request',v_seal_id,'用印申请',btrim(p_document_title)||' · '||btrim(p_purpose),0,
    jsonb_build_object('sealType',p_seal_type,'isExternal',coalesce(p_is_external,false),'requiresChairman',v_important));
  v_request_id:=(v_flow->>'id')::uuid;
  insert into public.seal_requests(id,organization_id,approval_request_id,seal_type,use_date,document_title,purpose,counterparty,copies,is_external,expected_return_on,note)
  values(v_seal_id,v_actor.organization_id,v_request_id,p_seal_type,p_use_date,btrim(p_document_title),btrim(p_purpose),nullif(btrim(coalesce(p_counterparty,'')),''),p_copies,coalesce(p_is_external,false),p_expected_return_on,nullif(btrim(coalesce(p_note,'')),''));
  return v_request_id;
end $function$;

create or replace function public.configure_approval_workflow_node(
  p_node_id uuid,p_is_enabled boolean,p_min_amount numeric,p_max_amount numeric,p_sla_hours integer
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor uuid:=public.current_employee_id();v_org uuid:=public.current_organization_id();v_rules jsonb;
begin
  if v_actor is null or not public.has_access_permission('system.approval_workflow.manage') then raise exception '缺少审批流程管理权限' using errcode='42501'; end if;
  select node.condition_rules-'minAmount'-'maxAmount' into v_rules from public.approval_workflow_nodes node
  where node.id=p_node_id and node.organization_id=v_org;
  if v_rules is null then raise exception '审批节点不存在' using errcode='P0002';end if;
  if p_sla_hours not between 1 and 720 or (p_min_amount is not null and p_min_amount<0)
    or (p_max_amount is not null and p_max_amount<p_min_amount) then raise exception '审批条件无效' using errcode='22023'; end if;
  if p_min_amount is not null then v_rules:=v_rules||jsonb_build_object('minAmount',p_min_amount);end if;
  if p_max_amount is not null then v_rules:=v_rules||jsonb_build_object('maxAmount',p_max_amount);end if;
  update public.approval_workflow_nodes set is_enabled=p_is_enabled,condition_rules=v_rules,sla_hours=p_sla_hours
  where id=p_node_id and organization_id=v_org;
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary,metadata)
  values(v_org,v_actor,'approval_workflow_node_configured','approval_workflow_node',p_node_id,'更新审批流程节点',v_rules);
  return p_node_id;
end $function$;

create or replace function public.refresh_approval_request_due_at()
returns trigger language plpgsql set search_path=public,pg_temp as $function$
declare v_sla integer;v_step_id uuid;
begin
  if new.status='pending' and (old.current_step_order is distinct from new.current_step_order or old.status is distinct from new.status) then
    select node.sla_hours,step.id into v_sla,v_step_id from public.approval_steps step
    left join public.approval_workflow_nodes node on node.id=step.workflow_node_id
    where step.approval_request_id=new.id and step.step_order=new.current_step_order;
    new.due_at:=now()+make_interval(hours=>coalesce(v_sla,24));
    update public.approval_steps set due_at=new.due_at where id=v_step_id;
  elsif new.status<>'pending' then new.due_at:=null;end if;
  return new;
end $function$;
create trigger approval_requests_refresh_due_at before update of status,current_step_order on public.approval_requests
for each row execute function public.refresh_approval_request_due_at();
revoke all on function public.refresh_approval_request_due_at() from public,anon,authenticated;

create or replace function public.preview_approval_workflow_v2(p_request_type text,p_amount_cny numeric,p_context jsonb default '{}'::jsonb)
returns table(step_order integer,step_name text,approver_name text,sla_hours integer)
language plpgsql stable security definer set search_path=public,pg_temp as $function$
declare v_actor public.employees%rowtype;v_definition_id uuid;v_node record;v_approver uuid;v_order integer:=0;
begin
  select * into v_actor from public.employees where id=public.current_employee_id() and status='active';
  if v_actor.id is null then raise exception '当前账号不可用' using errcode='42501';end if;
  select definition.id into v_definition_id from public.approval_workflow_definitions definition
  where definition.organization_id=v_actor.organization_id and definition.request_type=p_request_type and definition.status='active'
  order by definition.version desc limit 1;
  for v_node in select * from public.approval_workflow_nodes node where node.workflow_definition_id=v_definition_id and node.is_enabled
    and public.approval_node_matches(node.condition_rules,p_amount_cny,p_context) order by node.step_order loop
    if v_node.approver_type='manager' then v_approver:=v_actor.manager_id;
    elsif v_node.approver_type='role' then v_approver:=public.find_active_role_holder(v_actor.organization_id,v_node.approver_role_code);
    else v_approver:=v_node.approver_employee_id;end if;
    v_order:=v_order+1;step_order:=v_order;step_name:=v_node.step_name;sla_hours:=v_node.sla_hours;
    select employee.name into approver_name from public.employees employee where employee.id=v_approver;return next;
  end loop;
end $function$;

revoke all on function public.approval_node_matches(jsonb,numeric,jsonb) from public,anon;
revoke all on function public.start_approval_workflow_v2(text,text,uuid,text,text,numeric,jsonb) from public,anon;
revoke all on function public.submit_expense_claim_v2(text,date,numeric,text,text,boolean,integer) from public,anon;
revoke all on function public.submit_seal_request_v2(text,date,text,text,text,integer,boolean,date,text) from public,anon;
revoke all on function public.configure_approval_workflow_node(uuid,boolean,numeric,numeric,integer) from public,anon;
revoke all on function public.preview_approval_workflow_v2(text,numeric,jsonb) from public,anon;
grant execute on function public.submit_expense_claim_v2(text,date,numeric,text,text,boolean,integer) to authenticated;
grant execute on function public.submit_seal_request_v2(text,date,text,text,text,integer,boolean,date,text) to authenticated;
grant execute on function public.configure_approval_workflow_node(uuid,boolean,numeric,numeric,integer) to authenticated;
grant execute on function public.preview_approval_workflow_v2(text,numeric,jsonb) to authenticated;

commit;
