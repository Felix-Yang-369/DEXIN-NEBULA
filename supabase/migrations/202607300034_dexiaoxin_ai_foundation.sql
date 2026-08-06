-- Dexiaoxin AI V0.1: private conversations, messages and retrieval audit.

begin;

create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  title text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  conversation_id uuid not null
    references public.ai_conversations(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  model text,
  sources jsonb not null default '[]'::jsonb,
  prompt_tokens integer,
  completion_tokens integer,
  duration_ms integer,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_tool_calls (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  conversation_id uuid not null
    references public.ai_conversations(id) on delete cascade,
  employee_id uuid not null
    references public.employees(id) on delete cascade,
  tool_name text not null,
  query_text text not null,
  result_count integer not null default 0 check (result_count >= 0),
  source_ids jsonb not null default '[]'::jsonb,
  duration_ms integer not null default 0 check (duration_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists ai_conversations_employee_updated_idx
  on public.ai_conversations(employee_id, updated_at desc);
create index if not exists ai_messages_conversation_created_idx
  on public.ai_messages(conversation_id, created_at);
create index if not exists ai_tool_calls_conversation_created_idx
  on public.ai_tool_calls(conversation_id, created_at);

drop trigger if exists ai_conversations_set_updated_at
  on public.ai_conversations;
create trigger ai_conversations_set_updated_at
before update on public.ai_conversations
for each row execute function public.set_updated_at();

alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;
alter table public.ai_tool_calls enable row level security;

drop policy if exists ai_conversations_own_select
  on public.ai_conversations;
create policy ai_conversations_own_select
on public.ai_conversations for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and employee_id = public.current_employee_id()
);

drop policy if exists ai_messages_own_select on public.ai_messages;
create policy ai_messages_own_select
on public.ai_messages for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and employee_id = public.current_employee_id()
);

drop policy if exists ai_tool_calls_own_select on public.ai_tool_calls;
create policy ai_tool_calls_own_select
on public.ai_tool_calls for select
to authenticated
using (
  organization_id = public.current_organization_id()
  and employee_id = public.current_employee_id()
);

create or replace function public.create_ai_conversation(p_title text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_conversation_id uuid;
begin
  select * into v_actor
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if v_actor.id is null then
    raise exception '当前账号未绑定在职员工'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_title, ''))) < 1
    or char_length(p_title) > 80
  then
    raise exception '对话标题无效' using errcode = '22023';
  end if;

  insert into public.ai_conversations (
    organization_id, employee_id, title
  ) values (
    v_actor.organization_id, v_actor.id, btrim(p_title)
  ) returning id into v_conversation_id;

  return v_conversation_id;
end;
$function$;

create or replace function public.record_ai_exchange(
  p_conversation_id uuid,
  p_user_content text,
  p_assistant_content text,
  p_model text,
  p_sources jsonb,
  p_prompt_tokens integer,
  p_completion_tokens integer,
  p_duration_ms integer,
  p_retrievals jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_assistant_message_id uuid;
  v_retrieval jsonb;
begin
  select * into v_actor
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if v_actor.id is null
    or not exists (
      select 1 from public.ai_conversations conversation
      where conversation.id = p_conversation_id
        and conversation.organization_id = v_actor.organization_id
        and conversation.employee_id = v_actor.id
        and conversation.status = 'active'
    )
  then
    raise exception '对话不存在或无权访问' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_user_content, ''))) < 1
    or char_length(p_user_content) > 2000
    or char_length(btrim(coalesce(p_assistant_content, ''))) < 1
    or char_length(p_assistant_content) > 12000
    or jsonb_typeof(coalesce(p_sources, '[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_retrievals, '[]'::jsonb)) <> 'array'
  then
    raise exception 'AI 对话记录参数无效' using errcode = '22023';
  end if;

  insert into public.ai_messages (
    organization_id, conversation_id, employee_id, role, content
  ) values (
    v_actor.organization_id, p_conversation_id, v_actor.id,
    'user', btrim(p_user_content)
  );

  insert into public.ai_messages (
    organization_id, conversation_id, employee_id, role, content,
    model, sources, prompt_tokens, completion_tokens, duration_ms
  ) values (
    v_actor.organization_id, p_conversation_id, v_actor.id,
    'assistant', btrim(p_assistant_content), nullif(btrim(p_model), ''),
    coalesce(p_sources, '[]'::jsonb),
    greatest(coalesce(p_prompt_tokens, 0), 0),
    greatest(coalesce(p_completion_tokens, 0), 0),
    greatest(coalesce(p_duration_ms, 0), 0)
  ) returning id into v_assistant_message_id;

  for v_retrieval in
    select value from jsonb_array_elements(coalesce(p_retrievals, '[]'::jsonb))
  loop
    insert into public.ai_tool_calls (
      organization_id, conversation_id, employee_id, tool_name,
      query_text, result_count, source_ids, duration_ms
    ) values (
      v_actor.organization_id, p_conversation_id, v_actor.id,
      left(coalesce(v_retrieval->>'toolName', 'unknown'), 80),
      left(coalesce(v_retrieval->>'queryText', ''), 1000),
      greatest(coalesce((v_retrieval->>'resultCount')::integer, 0), 0),
      case
        when jsonb_typeof(v_retrieval->'sourceIds') = 'array'
          then v_retrieval->'sourceIds'
        else '[]'::jsonb
      end,
      greatest(coalesce((v_retrieval->>'durationMs')::integer, 0), 0)
    );
  end loop;

  update public.ai_conversations
  set updated_at = now()
  where id = p_conversation_id;

  return v_assistant_message_id;
end;
$function$;

revoke all on table public.ai_conversations,
  public.ai_messages, public.ai_tool_calls from anon;
grant select on table public.ai_conversations,
  public.ai_messages, public.ai_tool_calls to authenticated;

revoke all on function public.create_ai_conversation(text)
  from public, anon;
revoke all on function public.record_ai_exchange(
  uuid, text, text, text, jsonb, integer, integer, integer, jsonb
) from public, anon;
grant execute on function public.create_ai_conversation(text)
  to authenticated;
grant execute on function public.record_ai_exchange(
  uuid, text, text, text, jsonb, integer, integer, integer, jsonb
) to authenticated;

comment on table public.ai_conversations is
  'Private Dexiaoxin conversations owned by the current employee.';
comment on table public.ai_messages is
  'User and assistant messages with source citations and token usage.';
comment on table public.ai_tool_calls is
  'Auditable retrieval activity performed for a Dexiaoxin answer.';

commit;
