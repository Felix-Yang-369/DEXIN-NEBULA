create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  transaction_no text not null,
  transaction_type text not null check (transaction_type in ('income', 'expense')),
  category text not null,
  counterparty text,
  amount numeric(14, 2) not null check (amount > 0),
  currency text not null default 'CNY' check (currency = 'CNY'),
  occurred_on date not null default current_date,
  payment_channel text not null default 'bank'
    check (payment_channel in ('bank', 'wechat', 'alipay', 'cash', 'other')),
  account_name text,
  voucher_no text,
  status text not null default 'confirmed'
    check (status in ('draft', 'confirmed', 'void')),
  note text,
  created_by_employee_id uuid not null references public.employees(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, transaction_no)
);

create index if not exists finance_transactions_org_date_idx
  on public.finance_transactions (organization_id, occurred_on desc);

create index if not exists finance_transactions_org_type_idx
  on public.finance_transactions (organization_id, transaction_type, status);

drop trigger if exists set_finance_transactions_updated_at
  on public.finance_transactions;

create trigger set_finance_transactions_updated_at
before update on public.finance_transactions
for each row execute function public.set_updated_at();

alter table public.finance_transactions enable row level security;

drop policy if exists "finance transactions visible to finance and chairman"
  on public.finance_transactions;
create policy "finance transactions visible to finance and chairman"
on public.finance_transactions
for select
using (
  organization_id = public.current_organization_id()
  and (
    public.has_org_role('finance')
    or public.has_org_role('chairman')
  )
);

drop policy if exists "finance transactions insertable by finance"
  on public.finance_transactions;
create policy "finance transactions insertable by finance"
on public.finance_transactions
for insert
with check (
  organization_id = public.current_organization_id()
  and created_by_employee_id = public.current_employee_id()
  and public.has_org_role('finance')
);

drop policy if exists "finance transactions editable by finance"
  on public.finance_transactions;
create policy "finance transactions editable by finance"
on public.finance_transactions
for update
using (
  organization_id = public.current_organization_id()
  and public.has_org_role('finance')
)
with check (
  organization_id = public.current_organization_id()
  and public.has_org_role('finance')
);

drop policy if exists "finance transactions removable by finance"
  on public.finance_transactions;
create policy "finance transactions removable by finance"
on public.finance_transactions
for delete
using (
  organization_id = public.current_organization_id()
  and public.has_org_role('finance')
);

comment on table public.finance_transactions is
  '德馨星云财务中心收支台账。财务角色维护，董事长只读查看。';

