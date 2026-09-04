-- Application performance telemetry, safe slow-query summaries, and hot-path indexes.

begin;

insert into public.access_permissions
  (code, module, resource, action, name, description, risk_level, sort_order)
values
  ('system.observability.view', 'system', 'observability', 'view', '查看性能中心', '查看接口延迟、错误率和慢查询摘要', 'sensitive', 70),
  ('system.observability.manage', 'system', 'observability', 'manage', '管理性能数据', '清理性能事件并维护观测策略', 'high', 80)
on conflict (code) do update set
  name = excluded.name, description = excluded.description,
  risk_level = excluded.risk_level, sort_order = excluded.sort_order;

insert into public.access_role_permissions (role_id, permission_id, effect, data_scope, field_access)
select role.id, permission.id, 'allow', 'organization',
  case when role.source_role_code = 'chairman' then 'read' else 'full' end
from public.access_roles role
join public.access_permissions permission
  on permission.code in ('system.observability.view', 'system.observability.manage')
where role.source_role_code = 'admin'
   or (role.source_role_code = 'chairman' and permission.code = 'system.observability.view')
on conflict (role_id, permission_id) do nothing;

create table public.application_performance_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid references public.employees(id) on delete set null,
  route text not null check (char_length(route) between 1 and 160),
  operation text not null check (char_length(operation) between 1 and 80),
  duration_ms numeric(12, 3) not null check (duration_ms >= 0 and duration_ms <= 600000),
  status text not null check (status in ('ok', 'error')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  occurred_at timestamptz not null default now()
);

create index application_performance_events_org_time_idx
  on public.application_performance_events (organization_id, occurred_at desc);
create index application_performance_events_slow_idx
  on public.application_performance_events (organization_id, duration_ms desc, occurred_at desc)
  where duration_ms >= 500;

-- Frequent personal-workspace, fulfillment and receivable access paths.
create index if not exists approval_requests_org_approver_pending_idx
  on public.approval_requests (organization_id, current_approver_employee_id, created_at desc)
  where status = 'pending';
create index if not exists notifications_org_recipient_unread_idx
  on public.notifications (organization_id, recipient_employee_id, created_at desc)
  where read_at is null;
create index if not exists sales_orders_org_owner_status_idx
  on public.sales_orders (organization_id, owner_employee_id, status, created_at desc);
create index if not exists finance_documents_org_customer_due_idx
  on public.finance_documents (organization_id, customer_id, document_type, status, due_date);
create index if not exists inventory_items_org_warning_idx
  on public.inventory_items (organization_id, available_quantity, safety_stock)
  where status = 'active';

alter table public.application_performance_events enable row level security;
create policy application_performance_events_select_authorized
on public.application_performance_events for select to authenticated
using (
  organization_id = public.current_organization_id()
  and public.has_access_permission('system.observability.view')
);
revoke all on table public.application_performance_events from public, anon, authenticated;
grant select on table public.application_performance_events to authenticated;

