import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  FileWarning,
  Search,
  ShieldCheck,
  UserRoundSearch,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { qualificationRisk, supplierRiskSummary } from "@/features/suppliers/risk";
import { saveSupplierAction } from "@/features/suppliers/server-actions";
import { SupplierFields } from "@/features/suppliers/supplier-fields";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "供应商管理 SRM",
  description: "德馨星云供应商主档、联系人、资质和风险管理",
};

export const dynamic = "force-dynamic";

type SupplierRow = {
  id: string;
  supplier_no: string;
  name: string;
  short_name: string | null;
  category: string;
  cooperation_level: string;
  cooperation_status: string;
  settlement_terms: string | null;
  created_at: string;
  owner: { name: string } | { name: string }[] | null;
  contacts: Array<{
    id: string;
    name: string;
    mobile: string | null;
    is_primary: boolean;
  }>;
  qualifications: Array<{
    id: string;
    expires_on: string | null;
    status: string;
  }>;
};

const categoryLabels: Record<string, string> = {
  rice: "大米粮食",
  oil: "食用油",
  gift: "礼盒礼赠",
  logistics: "物流仓储",
  packaging: "包装物料",
  service: "服务类",
  other: "其他",
};
const levelLabels: Record<string, string> = {
  core: "核心",
  preferred: "优选",
  standard: "标准",
  backup: "备选",
};
const statusLabels: Record<string, string> = {
  candidate: "待准入",
  active: "合作中",
  suspended: "暂停合作",
  inactive: "已终止",
};
const riskLabels = {
  expired: ["资质已过期", "bg-[#fff0f0] text-[#a34f4f]"],
  expiring: ["60 天内到期", "bg-[#fff4df] text-[#96651f]"],
  missing: ["未登记资质", "bg-[#f2f4f3] text-muted-foreground"],
  normal: ["资质正常", "bg-[#eaf6f0] text-primary"],
} as const;

