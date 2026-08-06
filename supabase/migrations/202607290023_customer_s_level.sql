-- Add S-level customers while preserving the existing CRM functions.

begin;

alter table public.customers
  drop constraint if exists customers_level_check;

alter table public.customers
  add constraint customers_level_check
  check (level in ('S', 'A', 'B', 'C'));

do $migration$
declare
  v_function regprocedure;
  v_definition text;
begin
  foreach v_function in array array[
    'public.create_customer_with_contact(text,text,text,text,text,text,text,text[],uuid,text,text,text,text,text,text)'::regprocedure,
    'public.update_customer_with_primary_contact(uuid,text,text,text,text,text,text,text,text[],uuid,text,text,text,text,text,text,date)'::regprocedure
  ]
  loop
    select pg_get_functiondef(v_function::oid)
    into v_definition;

    if position(
      'p_level not in (''A'', ''B'', ''C'')'
      in v_definition
    ) = 0 then
      raise exception '无法定位客户等级校验：%', v_function;
    end if;

    execute replace(
      v_definition,
      'p_level not in (''A'', ''B'', ''C'')',
      'p_level not in (''S'', ''A'', ''B'', ''C'')'
    );
  end loop;
end;
$migration$;

commit;
