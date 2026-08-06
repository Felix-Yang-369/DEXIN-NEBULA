-- Real internal announcement publishing, scoped visibility and read receipts.

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  summary text not null,
  content text not null,
  category_code text not null
    check (category_code in ('company', 'policy', 'project', 'operations')),
  scope_type text not null default 'all'
    check (scope_type in ('all', 'department')),
  scope_department_id uuid references public.departments(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  is_pinned boolean not null default false,
  author_employee_id uuid not null references public.employees(id) on delete restrict,
  author_name text not null,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (scope_type = 'all' and scope_department_id is null)
    or (scope_type = 'department' and scope_department_id is not null)
  ),
  check (
    (status = 'draft' and published_at is null and archived_at is null)
    or (status = 'published' and published_at is not null and archived_at is null)
    or (status = 'archived' and published_at is not null and archived_at is not null)
  )
);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, employee_id)
);

create index if not exists announcements_org_status_idx
  on public.announcements (organization_id, status, is_pinned desc, published_at desc);
create index if not exists announcements_scope_department_idx
  on public.announcements (scope_department_id, status, published_at desc);
create index if not exists announcement_reads_employee_idx
  on public.announcement_reads (employee_id, read_at desc);

drop trigger if exists announcements_set_updated_at on public.announcements;
create trigger announcements_set_updated_at
before update on public.announcements
for each row execute function public.set_updated_at();

create or replace function public.can_view_announcement(
  p_announcement_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.announcements announcement
    join public.employees viewer
      on viewer.id = public.current_employee_id()
    where announcement.id = p_announcement_id
      and announcement.organization_id = viewer.organization_id
      and (
        (
          announcement.status = 'published'
          and (
            announcement.scope_type = 'all'
            or announcement.scope_department_id = viewer.department_id
            or public.has_org_role('hr')
            or public.has_org_role('admin')
            or public.has_org_role('chairman')
          )
        )
        or (
          announcement.status = 'draft'
          and (
            announcement.author_employee_id = viewer.id
            or public.has_org_role('hr')
            or public.has_org_role('admin')
          )
        )
      )
  )
$$;

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

drop policy if exists announcements_select_scoped on public.announcements;
create policy announcements_select_scoped
on public.announcements
for select
to authenticated
using ((select public.can_view_announcement(id)));

drop policy if exists announcement_reads_select_own on public.announcement_reads;
create policy announcement_reads_select_own
on public.announcement_reads
for select
to authenticated
using (employee_id = (select public.current_employee_id()));

revoke all on table public.announcements from anon;
revoke all on table public.announcement_reads from anon;
revoke insert, update, delete on table public.announcements from authenticated;
revoke insert, update, delete on table public.announcement_reads from authenticated;
grant select on table public.announcements to authenticated;
grant select on table public.announcement_reads to authenticated;