create or replace function public.record_performance_event(
  p_route text,
  p_operation text,
  p_duration_ms numeric,
  p_status text,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_employee uuid := public.current_employee_id();
begin
  if v_org is null or v_employee is null then return; end if;
  if char_length(p_route) not between 1 and 160
    or char_length(p_operation) not between 1 and 80
    or p_duration_ms not between 0 and 600000
    or p_status not in ('ok', 'error')
    or jsonb_typeof(coalesce(p_metadata, '{}'::jsonb)) <> 'object'
    or pg_column_size(coalesce(p_metadata, '{}'::jsonb)) > 4096 then
    raise exception '性能事件参数无效' using errcode = '22023';
  end if;
  -- Bound accidental client spam while retaining enough samples for diagnosis.
  if (select count(*) from public.application_performance_events
      where employee_id = v_employee and occurred_at >= now() - interval '1 hour') >= 300 then
    return;
  end if;
  insert into public.application_performance_events
    (organization_id, employee_id, route, operation, duration_ms, status, metadata)
  values (v_org, v_employee, p_route, p_operation, p_duration_ms, p_status, coalesce(p_metadata, '{}'::jsonb));
end;
$function$;

create or replace function public.performance_observability_summary(p_hours integer default 24)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
declare
  v_org uuid := public.current_organization_id();
  v_since timestamptz;
  v_result jsonb;
begin
  if v_org is null or not public.has_access_permission('system.observability.view') then
    raise exception '无权查看性能中心' using errcode = '42501';
  end if;
  p_hours := greatest(1, least(coalesce(p_hours, 24), 720));
  v_since := now() - make_interval(hours => p_hours);
  select jsonb_build_object(
    'hours', p_hours,
    'sampleCount', count(*),
    'averageMs', coalesce(round(avg(duration_ms), 1), 0),
    'p95Ms', coalesce(round(percentile_cont(0.95) within group (order by duration_ms)::numeric, 1), 0),
    'errorRate', coalesce(round(100.0 * count(*) filter (where status = 'error') / nullif(count(*), 0), 2), 0),
    'slowCount', count(*) filter (where duration_ms >= 500),
    'routes', coalesce((
      select jsonb_agg(to_jsonb(route_summary) order by route_summary.p95_ms desc)
      from (
        select route, operation, count(*) sample_count,
          round(avg(duration_ms), 1) average_ms,
          round(percentile_cont(0.95) within group (order by duration_ms)::numeric, 1) p95_ms,
          count(*) filter (where status = 'error') error_count,
          max(occurred_at) last_seen_at
        from public.application_performance_events
        where organization_id = v_org and occurred_at >= v_since
        group by route, operation order by p95_ms desc limit 20
      ) route_summary
    ), '[]'::jsonb)
  ) into v_result
  from public.application_performance_events
  where organization_id = v_org and occurred_at >= v_since;
  return v_result;
end;
$function$;

create or replace function public.database_slow_query_summary(p_limit integer default 20)
returns table (
  query_fingerprint text,
  calls bigint,
  mean_exec_ms numeric,
  total_exec_ms numeric,
  rows_returned bigint
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $function$
begin
  if not public.has_access_permission('system.observability.view') then
    raise exception '无权查看慢查询摘要' using errcode = '42501';
  end if;
  if to_regclass('extensions.pg_stat_statements') is null then return; end if;
  p_limit := greatest(1, least(coalesce(p_limit, 20), 50));
  return query execute format(
    'select md5(query)::text, calls::bigint, round(mean_exec_time::numeric, 2), round(total_exec_time::numeric, 2), rows::bigint
       from extensions.pg_stat_statements
      where dbid = (select oid from pg_database where datname = current_database())
      order by mean_exec_time desc limit %s', p_limit
  );
end;
$function$;

create or replace function public.prune_performance_events(p_retention_days integer default 30)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_count integer;
begin
  if not public.has_access_permission('system.observability.manage') then
    raise exception '无权清理性能数据' using errcode = '42501';
  end if;
  p_retention_days := greatest(7, least(coalesce(p_retention_days, 30), 365));
  delete from public.application_performance_events
  where organization_id = public.current_organization_id()
    and occurred_at < now() - make_interval(days => p_retention_days);
  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

revoke all on function public.record_performance_event(text, text, numeric, text, jsonb) from public, anon;
revoke all on function public.performance_observability_summary(integer) from public, anon;
revoke all on function public.database_slow_query_summary(integer) from public, anon;
revoke all on function public.prune_performance_events(integer) from public, anon;
grant execute on function public.record_performance_event(text, text, numeric, text, jsonb) to authenticated;
grant execute on function public.performance_observability_summary(integer) to authenticated;
grant execute on function public.database_slow_query_summary(integer) to authenticated;
grant execute on function public.prune_performance_events(integer) to authenticated;

commit;
