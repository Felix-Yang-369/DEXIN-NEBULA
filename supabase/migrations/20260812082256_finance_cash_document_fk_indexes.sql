create index finance_cash_allocations_organization_idx
  on public.finance_cash_allocations (organization_id);

create index finance_cash_allocations_settlement_idx
  on public.finance_cash_allocations (settlement_id)
  where settlement_id is not null;

create index finance_cash_documents_submitted_by_idx
  on public.finance_cash_documents (submitted_by_employee_id)
  where submitted_by_employee_id is not null;

create index finance_cash_documents_approved_by_idx
  on public.finance_cash_documents (approved_by_employee_id)
  where approved_by_employee_id is not null;

create index finance_cash_documents_completed_by_idx
  on public.finance_cash_documents (completed_by_employee_id)
  where completed_by_employee_id is not null;

create index finance_cash_documents_transaction_idx
  on public.finance_cash_documents (transaction_id)
  where transaction_id is not null;

create index finance_cash_documents_voucher_idx
  on public.finance_cash_documents (voucher_id)
  where voucher_id is not null;
