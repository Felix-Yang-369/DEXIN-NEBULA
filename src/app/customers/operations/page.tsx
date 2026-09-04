import type { Metadata } from "next";
import Link from "next/link";
import { BusinessDataTable } from "@/components/business/business-data-table";
import { CapabilityHero } from "@/components/business/capability-hero";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  claimCustomerAction,
  releaseCustomerAction,
  updateCreditAction,
} from "@/features/business-capabilities/actions";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "客户经营中心" };
export const dynamic = "force-dynamic";
const input = "h-8 rounded-lg border border-border bg-white px-2 text-xs";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const [e, p] = await Promise.all([requireCurrentEmployee(), searchParams]);
  const s = await createClient();
  const [{ data: c }, { data: pool }] = await Promise.all([
    s
      .from("customers")
      .select(
        "id,customer_no,name,status,level,pool_status,owner_employee_id,employees(name),customer_credit_profiles(credit_limit,payment_term_days,risk_level,status)",
      )
      .eq("pool_status", "assigned")
      .order("updated_at", { ascending: false })
      .limit(100),
    s
      .from("customers")
      .select("id,customer_no,name,level,pool_entered_at")
      .eq("pool_status", "public_pool")
      .order("pool_entered_at", { ascending: true })
      .limit(100),
  ]);
  return (
    <WorkflowShell
      activeItem="客户管理"
      breadcrumb="客户与销售 / 客户经营中心"
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <CapabilityHero
          eyebrow="PUBLIC POOL · CREDIT · CUSTOMER 360"
          title="客户经营中心"
          description="集中治理客户归属、公共客户池和信用额度；销售订单确认时由数据库强制校验信用风险。"
        />
        {(p.created || p.error) && (
          <div className="mt-4 rounded-md border p-3 text-xs">
            {p.error ?? p.created}
          </div>
        )}
        <section className="mt-5 rounded-md border border-border bg-white p-5">
          <h2 className="text-sm font-semibold">客户公海</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {(pool ?? []).map((x) => (
              <div className="rounded-md border border-border p-3" key={x.id}>
                <Link
                  className="text-xs font-medium text-primary"
                  href={`/customers/${x.id}`}
                >
                  {x.name}
                </Link>
                <div className="mt-1 text-xs text-muted-foreground">
                  {x.customer_no} · {x.level}级
                </div>
                <form action={claimCustomerAction} className="mt-3">
                  <input name="customerId" type="hidden" value={x.id} />
                  <button className="rounded-lg bg-muted px-3 py-2 text-xs text-primary">
                    领取客户
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>
        <h2 className="mb-3 mt-7 text-sm font-semibold">客户归属与信用</h2>
        <BusinessDataTable
          columns={[
            { key: "customer", label: "客户" },
            { key: "owner", label: "负责人" },
            { key: "credit", label: "信用控制", className: "min-w-[440px]" },
            { key: "pool", label: "公海操作", className: "min-w-[220px]" },
          ]}
          rowKeys={(c ?? []).map((x) => x.id)}
          rows={(c ?? []).map((x) => {
            const credit = x.customer_credit_profiles?.[0];
            const owner = Array.isArray(x.employees)
              ? x.employees[0]
              : x.employees;
            return {
              customer: (
                <Link
                  href={`/customers/${x.id}`}
                  className="font-medium text-primary"
                >
                  {x.name}
                  <small className="ml-2 font-mono text-muted-foreground">
                    {x.customer_no}
                  </small>
                </Link>
              ),
              owner: owner?.name ?? "未分配",
              credit: (
                <form
                  action={updateCreditAction}
                  className="flex flex-wrap gap-2"
                >
                  <input name="customerId" type="hidden" value={x.id} />
                  <input
                    className={input}
                    defaultValue={credit?.credit_limit ?? 0}
                    name="creditLimit"
                    type="number"
                  />
                  <input
                    className={`${input} w-16`}
                    defaultValue={credit?.payment_term_days ?? 30}
                    name="termDays"
                    type="number"
                  />
                  <select
                    className={input}
                    defaultValue={credit?.risk_level ?? "normal"}
                    name="riskLevel"
                  >
                    <option value="low">低风险</option>
                    <option value="normal">正常</option>
                    <option value="high">高风险</option>
                    <option value="blocked">冻结</option>
                  </select>
                  <select
                    className={input}
                    defaultValue={credit?.status ?? "active"}
                    name="status"
                  >
                    <option value="active">启用</option>
                    <option value="suspended">暂停</option>
                  </select>
                  <input name="note" type="hidden" />
                  <button className="rounded-lg bg-primary px-3 text-xs text-white">
                    保存
                  </button>
                </form>
              ),
              pool: (
                <form action={releaseCustomerAction} className="flex gap-2">
                  <input name="customerId" type="hidden" value={x.id} />
                  <input
                    className={`${input} w-28`}
                    name="reason"
                    placeholder="释放原因"
                    required
                  />
                  <button className="rounded-lg border border-border px-3 text-xs">
                    释放
                  </button>
                </form>
              ),
            };
          })}
          total={(c ?? []).length}
          page={1}
          pageSize={100}
          pathname="/customers/operations"
        />
      </main>
    </WorkflowShell>
  );
}
