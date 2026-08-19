-- WeDrive-style file operations: rename, move and restore from recycle bin.

begin;

create or replace function public.rename_business_document(
  p_document_id uuid,
  p_title text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_title text := btrim(coalesce(p_title, ''));
begin
  if public.current_employee_id() is null
    or not public.can_manage_business_document(p_document_id)
  then
    raise exception '无权重命名此文件' using errcode = '42501';
  end if;

  if char_length(v_title) not between 2 and 160 then
    raise exception '文件标题长度无效' using errcode = '22023';
  end if;

  update public.business_documents
  set title = v_title
  where id = p_document_id
    and organization_id = public.current_organization_id();

  if not found then
    raise exception '文件不存在' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  ) values (
    public.current_organization_id(),
    public.current_employee_id(),
    'business_document_renamed',
    'business_document',
    p_document_id,
    '重命名文件：' || v_title
  );
end;
$function$;

create or replace function public.move_business_document(
  p_document_id uuid,
  p_target_folder_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_title text;
  v_source_folder_id uuid;
  v_target_folder_name text;
begin
  if public.current_employee_id() is null
    or not public.can_manage_business_document(p_document_id)
    or not public.document_folder_has_permission(p_target_folder_id, 'upload')
  then
    raise exception '无权移动此文件或写入目标目录' using errcode = '42501';
  end if;

  select title, folder_id
  into v_title, v_source_folder_id
  from public.business_documents
  where id = p_document_id
    and organization_id = public.current_organization_id()
    and status = 'active';

  select name into v_target_folder_name
  from public.document_folders
  where id = p_target_folder_id
    and organization_id = public.current_organization_id()
    and status = 'active';

  if v_title is null or v_target_folder_name is null then
    raise exception '文件或目标目录不存在' using errcode = '42501';
  end if;

  if v_source_folder_id = p_target_folder_id then
    return;
  end if;

  update public.business_documents
  set folder_id = p_target_folder_id
  where id = p_document_id
    and organization_id = public.current_organization_id();

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary, metadata
  ) values (
    public.current_organization_id(),
    public.current_employee_id(),
    'business_document_moved',
    'business_document',
    p_document_id,
    '移动文件：' || v_title || ' → ' || v_target_folder_name,
    jsonb_build_object(
      'source_folder_id', v_source_folder_id,
      'target_folder_id', p_target_folder_id
    )
  );
end;
$function$;

create or replace function public.restore_business_document(p_document_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_title text;
begin
  if public.current_employee_id() is null
    or not public.can_manage_business_document(p_document_id)
  then
    raise exception '无权恢复此文件' using errcode = '42501';
  end if;

  update public.business_documents
  set status = 'active'
  where id = p_document_id
    and organization_id = public.current_organization_id()
    and status = 'archived'
  returning title into v_title;

  if not found then
    raise exception '回收站中未找到此文件' using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action, entity_type, entity_id, summary
  ) values (
    public.current_organization_id(),
    public.current_employee_id(),
    'business_document_restored',
    'business_document',
    p_document_id,
    '从回收站恢复文件：' || v_title
  );
end;
$function$;

revoke all on function public.rename_business_document(uuid, text)
from public, anon;
revoke all on function public.move_business_document(uuid, uuid)
from public, anon;
revoke all on function public.restore_business_document(uuid)
from public, anon;

grant execute on function public.rename_business_document(uuid, text)
to authenticated;
grant execute on function public.move_business_document(uuid, uuid)
to authenticated;
grant execute on function public.restore_business_document(uuid)
to authenticated;

commit;
