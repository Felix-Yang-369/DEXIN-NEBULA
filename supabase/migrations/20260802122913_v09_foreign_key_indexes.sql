-- Cover every foreign key introduced by the V0.8/V0.9 business-loop tables.
-- PostgreSQL does not create these indexes automatically. The guard also avoids
-- duplicating an existing composite index whose leading columns already cover
-- the foreign key.
do $migration$
declare
  fk record;
  index_name text;
begin
  for fk in
    select
      c.oid,
      c.conrelid,
      c.conname,
      c.conkey,
      n.nspname as schema_name,
      t.relname as table_name,
      string_agg(quote_ident(a.attname), ', ' order by key_position.ordinality) as column_list
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join lateral unnest(c.conkey) with ordinality as key_position(attnum, ordinality) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = key_position.attnum
    where c.contype = 'f'
      and n.nspname = 'public'
      and (
        t.relname like 'purchase_%'
        or t.relname like 'goods_receipt%'
        or t.relname like 'bank_%'
        or t.relname like 'sales_%'
        or (t.relname = 'finance_documents' and c.conname in (
          'finance_documents_purchase_order_id_fkey',
          'finance_documents_goods_receipt_id_fkey'
        ))
        or (t.relname = 'finance_settlements' and c.conname = 'finance_settlements_bank_statement_line_id_fkey')
      )
    group by c.oid, c.conrelid, c.conname, c.conkey, n.nspname, t.relname
  loop
    if not exists (
      select 1
      from pg_index i
      where i.indrelid = fk.conrelid
        and i.indisvalid
        and i.indisready
        and not exists (
          select 1
          from generate_subscripts(fk.conkey, 1) as position
          where i.indkey[position - 1] <> fk.conkey[position]
        )
    ) then
      index_name := left(regexp_replace(fk.conname, '_fkey$', '_idx'), 63);
      execute format(
        'create index if not exists %I on %I.%I (%s)',
        index_name,
        fk.schema_name,
        fk.table_name,
        fk.column_list
      );
    end if;
  end loop;
end
$migration$;
