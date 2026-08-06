-- Ensure every newly created quotation starts with an immutable draft event.

begin;

create or replace function public.record_sales_quote_created_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  insert into public.sales_quote_events (
    organization_id,
    quote_id,
    from_status,
    to_status,
    note,
    actor_employee_id,
    created_at
  )
  values (
    new.organization_id,
    new.id,
    null,
    new.status,
    '报价草稿创建',
    new.created_by_employee_id,
    new.created_at
  );

  return new;
end;
$function$;

drop trigger if exists record_sales_quote_created_event
  on public.sales_quotes;
create trigger record_sales_quote_created_event
after insert on public.sales_quotes
for each row execute function public.record_sales_quote_created_event();

revoke all on function public.record_sales_quote_created_event()
  from public, anon, authenticated;

comment on function public.record_sales_quote_created_event() is
  'Creates the first immutable draft event for every new customer quotation.';

commit;
