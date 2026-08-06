-- Allow multiple suppliers without a credit code while preserving uniqueness
-- for codes that have actually been entered.

begin;

alter table public.suppliers
  drop constraint if exists suppliers_organization_id_unified_credit_code_key;

create unique index if not exists suppliers_org_credit_code_unique_idx
  on public.suppliers (organization_id, unified_credit_code)
  where unified_credit_code is not null;

commit;
