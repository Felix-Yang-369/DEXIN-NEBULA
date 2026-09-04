-- Finance integration V1: configurable business-to-ledger rules and controlled draft generation.
begin;
create table public.business_accounting_rules(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 book_id uuid not null references public.accounting_books(id) on delete cascade,source_type text not null check(source_type in('receivable','payable')),
 debit_account_id uuid not null references public.accounting_accounts(id),credit_account_id uuid not null references public.accounting_accounts(id),
 summary_template text not null,status text not null default 'active' check(status in('active','inactive')),updated_at timestamptz not null default now(),unique(organization_id,book_id,source_type)
);
create table public.business_accounting_runs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id) on delete cascade,
 source_type text not null,source_id uuid not null,journal_entry_id uuid not null references public.journal_entries(id) on delete restrict,
 status text not null default 'drafted' check(status in('drafted','reversed')),created_by_employee_id uuid not null references public.employees(id),created_at timestamptz not null default now(),unique(organization_id,source_type,source_id)
);
insert into public.business_accounting_rules(organization_id,book_id,source_type,debit_account_id,credit_account_id,summary_template)
select b.organization_id,b.id,x.source_type,da.id,ca.id,x.template from public.accounting_books b
cross join(values('receivable','1122','6001','确认应收'),('payable','1405','2202','确认采购应付'))x(source_type,debit_code,credit_code,template)
join public.accounting_accounts da on da.book_id=b.id and da.code=x.debit_code join public.accounting_accounts ca on ca.book_id=b.id and ca.code=x.credit_code
where b.code='PRIMARY' on conflict do nothing;
create index business_accounting_runs_org_created_idx on public.business_accounting_runs(organization_id,created_at desc);
alter table public.business_accounting_rules enable row level security;alter table public.business_accounting_runs enable row level security;
create policy business_accounting_rules_finance_read on public.business_accounting_rules for select to authenticated using(organization_id=public.current_organization_id() and public.has_access_permission('finance.voucher.create'));
create policy business_accounting_runs_finance_read on public.business_accounting_runs for select to authenticated using(organization_id=public.current_organization_id() and (public.has_access_permission('finance.voucher.create') or public.has_access_permission('finance.ledger.view')));
revoke all on table public.business_accounting_rules from public,anon,authenticated;revoke all on table public.business_accounting_runs from public,anon,authenticated;
grant select on table public.business_accounting_rules to authenticated;grant select on table public.business_accounting_runs to authenticated;

create or replace function public.generate_business_journal_draft(p_finance_document_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $f$
declare v_org uuid:=public.current_organization_id();v_actor uuid:=public.current_employee_id();d public.finance_documents%rowtype;r public.business_accounting_rules%rowtype;result jsonb;entry_id uuid;
begin
 if v_actor is null or not public.has_access_permission('finance.voucher.create') then raise exception '缺少凭证制单权限' using errcode='42501';end if;
 select * into d from public.finance_documents where id=p_finance_document_id and organization_id=v_org and status<>'void';
 if d.id is null then raise exception '业务单据不存在' using errcode='P0002';end if;
 if exists(select 1 from public.business_accounting_runs where organization_id=v_org and source_type='finance_document' and source_id=d.id) then raise exception '业务单据已经生成凭证' using errcode='23505';end if;
 select rule.* into r from public.business_accounting_rules rule where rule.organization_id=v_org and rule.source_type=d.document_type and rule.status='active';
 if r.id is null then raise exception '未配置业务凭证规则' using errcode='23514';end if;
 result:=public.create_journal_entry(r.book_id,d.issue_date,r.summary_template||' '||d.document_no,0,jsonb_build_array(
  jsonb_build_object('account_id',r.debit_account_id,'summary',d.counterparty_name,'debit_amount',d.total_amount,'credit_amount',0),
  jsonb_build_object('account_id',r.credit_account_id,'summary',d.counterparty_name,'debit_amount',0,'credit_amount',d.total_amount)
 ));
 entry_id:=(result->>'id')::uuid;update public.journal_entries set source_type='finance_document',source_id=d.id where id=entry_id;
 insert into public.business_accounting_runs(organization_id,source_type,source_id,journal_entry_id,created_by_employee_id) values(v_org,'finance_document',d.id,entry_id,v_actor);
 return result||jsonb_build_object('sourceNo',d.document_no,'documentType',d.document_type);
end;$f$;
create or replace function public.pending_business_accounting_documents(p_limit integer default 50)
returns table(id uuid,document_no text,document_type text,counterparty_name text,issue_date date,total_amount numeric) language sql stable security definer set search_path=public,pg_temp as $f$
 select d.id,d.document_no,d.document_type,d.counterparty_name,d.issue_date,d.total_amount from public.finance_documents d
 where d.organization_id=public.current_organization_id() and d.status<>'void' and public.has_access_permission('finance.voucher.create')
 and not exists(select 1 from public.business_accounting_runs r where r.organization_id=d.organization_id and r.source_type='finance_document' and r.source_id=d.id)
 order by d.issue_date,d.document_no limit greatest(1,least(coalesce(p_limit,50),200));
$f$;
revoke all on function public.generate_business_journal_draft(uuid) from public,anon;grant execute on function public.generate_business_journal_draft(uuid) to authenticated;
revoke all on function public.pending_business_accounting_documents(integer) from public,anon;grant execute on function public.pending_business_accounting_documents(integer) to authenticated;
commit;
