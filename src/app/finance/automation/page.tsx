import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDataTable } from "@/components/business/business-data-table";
import { CapabilityHero } from "@/components/business/capability-hero";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { generateBusinessJournalAction } from "@/features/business-capabilities/actions";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "业财自动化" };
export const dynamic = "force-dynamic";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const [e, p] = await Promise.all([requireCurrentEmployee(), searchParams]);
  const s = await createClient();
  const [{ data: pending }, { data: runs }, { data: rules }] =
    await Promise.all([
      s.rpc("pending_business_accounting_documents", { p_limit: 100 }),
      s
        .from("business_accounting_runs")
        .select(
          "id,source_id,status,created_at,journal_entries(id,entry_no,status,summary)",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      s
        .from("business_accounting_rules")
        .select(
          "id,source_type,summary_template,debit:accounting_accounts!business_accounting_rules_debit_account_id_fkey(code,name),credit:accounting_accounts!business_accounting_rules_credit_account_id_fkey(code,name),status",
        ),
    ]);
  return (
    <WorkflowShell
      activeItem="财务管理"
      breadcrumb="财务 / 业财自动化"
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <CapabilityHero
          eyebrow="BUSINESS · ACCOUNTING · TRACEABILITY"
          title="业财自动化"
          description="把应收、应付业务单据按可配置规则生成正式会计内核的凭证草稿，继续执行独立审核与过账。"
        />
        {(p.created || p.error) && (
          <div className="mt-4 rounded-md border p-3 text-xs">
            {p.error ?? p.created}
          </div>
        )}
        <section className="mt-5 grid gap-3 sm:grid-cols-2">
          {(rules ?? []).map((x) => {
            const d = Array.isArray(x.debit) ? x.debit[0] : x.debit;
            const c = Array.isArray(x.credit) ? x.credit[0] : x.credit;
            return (
              <article
                className="rounded-md border border-border bg-white p-5"
                key={x.id}
              >
                <div className="text-xs text-muted-foreground">
                  {x.source_type === "receivable" ? "应收确认" : "采购应付"}
                </div>
                <div className="mt-2 text-xs font-semibold">
                  借 {d?.code} {d?.name}
                </div>
                <div className="mt-1 text-xs font-semibold">
                  贷 {c?.code} {c?.name}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {x.summary_template}
                </div>
              </article>
            );
          })}
        </section>
        <h2 className="mb-3 mt-7 text-sm font-semibold">待生成凭证</h2>
        <BusinessDataTable
          columns={[
            { key: "no", label: "业务单据" },
            { key: "type", label: "类型" },
            { key: "counterparty", label: "往来单位" },
            { key: "date", label: "日期" },
            { key: "amount", label: "金额", align: "right" },
            { key: "action", label: "操作" },
          ]}
          rowKeys={(pending ?? []).map((x: { id: string }) => x.id)}
          rows={(pending ?? []).map(
            (x: {
              id: string;
              document_no: string;
              document_type: string;
              counterparty_name: string;
              issue_date: string;
              total_amount: number;
            }) => ({
              no: (
                <span className="font-mono text-primary">{x.document_no}</span>
              ),
              type: x.document_type === "receivable" ? "应收" : "应付",
              counterparty: x.counterparty_name,
              date: x.issue_date,
              amount: `¥${Number(x.total_amount).toFixed(2)}`,
              action: (
                <form action={generateBusinessJournalAction}>
                  <input name="documentId" type="hidden" value={x.id} />
                  <button className="rounded-lg bg-primary px-3 py-2 text-xs text-white">
                    生成凭证草稿
                  </button>
                </form>
              ),
            }),
          )}
          total={(pending ?? []).length}
          page={1}
          pageSize={100}
          pathname="/finance/automation"
        />
        <h2 className="mb-3 mt-7 text-sm font-semibold">近期生成记录</h2>
        <div className="grid gap-2">
          {(runs ?? []).map((x) => {
            const j = Array.isArray(x.journal_entries)
              ? x.journal_entries[0]
              : x.journal_entries;
            return (
              <Link
                className="flex justify-between rounded-md border border-border bg-white p-4 text-xs"
                href={
                  j
                    ? `/finance/accounting/entries/${j.id}`
                    : "/finance/accounting"
                }
                key={x.id}
              >
                <span>
                  {j?.entry_no ?? "凭证"} · {j?.summary}
                </span>
                <span>{j?.status}</span>
              </Link>
            );
          })}
        </div>
      </main>
    </WorkflowShell>
  );
}