function one<T>(value: T | T[] | null) {
  return Array.isArray(value) ? value[0] ?? null : value;
}

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function feedbackMessage(params: Record<string, string | undefined>) {
  if (params.error === "invalid") return "请检查供应商必填信息。";
  if (params.error === "duplicate") return "统一社会信用代码已存在。";
  if (params.error === "save_failed") return "供应商创建失败，请确认权限后重试。";
  return null;
}

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 80);
  const status = ["candidate", "active", "suspended", "inactive"].includes(
    params.status ?? "",
  )
    ? params.status!
    : "all";
  const supabase = await createClient();
  const [permissionResult, employeesResult] = await Promise.all([
    supabase.rpc("can_manage_suppliers"),
    supabase
      .from("employees")
      .select("id, name, employee_no")
      .eq("status", "active")
      .order("employee_no"),
  ]);
  let supplierQuery = supabase
    .from("suppliers")
    .select(
      "id, supplier_no, name, short_name, category, cooperation_level, cooperation_status, settlement_terms, created_at, owner:employees!suppliers_owner_employee_id_fkey(name), contacts:supplier_contacts(id, name, mobile, is_primary), qualifications:supplier_qualifications(id, expires_on, status)",
    )
    .order("cooperation_level")
    .order("name")
    .limit(300);
  if (status !== "all") supplierQuery = supplierQuery.eq("cooperation_status", status);
  if (query) {
    const safe = query.replaceAll(",", "");
    supplierQuery = supplierQuery.or(
      `name.ilike.%${safe}%,short_name.ilike.%${safe}%,supplier_no.ilike.%${safe}%,unified_credit_code.ilike.%${safe}%`,
    );
  }
  const supplierResult = await supplierQuery;
  const suppliers = (supplierResult.data ?? []) as unknown as SupplierRow[];
  const canManage = Boolean(permissionResult.data);
  const employees = employeesResult.data ?? [];
  const asOfDate = today();
  const expiredCount = suppliers.filter(
    (supplier) =>
      supplierRiskSummary(supplier.qualifications ?? [], asOfDate) === "expired",
  ).length;
  const expiringCount = suppliers.reduce(
    (count, supplier) =>
      count +
      (supplier.qualifications ?? []).filter(
        (item) =>
          item.status === "active" &&
          qualificationRisk(item.expires_on, asOfDate) === "expiring",
      ).length,
    0,
  );
  const message = feedbackMessage(params);

  return (
    <WorkflowShell
      activeItem="供应商管理"
      breadcrumb="供应商管理 / SRM"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
          <div className="absolute -right-20 -top-24 size-80 rounded-full border border-white/10" />
          <UserRoundSearch className="absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative">
            <div className="text-[10px] tracking-[0.16em] text-[#79d8d5]">
              SRM · SUPPLIER RELATIONSHIP MANAGEMENT
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.03em] sm:text-[30px]">
              供应商管理
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              统一供应商准入档案、联系人、合作状态和资质风险，为后续询价、采购订单与履约评价建立可信主数据。
            </p>
          </div>
        </section>

        {message && (
          <div className="mt-4 rounded-xl border border-[#ead3d3] bg-[#fff7f7] px-4 py-3 text-xs text-[#914949]">
            {message}
          </div>
        )}
        {supplierResult.error && (
          <div className="mt-4 rounded-xl border border-[#ead3d3] bg-[#fff7f7] px-4 py-3 text-xs text-[#914949]">
            无法读取供应商数据，请确认 SRM 数据库迁移已经执行。
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              value: suppliers.length,
              label: "供应商总数",
              icon: Building2,
              note: "当前筛选结果",
            },
            {
              value: suppliers.filter(
                (item) => item.cooperation_status === "active",
              ).length,
              label: "合作中",
              icon: CheckCircle2,
              note: "有效合作关系",
            },
            {
              value: expiringCount,
              label: "临期资质",
              icon: FileWarning,
              note: "未来 60 天内",
            },
            {
              value: expiredCount,
              label: "风险供应商",
              icon: AlertTriangle,
              note: "存在已过期资质",
            },
          ].map(({ value, label, icon: MetricIcon, note }) => {
            return (
              <article
                className="rounded-[18px] border border-border/75 bg-white p-5"
                key={String(label)}
              >
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-semibold">{value}</div>
                  <span className="grid size-9 place-items-center rounded-xl bg-[#edf4f7] text-primary">
                    <MetricIcon className="size-4" />
                  </span>
                </div>
                <div className="mt-2 text-xs font-medium">{label}</div>
                <div className="mt-1 text-[9px] text-muted-foreground">{note}</div>
              </article>
            );
          })}
        </section>

        {canManage && (
          <details className="mt-5 rounded-[20px] border border-border/75 bg-white p-5">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              + 新建供应商档案
            </summary>
            <form action={saveSupplierAction} className="mt-5">
              <SupplierFields employees={employees} />
              <div className="mt-4 flex justify-end">
                <button
                  className="h-10 rounded-xl bg-primary px-5 text-xs font-medium text-white"
                  type="submit"
                >
                  创建供应商
                </button>
              </div>
            </form>
          </details>
        )}

        <section className="mt-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-base font-semibold">供应商档案</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              真实业务主档；未录入时保持空状态
            </p>
          </div>
          <form className="flex flex-wrap gap-2">
            <label className="relative">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-10 w-56 rounded-xl border border-border bg-white pl-9 pr-3 text-xs"
                defaultValue={query}
                name="q"
                placeholder="名称、编号或信用代码"
              />
            </label>
            <select
              className="h-10 rounded-xl border border-border bg-white px-3 text-xs"
              defaultValue={status}
              name="status"
            >
              <option value="all">全部状态</option>
              <option value="candidate">待准入</option>
              <option value="active">合作中</option>
              <option value="suspended">暂停合作</option>
              <option value="inactive">已终止</option>
            </select>
            <button className="h-10 rounded-xl bg-[#edf3f0] px-4 text-xs text-primary">
              查询
            </button>
          </form>
        </section>

        <section className="mt-4 space-y-3">
          {suppliers.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-border bg-white p-12 text-center">
              <CircleDashed className="mx-auto size-8 text-muted-foreground/50" />
              <h3 className="mt-3 text-sm font-semibold">暂无供应商档案</h3>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {canManage
                  ? "可从上方创建第一家真实供应商。"
                  : "采购部门尚未录入供应商主档。"}
              </p>
            </div>
          ) : (
            suppliers.map((supplier) => {
              const owner = one(supplier.owner);
              const primary =
                (supplier.contacts ?? []).find((item) => item.is_primary) ??
                supplier.contacts?.[0];
              const risk = supplierRiskSummary(
                supplier.qualifications ?? [],
                asOfDate,
              );
              const [riskLabel, riskTone] = riskLabels[risk];
              return (
                <Link
                  className="group grid gap-4 rounded-[18px] border border-border/75 bg-white px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_35px_-28px_rgba(16,62,53,.55)] lg:grid-cols-[minmax(260px,1.4fr)_150px_180px_150px_auto] lg:items-center"
                  href={`/suppliers/${supplier.id}`}
                  key={supplier.id}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eaf3f8] text-sm font-semibold text-primary">
                      {(supplier.short_name ?? supplier.name).slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">
                        {supplier.name}
                      </div>
                      <div className="mt-1 text-[9px] text-muted-foreground">
                        {supplier.supplier_no} ·{" "}
                        {categoryLabels[supplier.category] ?? supplier.category}
                      </div>
                    </div>
                  </div>
                  <div className="text-[10px]">
                    <div className="font-medium">
                      {levelLabels[supplier.cooperation_level] ?? "标准"}供应商
                    </div>
                    <div className="mt-1 text-muted-foreground">
                      {statusLabels[supplier.cooperation_status]}
                    </div>
                  </div>
                  <div className="text-[10px]">
                    <div className="font-medium">{primary?.name ?? "未添加联系人"}</div>
                    <div className="mt-1 text-muted-foreground">
                      {primary?.mobile ?? "暂无联系方式"}
                    </div>
                  </div>
                  <div className="text-[10px]">
                    <span className={`rounded-lg px-2 py-1 ${riskTone}`}>
                      {riskLabel}
                    </span>
                    <div className="mt-2 text-muted-foreground">
                      负责人：{owner?.name ?? "未分配"}
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })
          )}
        </section>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-[10px] text-primary"
            href="/documents?category=supplier"
          >
            <ShieldCheck className="size-4" />
            供应商资质文件
          </Link>
          <Link
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-white px-4 text-[10px] text-primary"
            href="/inventory"
          >
            查看仓储库存
          </Link>
        </div>
      </main>
    </WorkflowShell>
  );
}
