-- Finance deepening V1: fixed-asset, budget, expense-accounting and tax-assist ledgers.
-- All writes are intentionally kept behind later transaction functions; Data API is read-only.
begin;

create table public.fixed_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_no text not null, name text not null, category text not null,
  acquired_on date not null, original_value numeric(18,2) not null check (original_value > 0),
  residual_value numeric(18,2) not null default 0 check (residual_value >= 0 and residual_value < original_value),
  useful_life_months integer not null check (useful_life_months between 1 and 1200),
  depreciation_method text not null default 'straight_line' check (depreciation_method = 'straight_line'),
  accumulated_depreciation numeric(18,2) not null default 0 check (accumulated_depreciation >= 0),
  status text not null default 'active' check (status in ('active','disposed','fully_depreciated')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(organization_id, asset_no)
);
create table public.fixed_asset_depreciations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  asset_id uuid not null references public.fixed_assets(id) on delete restrict, period_id uuid not null references public.fiscal_periods(id) on delete restrict,
  amount numeric(18,2) not null check (amount > 0), journal_entry_id uuid references public.journal_entries(id) on delete restrict,
  created_by_employee_id uuid not null references public.employees(id), created_at timestamptz not null default now(), unique(asset_id, period_id)
);
create table public.budget_versions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null, name text not null, fiscal_year integer not null check (fiscal_year between 2000 and 2200),
  status text not null default 'draft' check (status in ('draft','active','closed')), created_at timestamptz not null default now(), unique(organization_id, code)
);
create table public.budget_lines (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  budget_version_id uuid not null references public.budget_versions(id) on delete cascade, department_id uuid references public.departments(id) on delete restrict,
  account_id uuid references public.accounting_accounts(id) on delete restrict, period_no integer not null check(period_no between 1 and 12),
  amount numeric(18,2) not null check(amount >= 0), consumed_amount numeric(18,2) not null default 0 check(consumed_amount >= 0),
  unique(budget_version_id, department_id, account_id, period_no)
);
create table public.expense_accounting_links (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  expense_claim_id uuid not null references public.expense_claims(id) on delete restrict, journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
  status text not null default 'drafted' check(status in('drafted','posted','reversed')), created_at timestamptz not null default now(), unique(organization_id, expense_claim_id)
);
create table public.tax_assist_records (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  invoice_id uuid not null references public.finance_invoices(id) on delete restrict, tax_period text not null check(tax_period ~ '^[0-9]{4}-[0-9]{2}$'),
  deductible_amount numeric(18,2) not null default 0 check(deductible_amount >= 0), status text not null default 'pending' check(status in('pending','included','excluded')),
  created_at timestamptz not null default now(), unique(organization_id, invoice_id)
);
create index fixed_assets_org_status_idx on public.fixed_assets(organization_id,status);
create index budget_lines_version_period_idx on public.budget_lines(budget_version_id,period_no);
create index tax_assist_records_org_period_idx on public.tax_assist_records(organization_id,tax_period,status);
create trigger fixed_assets_set_updated_at before update on public.fixed_assets for each row execute function public.set_updated_at();
alter table public.fixed_assets enable row level security; alter table public.fixed_asset_depreciations enable row level security; alter table public.budget_versions enable row level security; alter table public.budget_lines enable row level security; alter table public.expense_accounting_links enable row level security; alter table public.tax_assist_records enable row level security;
create policy finance_deepening_read_assets on public.fixed_assets for select to authenticated using(organization_id=public.current_organization_id() and public.has_access_permission('finance.ledger.view'));
create policy finance_deepening_read_depreciation on public.fixed_asset_depreciations for select to authenticated using(organization_id=public.current_organization_id() and public.has_access_permission('finance.ledger.view'));
create policy finance_deepening_read_budgets on public.budget_versions for select to authenticated using(organization_id=public.current_organization_id() and public.has_access_permission('finance.report.export'));
create policy finance_deepening_read_budget_lines on public.budget_lines for select to authenticated using(organization_id=public.current_organization_id() and public.has_access_permission('finance.report.export'));
create policy finance_deepening_read_expenses on public.expense_accounting_links for select to authenticated using(organization_id=public.current_organization_id() and public.has_access_permission('finance.ledger.view'));
create policy finance_deepening_read_tax on public.tax_assist_records for select to authenticated using(organization_id=public.current_organization_id() and public.has_access_permission('finance.report.export'));
revoke all on public.fixed_assets,public.fixed_asset_depreciations,public.budget_versions,public.budget_lines,public.expense_accounting_links,public.tax_assist_records from public,anon,authenticated;
grant select on public.fixed_assets,public.fixed_asset_depreciations,public.budget_versions,public.budget_lines,public.expense_accounting_links,public.tax_assist_records to authenticated;
commit;
