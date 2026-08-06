-- Editable CRM customer profiles with transactional primary-contact updates.

create or replace function public.update_customer_with_primary_contact(
  p_customer_id uuid,
  p_name text,
  p_customer_type text,
  p_level text,
  p_status text,
  p_source text,
  p_region text,
  p_address text,
  p_tags text[],
  p_owner_employee_id uuid,
  p_note text,
  p_contact_name text,
  p_contact_position text,
  p_contact_phone text,
  p_contact_email text,
  p_contact_wechat text,
  p_next_follow_up_on date
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_customer public.customers%rowtype;
  v_primary_contact_id uuid;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '只有销售、客服或系统管理员可以编辑客户'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 1
    or char_length(btrim(coalesce(p_name, ''))) > 120
  then
    raise exception '客户名称长度无效'
      using errcode = '22023';
  end if;

  if p_customer_type not in (
    'catering', 'gift', 'distributor', 'enterprise', 'other'
  )
    or p_level not in ('A', 'B', 'C')
    or p_status not in ('lead', 'prospect', 'active', 'inactive')
  then
    raise exception '客户分类参数无效'
      using errcode = '22023';
  end if;

  if p_owner_employee_id is not null
    and not exists (
      select 1
      from public.employees
      where id = p_owner_employee_id
        and organization_id = v_actor.organization_id
        and status = 'active'
    )
  then
    raise exception '客户负责人不属于当前组织'
      using errcode = '42501';
  end if;

  select *
  into v_customer
  from public.customers
  where id = p_customer_id
    and organization_id = v_actor.organization_id
  for update;

  if v_customer.id is null then
    raise exception '客户不存在或无权编辑'
      using errcode = '42501';
  end if;

  update public.customers
  set
    name = btrim(p_name),
    customer_type = p_customer_type,
    level = p_level,
    status = p_status,
    source = nullif(btrim(coalesce(p_source, '')), ''),
    region = nullif(btrim(coalesce(p_region, '')), ''),
    address = nullif(btrim(coalesce(p_address, '')), ''),
    tags = coalesce(p_tags, array[]::text[]),
    owner_employee_id = coalesce(p_owner_employee_id, v_actor.id),
    note = nullif(btrim(coalesce(p_note, '')), ''),
    next_follow_up_on = p_next_follow_up_on
  where id = v_customer.id;

  select id
  into v_primary_contact_id
  from public.customer_contacts
  where customer_id = v_customer.id
    and organization_id = v_actor.organization_id
    and is_primary
  order by updated_at desc
  limit 1
  for update;

  if nullif(btrim(coalesce(p_contact_name, '')), '') is not null then
    if v_primary_contact_id is null then
      insert into public.customer_contacts (
        organization_id,
        customer_id,
        name,
        position,
        phone,
        email,
        wechat,
        is_primary
      )
      values (
        v_actor.organization_id,
        v_customer.id,
        btrim(p_contact_name),
        nullif(btrim(coalesce(p_contact_position, '')), ''),
        nullif(btrim(coalesce(p_contact_phone, '')), ''),
        nullif(btrim(coalesce(p_contact_email, '')), ''),
        nullif(btrim(coalesce(p_contact_wechat, '')), ''),
        true
      );
    else
      update public.customer_contacts
      set
        name = btrim(p_contact_name),
        position = nullif(btrim(coalesce(p_contact_position, '')), ''),
        phone = nullif(btrim(coalesce(p_contact_phone, '')), ''),
        email = nullif(btrim(coalesce(p_contact_email, '')), ''),
        wechat = nullif(btrim(coalesce(p_contact_wechat, '')), '')
      where id = v_primary_contact_id;
    end if;
  end if;

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
    'customer_updated',
    'customer',
    v_customer.id,
    '更新客户档案：' || btrim(p_name),
    jsonb_build_object(
      'customer_no', v_customer.customer_no,
      'status', p_status,
      'level', p_level
    )
  );

  return jsonb_build_object(
    'id', v_customer.id,
    'customerNo', v_customer.customer_no
  );
end;
$function$;

revoke all on function public.update_customer_with_primary_contact(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date
) from public;

grant execute on function public.update_customer_with_primary_contact(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text[],
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  date
) to authenticated;
