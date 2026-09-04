-- Customer service V2: public website assistant, human handoff and CRM lead pool.
begin;

create extension if not exists pgcrypto;

create table public.customer_service_workspaces (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9-]{2,47}$'),
  name text not null,
  assistant_name text not null default '德小馨',
  assistant_avatar_url text,
  channel text not null default 'website' check (channel in ('website')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  allowed_origins text[] not null default array[]::text[],
  theme jsonb not null default '{"primary":"#07503d","accent":"#c8a45d","surface":"#f7faf8"}'::jsonb,
  welcome_message text not null default '你好，我是德小馨。可以向我咨询产品、企业采购、福利礼赠和配送服务。',
  quick_questions text[] not null default array['你们主要提供哪些服务？','企业采购粮油如何获取报价？','是否提供员工福利和礼赠方案？'],
  business_hours jsonb not null default '{"timezone":"Asia/Shanghai","weekdays":[1,2,3,4,5],"start":"09:00","end":"18:00"}'::jsonb,
  wecom_notifications_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, code)
);

create table public.customer_service_visitors (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.customer_service_workspaces(id) on delete cascade,
  public_id_hash text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  first_page_url text,
  last_page_url text,
  user_agent_family text,
  anonymized_at timestamptz,
  unique (workspace_id, public_id_hash)
);

create table public.customer_service_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.customer_service_workspaces(id) on delete cascade,
  visitor_id uuid not null references public.customer_service_visitors(id) on delete cascade,
  status text not null default 'ai_active' check (status in ('ai_active','waiting_human','human_active','closed')),
  assigned_employee_id uuid references public.employees(id) on delete set null,
  subject text,
  source_page_url text,
  requested_human_at timestamptz,
  first_human_response_at timestamptz,
  closed_at timestamptz,
  last_message_at timestamptz not null default now(),
  last_visitor_message_at timestamptz,
  last_employee_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.customer_service_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_service_conversations(id) on delete cascade,
  sequence_no bigint generated always as identity,
  sender_type text not null check (sender_type in ('visitor','assistant','employee','system')),
  sender_employee_id uuid references public.employees(id) on delete set null,
  content text not null check (char_length(content) between 1 and 6000),
  source_refs jsonb not null default '[]'::jsonb,
  model text,
  confidence numeric(5,4),
  needs_human boolean not null default false,
  created_at timestamptz not null default now(),
  unique (conversation_id, sequence_no)
);

create table public.customer_service_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  workspace_id uuid not null references public.customer_service_workspaces(id) on delete cascade,
  conversation_id uuid not null references public.customer_service_conversations(id) on delete cascade,
  name text not null,
  phone text not null,
  normalized_phone text not null,
  company text,
  city text,
  business_type text,
  requested_products text,
  expected_volume text,
  procurement_timeline text,
  notes text,
  status text not null default 'new' check (status in ('new','following','qualified','converted','closed')),
  level text not null default 'B' check (level in ('A','B','C')),
  handler_employee_id uuid references public.employees(id) on delete set null,
  consent_at timestamptz not null,
  converted_customer_id uuid references public.customers(id) on delete set null,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (conversation_id)
);

create table public.customer_service_lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.customer_service_leads(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  activity_type text not null check (activity_type in ('created','note','status','converted')),
  content text not null,
  created_at timestamptz not null default now()
);

create table public.customer_service_knowledge_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.customer_service_workspaces(id) on delete cascade,
  title text not null,
  content text not null,
  source_url text,
  keywords text[] not null default array[]::text[],
  status text not null default 'draft' check (status in ('draft','published','inactive')),
  version integer not null default 1 check (version > 0),
  published_at timestamptz,
  created_by_employee_id uuid references public.employees(id) on delete set null,
  updated_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, title)
);

