-- CRM quotation phase 2: controlled status transitions and event history.

begin;

create table if not exists public.sales_quote_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.sales_quotes(id) on delete cascade,
  from_status text
    check (from_status is null or from_status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  to_status text not null
    check (to_status in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
  note text,
  actor_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now()
);

create index if not exists sales_quote_events_quote_idx
  on public.sales_quote_events (quote_id, created_at);

insert into public.sales_quote_events (
  organization_id,
  quote_id,
  from_status,
  to_status,
  note,
  actor_employee_id,
  created_at
)
select
  quote.organization_id,
  quote.id,
  null,
  quote.status,
  '报价草稿创建',
  quote.created_by_employee_id,
  quote.created_at
from public.sales_quotes quote
where not exists (
  select 1
  from public.sales_quote_events event
  where event.quote_id = quote.id
);

create or replace function public.transition_sales_quote(
  p_quote_id uuid,
  p_target_status text,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_quote public.sales_quotes%rowtype;
  v_previous_status text;
begin
  select *
  into v_actor
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '只有销售、客服或系统管理员可以更新报价状态'
      using errcode = '42501';
  end if;

  if p_target_status not in ('sent', 'accepted', 'rejected', 'expired') then
    raise exception '目标状态无效' using errcode = '22023';
  end if;

  select *
  into v_quote
  from public.sales_quotes quote
  where quote.id = p_quote_id
    and quote.organization_id = v_actor.organization_id
  for update;

  if v_quote.id is null then
    raise exception '报价单不存在或无权访问'
      using errcode = '42501';
  end if;

  if not (
    (v_quote.status = 'draft' and p_target_status = 'sent')
    or (
      v_quote.status = 'sent'
      and p_target_status in ('accepted', 'rejected')
    )
    or (
      v_quote.status in ('draft', 'sent')
      and p_target_status = 'expired'
      and v_quote.valid_until < current_date
    )
  ) then
    raise exception '当前报价状态不能执行此操作'
      using errcode = '22023';
  end if;

  if p_target_status in ('accepted', 'rejected')
    and nullif(btrim(coalesce(p_note, '')), '') is null
  then
    raise exception '记录客户结果时必须填写说明'
      using errcode = '22023';
  end if;

  v_previous_status := v_quote.status;

  update public.sales_quotes
  set status = p_target_status
  where id = v_quote.id;

  insert into public.sales_quote_events (
    organization_id,
    quote_id,
    from_status,
    to_status,
    note,
    actor_employee_id
  )
  values (
    v_actor.organization_id,
    v_quote.id,
    v_previous_status,
    p_target_status,
    nullif(btrim(coalesce(p_note, '')), ''),
    v_actor.id
  );

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  )
  values (
    v_actor.organization_id,
    v_actor.id,
    'sales_quote_status_changed',
    'sales_quote',
    v_quote.id,
    '更新客户报价状态',
    jsonb_build_object(
      'quoteNo', v_quote.quote_no,
      'fromStatus', v_previous_status,
      'toStatus', p_target_status
    )
  );

  return jsonb_build_object(
    'id', v_quote.id,
    'quoteNo', v_quote.quote_no,
    'previousStatus', v_previous_status,
    'status', p_target_status
  );
end;
$function$;

alter table public.sales_quote_events enable row level security;

drop policy if exists "sales quote events visible with quote"
  on public.sales_quote_events;
create policy "sales quote events visible with quote"
on public.sales_quote_events for select
to authenticated
using (public.can_view_sales_quote(quote_id));

revoke all on table public.sales_quote_events from anon;
revoke insert, update, delete on table public.sales_quote_events
  from authenticated;
grant select on table public.sales_quote_events to authenticated;

revoke all on function public.transition_sales_quote(uuid, text, text)
  from public, anon;
grant execute on function public.transition_sales_quote(uuid, text, text)
  to authenticated;

comment on table public.sales_quote_events is
  'Immutable quotation status history for customer follow-up and audit.';

commit;
