-- PIM phase 2: complete product master fields and atomic full-record editing.

begin;

alter table public.products
  add column if not exists customer_query_reply text,
  add column if not exists out_of_stock_reply text,
  add column if not exists order_guide_reply text;

create or replace function public.save_product_full(
  p_product_id uuid,
  p_code text,
  p_category text,
  p_source_category text,
  p_barcode text,
  p_brand text,
  p_short_name text,
  p_name text,
  p_name_en text,
  p_specification text,
  p_case_specification text,
  p_shelf_life text,
  p_tax_rate numeric,
  p_minimum_order text,
  p_stock_status text,
  p_supports_dropship boolean,
  p_is_recommended boolean,
  p_applicable_scenarios text,
  p_description text,
  p_delivery_notes text,
  p_invoice_notes text,
  p_alternative_product_codes text[],
  p_keywords text[],
  p_customer_query_reply text,
  p_out_of_stock_reply text,
  p_order_guide_reply text,
  p_status text,
  p_procurement_price numeric,
  p_retail_price numeric,
  p_group_price numeric,
  p_dropship_price numeric
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_actor public.employees%rowtype;
  v_product_id uuid;
  v_is_new boolean := p_product_id is null;
begin
  select * into v_actor
  from public.employees
  where id = public.current_employee_id()
    and status = 'active';

  if v_actor.id is null or not public.can_manage_products() then
    raise exception '只有采购人员或系统管理员可以维护产品资料'
      using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_code, ''))) < 3
    or p_category not in ('rice', 'oil', 'gift')
    or char_length(btrim(coalesce(p_short_name, ''))) < 2
    or char_length(btrim(coalesce(p_name, ''))) < 2
    or p_status not in ('draft', 'active', 'archived')
    or p_tax_rate is not null and (p_tax_rate < 0 or p_tax_rate > 1)
    or least(
      coalesce(p_procurement_price, 0),
      coalesce(p_retail_price, 0),
      coalesce(p_group_price, 0),
      coalesce(p_dropship_price, 0)
    ) < 0
  then
    raise exception '产品主档参数无效' using errcode = '22023';
  end if;

  if v_is_new then
    insert into public.products (
      organization_id, code, category, source_category, barcode, brand,
      short_name, name, name_en, specification, case_specification,
      shelf_life, tax_rate, minimum_order, stock_status, supports_dropship,
      is_recommended, applicable_scenarios, description, delivery_notes,
      invoice_notes, alternative_product_codes, keywords,
      customer_query_reply, out_of_stock_reply, order_guide_reply,
      status, created_by_employee_id
    ) values (
      v_actor.organization_id, upper(btrim(p_code)), p_category,
      coalesce(nullif(btrim(coalesce(p_source_category, '')), ''), p_category),
      nullif(btrim(coalesce(p_barcode, '')), ''),
      nullif(btrim(coalesce(p_brand, '')), ''),
      btrim(p_short_name), btrim(p_name),
      nullif(btrim(coalesce(p_name_en, '')), ''),
      nullif(btrim(coalesce(p_specification, '')), ''),
      nullif(btrim(coalesce(p_case_specification, '')), ''),
      nullif(btrim(coalesce(p_shelf_life, '')), ''), p_tax_rate,
      nullif(btrim(coalesce(p_minimum_order, '')), ''),
      nullif(btrim(coalesce(p_stock_status, '')), ''),
      coalesce(p_supports_dropship, false),
      coalesce(p_is_recommended, false),
      nullif(btrim(coalesce(p_applicable_scenarios, '')), ''),
      nullif(btrim(coalesce(p_description, '')), ''),
      nullif(btrim(coalesce(p_delivery_notes, '')), ''),
      nullif(btrim(coalesce(p_invoice_notes, '')), ''),
      coalesce(p_alternative_product_codes, array[]::text[]),
      coalesce(p_keywords, array[]::text[]),
      nullif(btrim(coalesce(p_customer_query_reply, '')), ''),
      nullif(btrim(coalesce(p_out_of_stock_reply, '')), ''),
      nullif(btrim(coalesce(p_order_guide_reply, '')), ''),
      p_status, v_actor.id
    ) returning id into v_product_id;
  else
    update public.products set
      code = upper(btrim(p_code)),
      category = p_category,
      source_category = coalesce(
        nullif(btrim(coalesce(p_source_category, '')), ''),
        p_category
      ),
      barcode = nullif(btrim(coalesce(p_barcode, '')), ''),
      brand = nullif(btrim(coalesce(p_brand, '')), ''),
      short_name = btrim(p_short_name),
      name = btrim(p_name),
      name_en = nullif(btrim(coalesce(p_name_en, '')), ''),
      specification = nullif(btrim(coalesce(p_specification, '')), ''),
      case_specification = nullif(btrim(coalesce(p_case_specification, '')), ''),
      shelf_life = nullif(btrim(coalesce(p_shelf_life, '')), ''),
      tax_rate = p_tax_rate,
      minimum_order = nullif(btrim(coalesce(p_minimum_order, '')), ''),
      stock_status = nullif(btrim(coalesce(p_stock_status, '')), ''),
      supports_dropship = coalesce(p_supports_dropship, false),
      is_recommended = coalesce(p_is_recommended, false),
      applicable_scenarios = nullif(btrim(coalesce(p_applicable_scenarios, '')), ''),
      description = nullif(btrim(coalesce(p_description, '')), ''),
      delivery_notes = nullif(btrim(coalesce(p_delivery_notes, '')), ''),
      invoice_notes = nullif(btrim(coalesce(p_invoice_notes, '')), ''),
      alternative_product_codes = coalesce(
        p_alternative_product_codes,
        array[]::text[]
      ),
      keywords = coalesce(p_keywords, array[]::text[]),
      customer_query_reply = nullif(btrim(coalesce(p_customer_query_reply, '')), ''),
      out_of_stock_reply = nullif(btrim(coalesce(p_out_of_stock_reply, '')), ''),
      order_guide_reply = nullif(btrim(coalesce(p_order_guide_reply, '')), ''),
      status = p_status
    where id = p_product_id
      and organization_id = v_actor.organization_id
    returning id into v_product_id;

    if v_product_id is null then
      raise exception '产品不存在或不属于当前组织'
        using errcode = '42501';
    end if;
  end if;

  insert into public.product_prices (
    organization_id, product_id, price_type, amount_cny,
    status, source_note, created_by_employee_id
  )
  select
    v_actor.organization_id, v_product_id, price_type, amount,
    'active', '产品总表维护', v_actor.id
  from (values
    ('procurement', p_procurement_price),
    ('retail', p_retail_price),
    ('group', p_group_price),
    ('dropship', p_dropship_price)
  ) as prices(price_type, amount)
  where amount is not null
  on conflict (organization_id, product_id, price_type)
  do update set
    amount_cny = excluded.amount_cny,
    status = 'active',
    source_note = excluded.source_note,
    valid_from = current_date,
    valid_until = null,
    created_by_employee_id = excluded.created_by_employee_id;

  update public.product_prices
  set status = 'expired', valid_until = current_date
  where organization_id = v_actor.organization_id
    and product_id = v_product_id
    and (
      (price_type = 'procurement' and p_procurement_price is null)
      or (price_type = 'retail' and p_retail_price is null)
      or (price_type = 'group' and p_group_price is null)
      or (price_type = 'dropship' and p_dropship_price is null)
    );

  insert into public.audit_logs (
    organization_id, actor_employee_id, action,
    entity_type, entity_id, summary, metadata
  ) values (
    v_actor.organization_id,
    v_actor.id,
    case when v_is_new then 'product_created' else 'product_full_updated' end,
    'product',
    v_product_id,
    case when v_is_new then '创建产品主档' else '更新产品完整主档' end,
    jsonb_build_object('code', upper(btrim(p_code)), 'status', p_status)
  );

  return v_product_id;
exception
  when unique_violation then
    raise exception '产品编号已存在' using errcode = '23505';
end;
$function$;

revoke all on function public.save_product_full(
  uuid, text, text, text, text, text, text, text, text, text,
  text, text, numeric, text, text, boolean, boolean, text, text,
  text, text, text[], text[], text, text, text, text, numeric,
  numeric, numeric, numeric
) from public, anon;
grant execute on function public.save_product_full(
  uuid, text, text, text, text, text, text, text, text, text,
  text, text, numeric, text, text, boolean, boolean, text, text,
  text, text, text[], text[], text, text, text, text, numeric,
  numeric, numeric, numeric
) to authenticated;

comment on column public.products.customer_query_reply is
  'Standard customer-facing product query response.';
comment on column public.products.out_of_stock_reply is
  'Standard customer-facing out-of-stock response.';
comment on column public.products.order_guide_reply is
  'Standard customer-facing order guidance response.';

commit;
