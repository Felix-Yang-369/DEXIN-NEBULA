import type { Metadata } from "next";
import { BusinessDataTable } from "@/components/business/business-data-table";
import { CapabilityHero } from "@/components/business/capability-hero";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  createRfqAction,
  completePurchaseReturnAction,
  inspectReceiptAction,
  matchProcurementAction,
  recordQuoteAction,
} from "@/features/business-capabilities/actions";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "采购控制塔" };
export const dynamic = "force-dynamic";
const input = "h-9 rounded-md border border-border bg-white px-3 text-xs";
const card = "rounded-md border border-border bg-white p-5";
const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const [e, p] = await Promise.all([requireCurrentEmployee(), searchParams]);
  const s = await createClient();
  const [
    { data: req },
    { data: sup },
    { data: rfqs },
    { data: receipts },
    { data: docs },
  ] = await Promise.all([
    s
      .from("purchase_requests")
      .select("id,request_no,title")
      .eq("status", "approved")
      .limit(100),
    s
      .from("suppliers")
      .select("id,name")
      .eq("cooperation_status", "active")
      .limit(100),
    s
      .from("procurement_rfqs")
      .select(
        "id,rfq_no,title,status,due_at,procurement_rfq_suppliers(supplier_id,quoted_amount,score,suppliers(name))",
      )
      .order("created_at", { ascending: false })
      .limit(30),
    s
      .from("goods_receipts")
      .select(
        "id,receipt_no,total_amount,goods_receipt_items(quantity),goods_receipt_inspections(id)",
      )
      .eq("status", "posted")
      .order("created_at", { ascending: false })
      .limit(50),
    s
      .from("finance_documents")
      .select(
        "id,document_no,counterparty_name,total_amount,procurement_document_matches(status,variance_amount)",
      )
      .eq("document_type", "payable")
      .eq("source_type", "purchase")
      .neq("status", "void")
      .limit(50),
  ]);
  const openReceipts = (receipts ?? []).filter(
    (r) => !r.goods_receipt_inspections?.length,
  );
  const unmatched = (docs ?? []).filter(
    (d) => !d.procurement_document_matches?.length,
  );
  const { data: rejectedInspections } = await s
    .from("goods_receipt_inspections")
    .select(
      "id,inspection_no,rejected_quantity,defect_reason,purchase_returns(id),goods_receipts(receipt_no)",
    )
    .gt("rejected_quantity", 0)
    .order("inspected_at", { ascending: false })
    .limit(30);
  const returnable = (rejectedInspections ?? []).filter(
    (row) => !row.purchase_returns?.length,
  );
  return (
    <WorkflowShell
      activeItem="采购管理"
      breadcrumb="供应链 / 采购 / 控制塔"
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <CapabilityHero
          eyebrow="RFQ · QUALITY · THREE-WAY MATCH"
          title="采购控制塔"
          description="将询比价、到货质检和订单—入库—发票匹配接入现有采购闭环。"
        />
        <Feedback p={p} />
        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          <section className={card}>
            <h2 className="text-sm font-semibold">发起询价</h2>
            <form action={createRfqAction} className="mt-4 grid gap-3">
              <input
                className={input}
                name="title"
                placeholder="询价主题"
                required
              />
              <select className={input} name="requestId">
                <option value="">不关联采购申请</option>
                {(req ?? []).map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.request_no} · {x.title}
                  </option>
                ))}
              </select>
              <input className={input} name="dueAt" type="datetime-local" />
              <div className="max-h-32 overflow-auto rounded-md border border-border p-2">
                {(sup ?? []).map((x) => (
                  <label className="flex gap-2 p-1 text-xs" key={x.id}>
                    <input name="supplierIds" type="checkbox" value={x.id} />
                    {x.name}
                  </label>
                ))}
              </div>
              <button className="h-9 rounded-md bg-primary text-xs text-white">
                创建询价单
              </button>
            </form>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold">到货质检</h2>
            <form action={inspectReceiptAction} className="mt-4 grid gap-3">
              <select className={input} name="receiptId" required>
                {openReceipts.map((x) => (
                  <option value={x.id} key={x.id}>
                    {x.receipt_no} · {Number(x.total_amount).toFixed(2)}
                  </option>
                ))}
              </select>
              <input
                className={input}
                name="acceptedQuantity"
                placeholder="合格数量"
                step=".001"
                type="number"
                required
              />
              <input
                className={input}
                name="rejectedQuantity"
                placeholder="不合格数量"
                step=".001"
                type="number"
                required
              />
              <input className={input} name="reason" placeholder="不合格原因" />
              <button className="h-9 rounded-md bg-primary text-xs text-white">
                提交质检结果
              </button>
            </form>
          </section>
          <section className={card}>
            <h2 className="text-sm font-semibold">三单匹配</h2>
            <div className="mt-4 space-y-2">
              {unmatched.map((x) => (
                <form
                  action={matchProcurementAction}
                  className="flex items-center justify-between rounded-md border border-border p-3 text-xs"
                  key={x.id}
                >
                  <input name="documentId" type="hidden" value={x.id} />
                  <span>
                    {x.document_no}
                    <small className="ml-2 text-muted-foreground">
                      {x.counterparty_name}
                    </small>
                  </span>
                  <button className="rounded-lg bg-muted px-3 py-2 text-primary">
                    执行匹配
                  </button>
                </form>
              ))}
            </div>
          </section>
        </div>
        {returnable.length > 0 && (
          <section className={`${card} mt-5`}>
            <h2 className="text-sm font-semibold">采购退货</h2>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {returnable.map((row) => {
                const receipt = Array.isArray(row.goods_receipts)
                  ? row.goods_receipts[0]
                  : row.goods_receipts;
                return (
                  <form
                    action={completePurchaseReturnAction}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3 text-xs"
                    key={row.id}
                  >
                    <input name="inspectionId" type="hidden" value={row.id} />
                    <span className="mr-auto">
                      <b>{row.inspection_no}</b> · {receipt?.receipt_no} ·
                      不合格 {row.rejected_quantity}
                    </span>
                    <input
                      className={input}
                      defaultValue={row.defect_reason ?? "质检不合格退货"}
                      name="reason"
                      required
                    />
                    <button className="h-9 rounded-md bg-primary px-3 text-xs text-white">
                      完成退货
                    </button>
                  </form>
                );
              })}
            </div>
          </section>
        )}
        <h2 className="mb-3 mt-7 text-sm font-semibold">询价与报价比较</h2>
        <BusinessDataTable
          columns={[
            { key: "rfq", label: "询价单" },
            { key: "status", label: "状态" },
            { key: "quotes", label: "供应商报价", className: "min-w-[520px]" },
          ]}
          rowKeys={(rfqs ?? []).map((x) => x.id)}
          rows={(rfqs ?? []).map((x) => ({
            rfq: (
              <div>
                <b>{x.rfq_no}</b>
                <div className="text-xs text-muted-foreground">
                  {x.title}
                </div>
              </div>
            ),
            status: x.status,
            quotes: (
              <div className="space-y-2">
                {x.procurement_rfq_suppliers.map((q) => (
                  <form
                    action={recordQuoteAction}
                    className="flex flex-wrap gap-2"
                    key={q.supplier_id}
                  >
                    <input name="rfqId" type="hidden" value={x.id} />
                    <input
                      name="supplierId"
                      type="hidden"
                      value={q.supplier_id}
                    />
                    <span className="w-24 pt-2">{one(q.suppliers)?.name}</span>
                    <input
                      className={input}
                      defaultValue={q.quoted_amount ?? ""}
                      name="amount"
                      placeholder="金额"
                      type="number"
                    />
                    <input className={input} name="promisedOn" type="date" />
                    <input
                      className={input}
                      defaultValue={q.score ?? ""}
                      name="score"
                      placeholder="评分"
                      type="number"
                    />
                    <input name="paymentTerms" type="hidden" />
                    <input name="note" type="hidden" />
                    <button className="rounded-lg bg-primary px-3 text-xs text-white">
                      保存
                    </button>
                  </form>
                ))}
              </div>
            ),
          }))}
          total={(rfqs ?? []).length}
          page={1}
          pageSize={30}
          pathname="/purchasing/control"
        />
      </main>
    </WorkflowShell>
  );
}
function Feedback({ p }: { p: { created?: string; error?: string } }) {
  return p.created || p.error ? (
    <div
      className={`mt-4 rounded-md border p-3 text-xs ${p.error ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}
    >
      {p.error ?? p.created}
    </div>
  ) : null;
}
