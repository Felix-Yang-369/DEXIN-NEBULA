-- Multiple CRM contacts with an optional primary-contact switch.

create or replace function public.add_customer_contact(
  p_customer_id uuid,
  p_name text,
  p_position text,
  p_phone text,
  p_email text,
  p_wechat text,
  p_is_primary boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_customer public.customers%rowtype;
  v_contact_id uuid;
  v_make_primary boolean;
begin
  select *
  into v_actor
  from public.employees
  where auth_user_id = (select auth.uid())
    and status = 'active'
  limit 1;

  if v_actor.id is null or not public.can_manage_customers() then
    raise exception '只有销售、客服或系统管理员可以维护联系人'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_name, ''))) < 1
    or char_length(btrim(coalesce(p_name, ''))) > 80
  then
    raise exception '联系人姓名长度无效'
      using errcode = '22023';
  end if;

  if nullif(btrim(coalesce(p_phone, '')), '') is null
    and nullif(btrim(coalesce(p_email, '')), '') is null
    and nullif(btrim(coalesce(p_wechat, '')), '') is null
  then
    raise exception '联系人至少填写一种联系方式'
      using errcode = '22023';
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

  v_make_primary := coalesce(p_is_primary, false)
    or not exists (
      select 1
      from public.customer_contacts
      where customer_id = v_customer.id
    );

  if v_make_primary then
    update public.customer_contacts
    set is_primary = false
    where customer_id = v_customer.id
      and organization_id = v_actor.organization_id
      and is_primary;
  end if;

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
    btrim(p_name),
    nullif(btrim(coalesce(p_position, '')), ''),
    nullif(btrim(coalesce(p_phone, '')), ''),
    nullif(btrim(coalesce(p_email, '')), ''),
    nullif(btrim(coalesce(p_wechat, '')), ''),
    v_make_primary
  )
  returning id into v_contact_id;

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
    'customer_contact_created',
    'customer',
    v_customer.id,
    '新增客户联系人：' || btrim(p_name),
    jsonb_build_object(
      'customer_no', v_customer.customer_no,
      'contact_id', v_contact_id,
      'is_primary', v_make_primary
    )
  );

  return v_contact_id;
end;
$function$;

revoke all on function public.add_customer_contact(
  uuid,
  text,
  text,
  text,
  text,
  text,
  boolean
) from public;

grant execute on function public.add_customer_contact(
  uuid,
  text,
  text,
  text,
  text,
  text,
  boolean
) to authenticated;