create table public.customer_service_knowledge_versions (
  id uuid primary key default gen_random_uuid(),
  knowledge_item_id uuid not null references public.customer_service_knowledge_items(id) on delete cascade,
  version integer not null,
  title text not null,
  content text not null,
  source_url text,
  keywords text[] not null default array[]::text[],
  status text not null,
  changed_by_employee_id uuid references public.employees(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (knowledge_item_id, version)
);

create table public.customer_service_unanswered_questions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.customer_service_workspaces(id) on delete cascade,
  conversation_id uuid references public.customer_service_conversations(id) on delete set null,
  message_id uuid references public.customer_service_messages(id) on delete set null,
  question text not null,
  reason text not null check (reason in ('no_knowledge','low_confidence','human_requested','negative_feedback')),
  status text not null default 'open' check (status in ('open','resolved','ignored')),
  resolved_by_employee_id uuid references public.employees(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.customer_service_session_tokens (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.customer_service_workspaces(id) on delete cascade,
  visitor_id uuid not null references public.customer_service_visitors(id) on delete cascade,
  conversation_id uuid not null references public.customer_service_conversations(id) on delete cascade,
  token_hash text not null unique,
  origin text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.customer_service_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.customer_service_conversations(id) on delete cascade,
  recipient_employee_id uuid references public.employees(id) on delete set null,
  channel text not null check (channel in ('in_app','wecom')),
  status text not null check (status in ('pending','sent','failed','skipped')),
  error_code text,
  created_at timestamptz not null default now()
);

create index customer_service_conversations_queue_idx on public.customer_service_conversations (organization_id, status, last_message_at desc);
create index customer_service_messages_cursor_idx on public.customer_service_messages (conversation_id, sequence_no);
create index customer_service_leads_pool_idx on public.customer_service_leads (organization_id, status, created_at desc);
create index customer_service_knowledge_published_idx on public.customer_service_knowledge_items (workspace_id, status, updated_at desc);
create index customer_service_tokens_expiry_idx on public.customer_service_session_tokens (token_hash, expires_at) where revoked_at is null;

create trigger customer_service_workspaces_set_updated_at before update on public.customer_service_workspaces for each row execute function public.set_updated_at();
create trigger customer_service_conversations_set_updated_at before update on public.customer_service_conversations for each row execute function public.set_updated_at();
create trigger customer_service_leads_set_updated_at before update on public.customer_service_leads for each row execute function public.set_updated_at();
create trigger customer_service_knowledge_set_updated_at before update on public.customer_service_knowledge_items for each row execute function public.set_updated_at();

alter table public.notifications drop constraint if exists notifications_notification_type_check;
alter table public.notifications add constraint notifications_notification_type_check check (notification_type in ('approval_pending','request_updated','system','customer_service'));

insert into public.access_permissions (code,module,resource,action,name,description,risk_level,sort_order) values
  ('customer_service.dashboard.view','customer_service','dashboard','view','查看客服看板','查看客服运营指标','normal',500),
  ('customer_service.conversation.view','customer_service','conversation','view','查看客服会话','查看组织客服会话','sensitive',510),
  ('customer_service.conversation.reply','customer_service','conversation','reply','回复客服会话','认领并回复客户','sensitive',520),
  ('customer_service.conversation.transfer','customer_service','conversation','transfer','转交客服会话','转交或释放客服会话','sensitive',530),
  ('customer_service.lead.view','customer_service','lead','view','查看客服线索','查看客服留资','sensitive',540),
  ('customer_service.lead.manage','customer_service','lead','manage','管理客服线索','更新线索状态和跟进记录','sensitive',550),
  ('customer_service.lead.convert','customer_service','lead','convert','转换 CRM 客户','将客服线索去重后转为 CRM 客户','high',560),
  ('customer_service.knowledge.view','customer_service','knowledge','view','查看客服知识','查看公开客服知识','normal',570),
  ('customer_service.knowledge.publish','customer_service','knowledge','publish','发布客服知识','发布影响公开 AI 回答的知识','high',580),
  ('customer_service.settings.manage','customer_service','settings','manage','管理客服设置','管理站点、助手与通知设置','high',590),
  ('customer_service.export.run','customer_service','export','run','导出客服数据','导出授权范围内客服记录','sensitive',600)
on conflict (code) do update set name=excluded.name,description=excluded.description,risk_level=excluded.risk_level,sort_order=excluded.sort_order;

insert into public.access_roles (organization_id,code,name,description,is_system)
select organization.id, seed.code, seed.name, seed.description, false
from public.organizations organization
cross join (values
  ('customer_service_agent','客服坐席','客服会话、线索查看与跟进'),
  ('customer_service_manager','客服主管','客服运营、知识、设置与 CRM 转换')
) seed(code,name,description)
on conflict (organization_id,code) do nothing;

insert into public.access_role_permissions (role_id,permission_id,effect,data_scope,field_access)
select role.id, permission.id, 'allow', 'organization', 'full'
from public.access_roles role
join public.access_permissions permission on permission.module='customer_service'
where role.code='customer_service_manager'
on conflict do nothing;

insert into public.access_role_permissions (role_id,permission_id,effect,data_scope,field_access)
select role.id, permission.id, 'allow', 'organization', 'full'
from public.access_roles role
join public.access_permissions permission on permission.code in (
  'customer_service.dashboard.view','customer_service.conversation.view','customer_service.conversation.reply',
  'customer_service.lead.view','customer_service.lead.manage','customer_service.knowledge.view'
)
where role.code='customer_service_agent'
on conflict do nothing;

insert into public.access_role_permissions (role_id,permission_id,effect,data_scope,field_access)
select role.id, permission.id, 'allow', 'organization', 'full'
from public.access_roles role
join public.access_permissions permission on permission.module='customer_service'
where role.source_role_code in ('admin','chairman')
on conflict do nothing;

insert into public.customer_service_workspaces (organization_id,code,name,assistant_name,allowed_origins)
select id,'dexin-miaosheng','德馨淼盛官网','德小馨',array['https://dexinmiaosheng.cn','https://www.dexinmiaosheng.cn','http://localhost:3000','http://localhost:3001']
from public.organizations
order by created_at
limit 1
on conflict (organization_id,code) do nothing;

insert into public.customer_service_knowledge_items (workspace_id,title,content,source_url,keywords,status,published_at)
select workspace.id, seed.title, seed.content, seed.source_url, seed.keywords, 'published', now()
from public.customer_service_workspaces workspace
cross join (values
  ('主要服务','德馨淼盛主要提供大米、食用油及相关食品的企业采购与餐饮供应服务，并围绕员工福利、企业礼赠、仓储履约和供应链协同提供配套方案。','https://dexinmiaosheng.cn/solutions/',array['服务','业务','采购','粮油']),
  ('企业采购与报价','请提供产品用途、预计数量、预算区间、交付时间和配送区域。德馨淼盛会结合当期产品和供应条件沟通可执行的产品组合与书面报价。库存、交期和最终成交价需由人工确认。','https://dexinmiaosheng.cn/contact/',array['报价','采购','价格','数量']),
  ('福利与礼赠方案','可以根据节日、人数、预算和交付时间，组合大米、食用油、伴手礼或企业礼盒，并沟通包装、分装与多点配送需求。','https://dexinmiaosheng.cn/solutions/',array['福利','礼赠','礼盒','节日']),
  ('配送与交付','配送范围、到货时间和费用需要根据产品库存、采购数量、收货地点及点位数量综合确认，不对未经人工确认的交期做承诺。','https://dexinmiaosheng.cn/contact/',array['配送','交付','到货','运费']),
  ('联系德馨淼盛','业务咨询电话：133 1954 8832；邮箱：yanglinjie@dxmstech.cn；地址：湖南省长沙市国际企业中心北区15栋6楼。到访前建议提前预约。','https://dexinmiaosheng.cn/contact/',array['联系','电话','邮箱','地址'])
) seed(title,content,source_url,keywords)
where workspace.code='dexin-miaosheng'
on conflict (workspace_id,title) do nothing;

-- Authenticated employees only; public traffic is mediated by server routes using the service role.
alter table public.customer_service_workspaces enable row level security;
alter table public.customer_service_visitors enable row level security;
alter table public.customer_service_conversations enable row level security;
alter table public.customer_service_messages enable row level security;
alter table public.customer_service_leads enable row level security;
alter table public.customer_service_lead_activities enable row level security;
alter table public.customer_service_knowledge_items enable row level security;
alter table public.customer_service_knowledge_versions enable row level security;
alter table public.customer_service_unanswered_questions enable row level security;
alter table public.customer_service_session_tokens enable row level security;
alter table public.customer_service_notification_deliveries enable row level security;

create policy customer_service_workspaces_employee_read on public.customer_service_workspaces for select to authenticated using (organization_id=public.current_organization_id() and public.has_access_permission('customer_service.dashboard.view'));
create policy customer_service_conversations_employee_read on public.customer_service_conversations for select to authenticated using (organization_id=public.current_organization_id() and public.has_access_permission('customer_service.conversation.view'));
create policy customer_service_messages_employee_read on public.customer_service_messages for select to authenticated using (exists(select 1 from public.customer_service_conversations c where c.id=conversation_id and c.organization_id=public.current_organization_id()) and public.has_access_permission('customer_service.conversation.view'));
create policy customer_service_leads_employee_read on public.customer_service_leads for select to authenticated using (organization_id=public.current_organization_id() and public.has_access_permission('customer_service.lead.view'));
create policy customer_service_lead_activities_employee_read on public.customer_service_lead_activities for select to authenticated using (exists(select 1 from public.customer_service_leads l where l.id=lead_id and l.organization_id=public.current_organization_id()) and public.has_access_permission('customer_service.lead.view'));
create policy customer_service_knowledge_employee_read on public.customer_service_knowledge_items for select to authenticated using (exists(select 1 from public.customer_service_workspaces w where w.id=workspace_id and w.organization_id=public.current_organization_id()) and public.has_access_permission('customer_service.knowledge.view'));
create policy customer_service_knowledge_versions_employee_read on public.customer_service_knowledge_versions for select to authenticated using (exists(select 1 from public.customer_service_knowledge_items k join public.customer_service_workspaces w on w.id=k.workspace_id where k.id=knowledge_item_id and w.organization_id=public.current_organization_id()) and public.has_access_permission('customer_service.knowledge.view'));
create policy customer_service_unanswered_employee_read on public.customer_service_unanswered_questions for select to authenticated using (exists(select 1 from public.customer_service_workspaces w where w.id=workspace_id and w.organization_id=public.current_organization_id()) and public.has_access_permission('customer_service.knowledge.view'));

revoke all on table public.customer_service_workspaces,public.customer_service_visitors,public.customer_service_conversations,public.customer_service_messages,public.customer_service_leads,public.customer_service_lead_activities,public.customer_service_knowledge_items,public.customer_service_knowledge_versions,public.customer_service_unanswered_questions,public.customer_service_session_tokens,public.customer_service_notification_deliveries from public,anon,authenticated;
grant select on table public.customer_service_workspaces,public.customer_service_conversations,public.customer_service_messages,public.customer_service_leads,public.customer_service_lead_activities,public.customer_service_knowledge_items,public.customer_service_knowledge_versions,public.customer_service_unanswered_questions to authenticated;

create or replace function public.customer_service_reply(p_conversation_id uuid,p_content text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor uuid:=public.current_employee_id();v_org uuid:=public.current_organization_id();v_message_id uuid;v_assigned uuid;
begin
  if v_actor is null or not public.has_access_permission('customer_service.conversation.reply') then raise exception '无权回复客服会话' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_content,''))) not between 1 and 3000 then raise exception '回复内容无效' using errcode='22023'; end if;
  select assigned_employee_id into v_assigned from public.customer_service_conversations where id=p_conversation_id and organization_id=v_org and status<>'closed' for update;
  if not found then raise exception '会话不存在或已结束' using errcode='P0002'; end if;
  if v_assigned is not null and v_assigned<>v_actor then raise exception '会话已被其他客服认领' using errcode='23514'; end if;
  update public.customer_service_conversations set assigned_employee_id=v_actor,status='human_active',first_human_response_at=coalesce(first_human_response_at,now()),last_employee_message_at=now(),last_message_at=now() where id=p_conversation_id;
  update public.customer_service_leads set handler_employee_id=coalesce(handler_employee_id,v_actor),status=case when status='new' then 'following' else status end where conversation_id=p_conversation_id;
  insert into public.customer_service_messages(conversation_id,sender_type,sender_employee_id,content) values(p_conversation_id,'employee',v_actor,btrim(p_content)) returning id into v_message_id;
  return v_message_id;