create or replace function public.save_announcement(
  p_announcement_id uuid,
  p_title text,
  p_summary text,
  p_content text,
  p_category_code text,
  p_scope_type text,
  p_scope_department_id uuid,
  p_is_pinned boolean,
  p_publish boolean
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.employees%rowtype;
  v_announcement public.announcements%rowtype;
begin
  select *
  into v_actor
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if not found or not (
    public.has_org_role('hr')
    or public.has_org_role('admin')
  ) then
    raise exception '当前账号没有公告发布权限'
      using errcode = '42501';
  end if;

  if char_length(trim(p_title)) < 4 or char_length(trim(p_title)) > 120 then
    raise exception '公告标题需为四至一百二十个字'
      using errcode = '22023';
  end if;

  if char_length(trim(p_summary)) < 8 or char_length(trim(p_summary)) > 300 then
    raise exception '公告摘要需为八至三百个字'
      using errcode = '22023';
  end if;

  if char_length(trim(p_content)) < 10 or char_length(trim(p_content)) > 20000 then
    raise exception '公告正文需为十至两万个字'
      using errcode = '22023';
  end if;

  if p_category_code not in ('company', 'policy', 'project', 'operations') then
    raise exception '公告分类无效'
      using errcode = '22023';
  end if;

  if p_scope_type not in ('all', 'department') then
    raise exception '公告范围无效'
      using errcode = '22023';
  end if;

  if p_scope_type = 'department' then
    if p_scope_department_id is null or not exists (
      select 1
      from public.departments department
      where department.id = p_scope_department_id
        and department.organization_id = v_actor.organization_id
        and department.status = 'active'
    ) then
      raise exception '请选择当前组织的有效部门'
        using errcode = '22023';
    end if;
  else
    p_scope_department_id := null;
  end if;

  if p_announcement_id is not null then
    select *
    into v_announcement
    from public.announcements
    where id = p_announcement_id
      and organization_id = v_actor.organization_id
    for update;

    if not found then
      raise exception '公告不存在'
        using errcode = 'P0002';
    end if;

    if v_announcement.status <> 'draft' then
      raise exception '只有草稿可以编辑或发布'
        using errcode = '22023';
    end if;
  end if;

  if p_announcement_id is null then
    insert into public.announcements (
      organization_id,
      title,
      summary,
      content,
      category_code,
      scope_type,
      scope_department_id,
      status,
      is_pinned,
      author_employee_id,
      author_name,
      published_at
    )
    values (
      v_actor.organization_id,
      trim(p_title),
      trim(p_summary),
      trim(p_content),
      p_category_code,
      p_scope_type,
      p_scope_department_id,
      case when p_publish then 'published' else 'draft' end,
      p_is_pinned,
      v_actor.id,
      v_actor.name,
      case when p_publish then now() else null end
    )
    returning *
    into v_announcement;
  else
    update public.announcements
    set
      title = trim(p_title),
      summary = trim(p_summary),
      content = trim(p_content),
      category_code = p_category_code,
      scope_type = p_scope_type,
      scope_department_id = p_scope_department_id,
      status = case when p_publish then 'published' else 'draft' end,
      is_pinned = p_is_pinned,
      published_at = case when p_publish then now() else null end
    where id = p_announcement_id
    returning *
    into v_announcement;
  end if;

  if p_publish then
    insert into public.notifications (
      organization_id,
      recipient_employee_id,
      notification_type,
      title,
      body,
      href,
      entity_type,
      entity_id
    )
    select
      v_actor.organization_id,
      employee.id,
      'system',
      '新公告：' || v_announcement.title,
      v_announcement.summary,
      '/announcements/' || v_announcement.id::text,
      'announcement',
      v_announcement.id
    from public.employees employee
    where employee.organization_id = v_actor.organization_id
      and employee.status = 'active'
      and (
        v_announcement.scope_type = 'all'
        or employee.department_id = v_announcement.scope_department_id
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
      'announcement.published',
      'announcement',
      v_announcement.id,
      v_actor.name || '发布公告：' || v_announcement.title,
      jsonb_build_object(
        'category_code', v_announcement.category_code,
        'scope_type', v_announcement.scope_type,
        'scope_department_id', v_announcement.scope_department_id,
        'is_pinned', v_announcement.is_pinned
      )
    );
  end if;

  return v_announcement.id;
end;
$$;

create or replace function public.mark_announcement_read(
  p_announcement_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.can_view_announcement(p_announcement_id)
    or not exists (
      select 1
      from public.announcements
      where id = p_announcement_id
        and status = 'published'
    )
  then
    raise exception '公告不存在或无权查看'
      using errcode = '42501';
  end if;

  insert into public.announcement_reads (announcement_id, employee_id)
  values (p_announcement_id, public.current_employee_id())
  on conflict (announcement_id, employee_id)
  do update set read_at = excluded.read_at;
end;
$$;

revoke all on function public.can_view_announcement(uuid) from public;
revoke all on function public.save_announcement(uuid, text, text, text, text, text, uuid, boolean, boolean) from public;
revoke all on function public.mark_announcement_read(uuid) from public;
grant execute on function public.can_view_announcement(uuid) to authenticated;
grant execute on function public.save_announcement(uuid, text, text, text, text, text, uuid, boolean, boolean) to authenticated;
grant execute on function public.mark_announcement_read(uuid) to authenticated;
