-- Complete the PIM image-maintenance loop and remove supplier evaluation
-- wording from the current SRM scope without rewriting a deployed migration.

begin;

comment on table public.suppliers is
  'SRM supplier master data. Purchase orders remain a future phase.';

create or replace function public.set_product_image(
  p_product_id uuid,
  p_image_path text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
begin
  select * into v_actor
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if v_actor.id is null or not public.can_manage_products() then
    raise exception '只有采购人员或系统管理员可以维护产品图片'
      using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_image_path, '')), '') is null
    or p_image_path !~ '^[0-9a-f-]{36}/[A-Z0-9_-]+/product\.(png|jpg|webp)$'
  then
    raise exception '产品图片路径无效' using errcode = '22023';
  end if;

  update public.products
  set image_path = btrim(p_image_path)
  where id = p_product_id
    and organization_id = v_actor.organization_id;

  if not found then
    raise exception '产品不存在或不属于当前组织'
      using errcode = '42501';
  end if;

  insert into public.audit_logs (
    organization_id, actor_employee_id, action,
    entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id, v_actor.id, 'product_image_updated',
    'product', p_product_id, '更新产品图片',
    jsonb_build_object('image_path', btrim(p_image_path))
  );
end;
$function$;

revoke all on function public.set_product_image(uuid, text)
  from public, anon;
grant execute on function public.set_product_image(uuid, text)
  to authenticated;

commit;