end;$function$;

create or replace function public.customer_service_transfer(p_conversation_id uuid,p_employee_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor uuid:=public.current_employee_id();v_org uuid:=public.current_organization_id();
begin
  if v_actor is null or not public.has_access_permission('customer_service.conversation.transfer') then raise exception '无权转交会话' using errcode='42501'; end if;
  if p_employee_id is not null and not exists(select 1 from public.employees where id=p_employee_id and organization_id=v_org and status='active') then raise exception '目标员工无效' using errcode='22023'; end if;
  update public.customer_service_conversations set assigned_employee_id=p_employee_id,status=case when p_employee_id is null then 'waiting_human' else 'human_active' end where id=p_conversation_id and organization_id=v_org and (assigned_employee_id=v_actor or public.has_org_role('admin') or public.has_org_role('chairman')) and status<>'closed';
  if not found then raise exception '会话不存在或无权转交' using errcode='42501'; end if;
end;$function$;

create or replace function public.customer_service_close(p_conversation_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor uuid:=public.current_employee_id();v_org uuid:=public.current_organization_id();
begin
  if v_actor is null or not public.has_access_permission('customer_service.conversation.reply') then raise exception '无权结束会话' using errcode='42501'; end if;
  update public.customer_service_conversations set status='closed',closed_at=now() where id=p_conversation_id and organization_id=v_org and (assigned_employee_id is null or assigned_employee_id=v_actor or public.has_org_role('admin') or public.has_org_role('chairman'));
  if not found then raise exception '会话不存在或无权结束' using errcode='42501'; end if;
  insert into public.customer_service_messages(conversation_id,sender_type,content) values(p_conversation_id,'system','人工客服已结束本次会话');
end;$function$;

create or replace function public.customer_service_update_lead(p_lead_id uuid,p_status text,p_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor uuid:=public.current_employee_id();v_org uuid:=public.current_organization_id();
begin
  if v_actor is null or not public.has_access_permission('customer_service.lead.manage') then raise exception '无权管理线索' using errcode='42501'; end if;
  if p_status not in ('new','following','qualified','closed') then raise exception '线索状态无效' using errcode='22023'; end if;
  update public.customer_service_leads set status=p_status,handler_employee_id=coalesce(handler_employee_id,v_actor) where id=p_lead_id and organization_id=v_org and converted_customer_id is null;
  if not found then raise exception '线索不存在或已转换' using errcode='P0002'; end if;
  insert into public.customer_service_lead_activities(lead_id,employee_id,activity_type,content) values(p_lead_id,v_actor,case when nullif(btrim(coalesce(p_note,'')),'') is null then 'status' else 'note' end,coalesce(nullif(btrim(p_note),''),'线索状态更新为 '||p_status));
end;$function$;

create or replace function public.customer_service_save_knowledge(p_workspace_id uuid,p_item_id uuid,p_title text,p_content text,p_source_url text,p_keywords text[],p_status text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor uuid:=public.current_employee_id();v_org uuid:=public.current_organization_id();v_id uuid;v_version integer;
begin
  if v_actor is null or not public.has_access_permission('customer_service.knowledge.publish') then raise exception '无权发布客服知识' using errcode='42501'; end if;
  if p_status not in ('draft','published','inactive') or char_length(btrim(coalesce(p_title,''))) not between 2 and 120 or char_length(btrim(coalesce(p_content,''))) not between 10 and 6000 then raise exception '知识内容无效' using errcode='22023'; end if;
  if not exists(select 1 from public.customer_service_workspaces where id=p_workspace_id and organization_id=v_org) then raise exception '客服工作空间无效' using errcode='42501'; end if;
  if p_item_id is null then
    insert into public.customer_service_knowledge_items(workspace_id,title,content,source_url,keywords,status,published_at,created_by_employee_id,updated_by_employee_id) values(p_workspace_id,btrim(p_title),btrim(p_content),nullif(btrim(coalesce(p_source_url,'')),''),coalesce(p_keywords,array[]::text[]),p_status,case when p_status='published' then now() end,v_actor,v_actor) returning id,version into v_id,v_version;
  else
    update public.customer_service_knowledge_items set title=btrim(p_title),content=btrim(p_content),source_url=nullif(btrim(coalesce(p_source_url,'')),''),keywords=coalesce(p_keywords,array[]::text[]),status=p_status,version=version+1,published_at=case when p_status='published' then now() else published_at end,updated_by_employee_id=v_actor where id=p_item_id and workspace_id=p_workspace_id returning id,version into v_id,v_version;
    if v_id is null then raise exception '知识条目不存在' using errcode='P0002'; end if;
  end if;
  insert into public.customer_service_knowledge_versions(knowledge_item_id,version,title,content,source_url,keywords,status,changed_by_employee_id) values(v_id,v_version,btrim(p_title),btrim(p_content),nullif(btrim(coalesce(p_source_url,'')),''),coalesce(p_keywords,array[]::text[]),p_status,v_actor);
  return v_id;
end;$function$;

create or replace function public.customer_service_update_workspace(p_workspace_id uuid,p_assistant_name text,p_welcome_message text,p_quick_questions text[],p_business_hours jsonb,p_wecom_enabled boolean)
returns void language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_org uuid:=public.current_organization_id();
begin
  if not public.has_access_permission('customer_service.settings.manage') then raise exception '无权管理客服设置' using errcode='42501'; end if;
  if char_length(btrim(coalesce(p_assistant_name,''))) not between 2 and 30 or char_length(btrim(coalesce(p_welcome_message,''))) not between 10 and 500 or coalesce(cardinality(p_quick_questions),0) not between 1 and 8 then raise exception '客服设置无效' using errcode='22023'; end if;
  update public.customer_service_workspaces set assistant_name=btrim(p_assistant_name),welcome_message=btrim(p_welcome_message),quick_questions=p_quick_questions,business_hours=p_business_hours,wecom_notifications_enabled=p_wecom_enabled where id=p_workspace_id and organization_id=v_org;
  if not found then raise exception '客服工作空间不存在' using errcode='P0002'; end if;
end;$function$;

create or replace function public.convert_customer_service_lead(p_lead_id uuid)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_actor uuid:=public.current_employee_id();v_org uuid:=public.current_organization_id();v_lead public.customer_service_leads%rowtype;v_customer_id uuid;v_customer_no text;
begin
  if v_actor is null or not public.has_access_permission('customer_service.lead.convert') then raise exception '无权转换客户' using errcode='42501'; end if;
  select * into v_lead from public.customer_service_leads where id=p_lead_id and organization_id=v_org for update;
  if not found then raise exception '线索不存在' using errcode='P0002'; end if;
  if v_lead.converted_customer_id is not null then return v_lead.converted_customer_id; end if;
  select contact.customer_id into v_customer_id from public.customer_contacts contact where contact.organization_id=v_org and regexp_replace(coalesce(contact.phone,''),'\\D','','g')=v_lead.normalized_phone limit 1;
  if v_customer_id is null and nullif(btrim(coalesce(v_lead.company,'')),'') is not null then select id into v_customer_id from public.customers where organization_id=v_org and lower(btrim(name))=lower(btrim(v_lead.company)) limit 1; end if;
  if v_customer_id is null then
    v_customer_no:='DXC-'||to_char(clock_timestamp(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    insert into public.customers(organization_id,customer_no,name,customer_type,level,status,source,region,tags,owner_employee_id,note,created_by_employee_id,pool_status,pool_entered_at)
    values(v_org,v_customer_no,coalesce(nullif(btrim(v_lead.company),''),btrim(v_lead.name)||'的采购线索'),case when v_lead.business_type in ('catering','gift','distributor','enterprise','other') then v_lead.business_type else 'enterprise' end,v_lead.level,'lead','官网客服',nullif(v_lead.city,''),array['官网客服'],null,concat_ws(E'\n',v_lead.requested_products,v_lead.expected_volume,v_lead.procurement_timeline,v_lead.notes),v_actor,'public_pool',now()) returning id into v_customer_id;
    insert into public.customer_contacts(organization_id,customer_id,name,phone,is_primary) values(v_org,v_customer_id,v_lead.name,v_lead.phone,true);
  else
    insert into public.customer_followups(organization_id,customer_id,followup_type,summary,created_by_employee_id) values(v_org,v_customer_id,'other','官网客服线索已关联：'||coalesce(v_lead.requested_products,'未填写具体需求'),v_actor);
  end if;
  update public.customer_service_leads set converted_customer_id=v_customer_id,converted_at=now(),status='converted',handler_employee_id=coalesce(handler_employee_id,v_actor) where id=p_lead_id;
  insert into public.customer_service_lead_activities(lead_id,employee_id,activity_type,content) values(p_lead_id,v_actor,'converted','已转为 CRM 客户');
  insert into public.audit_logs(organization_id,actor_employee_id,action,entity_type,entity_id,summary,metadata) values(v_org,v_actor,'customer_service_lead_converted','customer_service_lead',p_lead_id,'官网客服线索转为 CRM 客户',jsonb_build_object('customerId',v_customer_id));
  return v_customer_id;
end;$function$;

create or replace function public.anonymize_expired_customer_service_data()
returns integer language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_count integer;
begin
  update public.customer_service_messages message set content='[内容已按保留策略清除]',source_refs='[]'::jsonb
  from public.customer_service_conversations conversation
  where message.conversation_id=conversation.id and conversation.created_at<now()-interval '365 days' and message.content<>'[内容已按保留策略清除]';
  update public.customer_service_leads set name='已匿名访客',phone='[removed]',normalized_phone=encode(digest(id::text,'sha256'),'hex'),company=null,city=null,requested_products=null,expected_volume=null,procurement_timeline=null,notes=null
  where created_at<now()-interval '365 days' and converted_customer_id is null;
  get diagnostics v_count=row_count;
  update public.customer_service_visitors visitor set public_id_hash=encode(digest(visitor.id::text,'sha256'),'hex'),first_page_url=null,last_page_url=null,user_agent_family=null,anonymized_at=now()
  where visitor.first_seen_at<now()-interval '365 days' and visitor.anonymized_at is null;
  return v_count;
end;$function$;

revoke all on function public.customer_service_reply(uuid,text),public.customer_service_transfer(uuid,uuid),public.customer_service_close(uuid),public.customer_service_update_lead(uuid,text,text),public.customer_service_save_knowledge(uuid,uuid,text,text,text,text[],text),public.customer_service_update_workspace(uuid,text,text,text[],jsonb,boolean),public.convert_customer_service_lead(uuid) from public,anon;
grant execute on function public.customer_service_reply(uuid,text),public.customer_service_transfer(uuid,uuid),public.customer_service_close(uuid),public.customer_service_update_lead(uuid,text,text),public.customer_service_save_knowledge(uuid,uuid,text,text,text,text[],text),public.customer_service_update_workspace(uuid,text,text,text[],jsonb,boolean),public.convert_customer_service_lead(uuid) to authenticated;
revoke all on function public.anonymize_expired_customer_service_data() from public,anon,authenticated;

do $block$
begin
  if exists(select 1 from pg_available_extensions where name='pg_cron') then
    create extension if not exists pg_cron;
    if not exists(select 1 from cron.job where jobname='customer-service-retention') then
      perform cron.schedule('customer-service-retention','17 3 * * *','select public.anonymize_expired_customer_service_data()');
    end if;
  end if;
end;$block$;

commit;
