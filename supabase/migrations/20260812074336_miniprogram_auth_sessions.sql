-- WeChat Mini Program identities and opaque, revocable API sessions.
-- These tables are server-only: RLS is enabled and no client role receives grants.

begin;

create table public.miniprogram_identities (
  id uuid primary key default gen_random_uuid(),
  app_id text not null check (char_length(btrim(app_id)) between 6 and 64),
  open_id text not null check (char_length(btrim(open_id)) between 6 and 128),
  union_id text check (union_id is null or char_length(btrim(union_id)) between 6 and 128),
  employee_id uuid references public.employees(id) on delete set null,
  display_name text not null default '微信用户'
    check (char_length(btrim(display_name)) between 1 and 80),
  status text not null default 'active'
    check (status in ('active', 'blocked')),
  last_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (app_id, open_id),
  unique (app_id, employee_id)
);

create unique index miniprogram_identities_app_union_unique
  on public.miniprogram_identities (app_id, union_id)
  where union_id is not null;

create index miniprogram_identities_employee_idx
  on public.miniprogram_identities (employee_id)
  where employee_id is not null;

create table public.miniprogram_sessions (
  id uuid primary key default gen_random_uuid(),
  identity_id uuid not null
    references public.miniprogram_identities(id) on delete cascade,
  token_hash text not null unique
    check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index miniprogram_sessions_identity_active_idx
  on public.miniprogram_sessions (identity_id, expires_at desc)
  where revoked_at is null;

create index miniprogram_sessions_expiry_idx
  on public.miniprogram_sessions (expires_at)
  where revoked_at is null;

create trigger miniprogram_identities_set_updated_at
before update on public.miniprogram_identities
for each row execute function public.set_updated_at();

alter table public.miniprogram_identities enable row level security;
alter table public.miniprogram_sessions enable row level security;

revoke all on table public.miniprogram_identities
from public, anon, authenticated;
revoke all on table public.miniprogram_sessions
from public, anon, authenticated;

grant select, insert, update, delete
on table public.miniprogram_identities to service_role;
grant select, insert, update, delete
on table public.miniprogram_sessions to service_role;

comment on table public.miniprogram_identities is
  '微信小程序 OpenID 身份。员工绑定需由可信后台流程完成，不能信任客户端角色声明。';
comment on table public.miniprogram_sessions is
  '微信小程序短期 API 会话，仅保存令牌 SHA-256 哈希，支持过期和主动撤销。';

commit;
