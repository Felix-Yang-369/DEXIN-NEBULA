begin;

create table public.employee_auth_identities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  provider text not null check (provider in ('wecom')),
  provider_subject text not null check (char_length(btrim(provider_subject)) between 1 and 128),
  provider_display_name text,
  bound_at timestamptz not null default now(),
  last_login_at timestamptz,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  unique (provider, provider_subject),
  unique (employee_id, provider)
);

create index employee_auth_identities_org_idx
  on public.employee_auth_identities (organization_id, provider, last_login_at desc);

alter table public.employee_auth_identities enable row level security;

create policy employee_auth_identities_authorized_read
on public.employee_auth_identities for select to authenticated
using (
  organization_id = public.current_organization_id()
  and (
    employee_id = public.current_employee_id()
    or public.has_org_role('admin')
  )
);

revoke all on table public.employee_auth_identities from public, anon, authenticated;
grant select on table public.employee_auth_identities to authenticated;

create or replace function public.resolve_wecom_login(
  p_wecom_user_id text,
  p_member_emails text[],
  p_member_name text default null
)
returns table (
  resolved_identity_id uuid,
  resolved_employee_id uuid,
  resolved_auth_user_id uuid,
  resolved_email text,
  was_bound boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_subject text := btrim(coalesce(p_wecom_user_id, ''));
  v_employee public.employees%rowtype;
  v_identity_id uuid;
  v_candidate_ids uuid[];
  v_was_bound boolean := false;
begin
  if char_length(v_subject) not between 1 and 128 then
    raise exception '企业微信 UserId 无效'
      using errcode = '22023';
  end if;

  select identity.id
  into v_identity_id
  from public.employee_auth_identities identity
  where identity.provider = 'wecom'
    and identity.provider_subject = v_subject;

  if v_identity_id is not null then
    select employee.*
    into v_employee
    from public.employee_auth_identities identity
    join public.employees employee on employee.id = identity.employee_id
    where identity.id = v_identity_id;
  end if;

  if v_identity_id is null then
    select array_agg(distinct employee.id)
    into v_candidate_ids
    from public.employees employee
    where employee.status = 'active'
      and employee.auth_user_id is not null
      and lower(employee.email) = any (
        select lower(btrim(email))
        from unnest(coalesce(p_member_emails, array[]::text[])) as supplied(email)
        where position('@' in btrim(email)) > 1
      );

    if coalesce(cardinality(v_candidate_ids), 0) <> 1 then
      raise exception '企业微信成员未唯一匹配到在职员工账号'
        using errcode = 'P0002';
    end if;

    select *
    into v_employee
    from public.employees employee
    where employee.id = v_candidate_ids[1]
      and employee.status = 'active'
      and employee.auth_user_id is not null;

    insert into public.employee_auth_identities (
      organization_id,
      employee_id,
      provider,
      provider_subject,
      provider_display_name,
      metadata
    ) values (
      v_employee.organization_id,
      v_employee.id,
      'wecom',
      v_subject,
      nullif(btrim(coalesce(p_member_name, '')), ''),
      jsonb_build_object('binding_method', 'verified_email_match')
    )
    returning id into v_identity_id;

    v_was_bound := true;

    insert into public.audit_logs (
      organization_id,
      actor_employee_id,
      action,
      entity_type,
      entity_id,
      summary,
      metadata
    ) values (
      v_employee.organization_id,
      v_employee.id,
      'wecom_identity_bound',
      'employee_auth_identity',
      v_identity_id,
      '绑定企业微信扫码登录身份',
      jsonb_build_object('provider', 'wecom', 'employee_id', v_employee.id)
    );
  else
    if v_employee.status <> 'active' or v_employee.auth_user_id is null then
      raise exception '企业微信身份绑定的员工账号不可用'
        using errcode = 'P0002';
    end if;

    update public.employee_auth_identities
    set
      provider_display_name = coalesce(
        nullif(btrim(coalesce(p_member_name, '')), ''),
        provider_display_name
      )
    where id = v_identity_id;
  end if;

  return query
  select
    v_identity_id,
    v_employee.id,
    v_employee.auth_user_id,
    v_employee.email,
    v_was_bound;
exception
  when unique_violation then
    raise exception '企业微信身份已绑定其他员工，或该员工已绑定其他企业微信身份'
      using errcode = '23505';
end
$function$;

create or replace function public.record_wecom_login(p_identity_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_identity public.employee_auth_identities%rowtype;
begin
  select *
  into v_identity
  from public.employee_auth_identities identity
  where identity.id = p_identity_id
    and identity.provider = 'wecom'
  for update;

  if v_identity.id is null then
    raise exception '企业微信登录身份不存在'
      using errcode = 'P0002';
  end if;

  update public.employee_auth_identities
  set last_login_at = now()
  where id = v_identity.id;

  insert into public.audit_logs (
    organization_id,
    actor_employee_id,
    action,
    entity_type,
    entity_id,
    summary,
    metadata
  ) values (
    v_identity.organization_id,
    v_identity.employee_id,
    'wecom_signed_in',
    'employee_auth_identity',
    v_identity.id,
    '通过企业微信扫码登录',
    jsonb_build_object('provider', 'wecom')
  );
end
$function$;

revoke all on function public.resolve_wecom_login(text, text[], text)
from public, anon, authenticated;
grant execute on function public.resolve_wecom_login(text, text[], text)
to service_role;
revoke all on function public.record_wecom_login(uuid)
from public, anon, authenticated;
grant execute on function public.record_wecom_login(uuid)
to service_role;

commit;
