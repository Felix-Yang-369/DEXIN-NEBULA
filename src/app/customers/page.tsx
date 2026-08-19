import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  CalendarClock,
  ContactRound,
  Handshake,
  MessageSquareText,
  PencilLine,
  ReceiptText,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  createCustomer,
  recordCustomerFollowup,
  updateCustomer,
} from "@/features/customers/server-actions";
import { CustomerLogoUpload } from "@/features/customers/customer-logo-upload";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "客户管理",
  description: "德馨星云客户档案、联系人、分级与跟进管理",
};

export const dynamic = "force-dynamic";

type Contact = {
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  wechat: string | null;
  is_primary: boolean;
};

type Customer = {
  id: string;
  customer_no: string;
  name: string;
  customer_type: "catering" | "gift" | "distributor" | "enterprise" | "other";
  level: "S" | "A" | "B" | "C";
  status: "lead" | "prospect" | "active" | "inactive";
  source: string | null;
  region: string | null;
  address: string | null;
  tags: string[];
  owner_employee_id: string | null;
  logo_path: string | null;
  last_contact_at: string | null;
  next_follow_up_on: string | null;
  note: string | null;
  created_at: string;
  customer_contacts: Contact[] | null;
  employees: { name: string } | { name: string }[] | null;
};

type Followup = {
  id: string;
  followup_type: "call" | "wechat" | "visit" | "email" | "other";
  summary: string;
  next_follow_up_on: string | null;
  created_at: string;
  customers: { name: string } | { name: string }[] | null;
  employees: { name: string } | { name: string }[] | null;
};

const typeLabels: Record<Customer["customer_type"], string> = {
  catering: "餐饮客户",
  gift: "礼品客户",
  distributor: "经销客户",
  enterprise: "企业客户",
  other: "其他客户",
};

const statusLabels: Record<Customer["status"], string> = {
  lead: "潜在线索",
  prospect: "重点跟进",
  active: "合作客户",
  inactive: "暂停合作",
};

const levelOrder: Record<Customer["level"], number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
};

const levelBadgeTones: Record<Customer["level"], string> = {
  S: "bg-[#ead191] text-[#795713]",
  A: "bg-[#d9eee4] text-[#0d6c78]",
  B: "bg-[#dfe9f5] text-[#426c9b]",
  C: "bg-[#eee7df] text-[#756657]",
};

const followupLabels: Record<Followup["followup_type"], string> = {
  call: "电话",
  wechat: "微信",
  visit: "拜访",
  email: "邮件",
  other: "其他",
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    hr: "人事行政",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "普通员工",
  };
  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

function formatDate(value: string | null) {
  if (!value) return "尚未安排";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  icon: React.ReactNode;
  tone: string;
}) {
  return (
    <article className="rounded-[20px] border border-border/75 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(23,57,50,.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-3 text-[27px] font-semibold tracking-[-0.04em]">
            {value}
          </div>
        </div>
        <div className={`grid size-10 place-items-center rounded-xl ${tone}`}>
          {icon}
        </div>
      </div>
      <div className="mt-4 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
        {note}
      </div>
    </article>
  );
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    error?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const configured = isSupabaseConfigured();
  const employee = configured ? await requireCurrentEmployee() : null;
  const feedback = await searchParams;
  const search = feedback.q?.trim() ?? "";
  const statusFilter = ["lead", "prospect", "active", "inactive"].includes(
    feedback.status ?? "",
  )
    ? feedback.status!
    : "all";

  let departmentCode: string | null = null;
  let customers: Customer[] = [];
  let followups: Followup[] = [];
  let assignableEmployees: Array<{ id: string; name: string; title: string | null }> =
    [];
  let customerLogoUrls = new Map<string, string>();
  let dataAvailable = !configured;

  if (employee) {
    const supabase = await createClient();
    if (employee.departmentId) {
      const { data: department } = await supabase
        .from("departments")
        .select("code")
        .eq("id", employee.departmentId)
        .maybeSingle();
      departmentCode = department?.code ?? null;
    }

    let customerQuery = supabase
      .from("customers")
      .select(
        "id, customer_no, name, customer_type, level, status, source, region, address, tags, owner_employee_id, logo_path, last_contact_at, next_follow_up_on, note, created_at, customer_contacts(name, position, phone, email, wechat, is_primary), employees!customers_owner_employee_id_fkey(name)",
      )
      .order("updated_at", { ascending: false })
      // Keep the complete internal customer directory visible until server-side
      // pagination is introduced. The previous limit hid older manual records
      // after the finance demo customer import exceeded 100 rows.
      .limit(500);

    if (statusFilter !== "all") {
      customerQuery = customerQuery.eq("status", statusFilter);
    }
    if (search) {
      customerQuery = customerQuery.or(
        `name.ilike.%${search.replaceAll(",", "")}%,customer_no.ilike.%${search.replaceAll(",", "")}%`,
      );
    }

    const [customerResult, followupResult, employeeResult] = await Promise.all([
      customerQuery,
      supabase
        .from("customer_followups")
        .select(
          "id, followup_type, summary, next_follow_up_on, created_at, customers(name), employees!customer_followups_created_by_employee_id_fkey(name)",
        )
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("employees")
        .select("id, name, title")
        .eq("organization_id", employee.organizationId)
        .eq("status", "active")
        .order("name"),
    ]);

    dataAvailable = !customerResult.error;
    customers = ((customerResult.data ?? []) as Customer[]).sort(
      (left, right) => levelOrder[left.level] - levelOrder[right.level],
    );
    followups = (followupResult.data ?? []) as Followup[];
    assignableEmployees = employeeResult.data ?? [];

    const logoPaths = customers
      .map((customer) => customer.logo_path)
      .filter((path): path is string => Boolean(path));
    if (logoPaths.length) {
      const { data: signedLogos } = await supabase.storage
        .from("customer-logos")
        .createSignedUrls(logoPaths, 3600);
      customerLogoUrls = new Map(
        (signedLogos ?? [])
          .filter(
            (
              item,
            ): item is typeof item & { path: string; signedUrl: string } =>
              Boolean(item.path && item.signedUrl),
          )
          .map((item) => [item.path, item.signedUrl]),
      );
    }
  }

  const canView =
    !employee ||
    employee.roleCodes.includes("chairman") ||
    ["DX-SALES", "DX-CS"].includes(departmentCode ?? "");
  const canManage =
    !employee ||
    ["DX-SALES", "DX-CS"].includes(departmentCode ?? "");
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);
  const activeCount = customers.filter((customer) => customer.status === "active").length;
  const newThisMonth = customers.filter((customer) =>
    customer.created_at.startsWith(currentMonth),
  ).length;
  const dueCount = customers.filter(
    (customer) =>
      customer.next_follow_up_on &&
      customer.next_follow_up_on <= today &&
      customer.status !== "inactive",
  ).length;

  return (
    <WorkflowShell
      activeItem="客户管理"
      breadcrumb="客户与销售 / 客户管理 / 客户"
      currentUser={
        employee
          ? {
              name: employee.name,
              roleLabel: roleLabel(employee.roleCodes) || "内部员工",
            }
          : undefined
      }
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <div className="absolute -right-16 -top-28 size-80 rounded-full border border-white/8" />
          <div className="absolute right-24 top-14 size-28 rounded-full border border-white/8" />
          <Handshake className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
                CRM <strong className="font-semibold text-white">·</strong>{" "}
                Customer Relationship Management
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                客户管理中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                统一沉淀餐饮、礼品、经销与企业客户资料，明确负责人、客户分级和下一次跟进计划。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[11px] font-medium text-[#105f51] shadow-[0_8px_22px_rgba(0,0,0,.12)] transition hover:-translate-y-0.5 hover:bg-[#edf8f3]"
                href="/quotes"
              >
                <ReceiptText className="size-3.5" />
                客户报价
              </Link>
              <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/8 px-4 text-[11px] text-white/68">
                <ShieldCheck className="size-4" />
                {canManage ? "客户维护权限已启用" : "客户经营只读视图"}
              </div>
            </div>
          </div>
        </section>

        {!canView ? (
          <section className="mt-5 rounded-[20px] border border-border/75 bg-white px-6 py-16 text-center">
            <ShieldCheck className="mx-auto size-10 text-muted-foreground/50" />
            <h2 className="mt-4 text-base font-semibold">暂无客户数据访问权限</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              客户联系方式仅向销售、客服、系统管理员和董事长开放。
            </p>
            <Link
              className="mt-5 inline-flex h-9 items-center rounded-xl bg-primary px-4 text-xs text-primary-foreground"
              href="/dashboard"
            >
              返回工作台
            </Link>
          </section>
        ) : (
          <>
            {!dataAvailable && configured && (
              <div className="mt-5 rounded-2xl border border-[#ead7b8] bg-[#fff9ef] px-4 py-3 text-xs text-[#8a6633]">
                客户数据表尚未初始化，请执行最新 Supabase 数据库迁移。
              </div>
            )}
            {feedback.created && (
              <div className="mt-5 rounded-2xl border border-[#cfe8ec] bg-[#edf7f2] px-4 py-3 text-xs text-[#0d6c78]">
                {feedback.created}
              </div>
            )}
            {feedback.updated && (
              <div className="mt-5 rounded-2xl border border-[#cfe8ec] bg-[#edf7f2] px-4 py-3 text-xs text-[#0d6c78]">
                {feedback.updated}
              </div>
            )}
            {feedback.error && (
              <div className="mt-5 rounded-2xl border border-[#eed3cd] bg-[#fff4f1] px-4 py-3 text-xs text-[#985846]">
                {feedback.error}
              </div>
            )}

            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                icon={<UsersRound className="size-5" />}
                label="客户总数"
                note="当前筛选范围内客户"
                tone="bg-[#eaf3f8] text-[#0d6c78]"
                value={`${customers.length}`}
              />
              <MetricCard
                icon={<UserRoundCheck className="size-5" />}
                label="合作客户"
                note="已进入稳定合作状态"
                tone="bg-[#edf2f7] text-[#42647a]"
                value={`${activeCount}`}
              />
              <MetricCard
                icon={<Sparkles className="size-5" />}
                label="本月新增"
                note="本月新建的客户档案"
                tone="bg-[#f3eef8] text-[#77518e]"
                value={`${newThisMonth}`}
              />
              <MetricCard
                icon={<CalendarClock className="size-5" />}
                label="待跟进"
                note="计划日期已经到期"
                tone="bg-[#fff4e7] text-[#9a6321]"
                value={`${dueCount} 项`}
              />
            </section>

            <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,.55fr)]">
              <section className="overflow-hidden rounded-[20px] border border-border/75 bg-white">
                <div className="flex flex-col gap-4 border-b border-border/70 px-5 py-5 sm:px-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold tracking-[-0.02em]">
                        客户档案
                      </h2>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        客户分类、负责人、联系人与跟进计划
                      </p>
                    </div>
                    <form className="flex gap-2" method="get">
                      <label className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                        <input
                          className="h-9 w-44 rounded-xl border border-border bg-[#fafcfe] pl-9 pr-3 text-[10px] outline-none focus:border-primary/40 sm:w-56"
                          defaultValue={search}
                          name="q"
                          placeholder="搜索客户或编号"
                        />
                      </label>
                      <button
                        className="h-9 rounded-xl bg-primary px-3 text-[10px] text-primary-foreground"
                        type="submit"
                      >
                        搜索
                      </button>
                    </form>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px]">
                    {[
                      ["all", "全部"],
                      ["lead", "潜在线索"],
                      ["prospect", "重点跟进"],
                      ["active", "合作客户"],
                      ["inactive", "暂停合作"],
                    ].map(([value, label]) => (
                      <Link
                        className={`rounded-full px-3 py-1.5 ${
                          statusFilter === value
                            ? "bg-primary text-primary-foreground"
                            : "bg-[#f2f5f4] text-muted-foreground"
                        }`}
                        href={
                          value === "all"
                            ? "/customers"
                            : `/customers?status=${value}`
                        }
                        key={value}
                      >
                        {label}
                      </Link>
                    ))}
                  </div>
                </div>

                {customers.length ? (
                  <div className="divide-y divide-border/65 px-5 sm:px-6">
                    {customers.map((customer) => {
                      const contact =
                        customer.customer_contacts?.find(
                          (item) => item.is_primary,
                        ) ?? customer.customer_contacts?.[0];
                      const owner = relatedOne(customer.employees);
                      return (
                        <article
                          className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-3 gap-y-2 py-2.5 lg:grid-cols-[52px_minmax(0,1.2fr)_minmax(180px,.72fr)_110px] lg:items-center"
                          key={customer.id}
                        >
                          <CustomerLogoUpload
                            canManage={canManage}
                            customerId={customer.id}
                            logoUrl={
                              customer.logo_path
                                ? customerLogoUrls.get(customer.logo_path)
                                : null
                            }
                            name={customer.name}
                          />
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-[13px] font-medium">
                                <Link
                                  className="transition-colors hover:text-primary"
                                  href={`/customers/${customer.id}`}
                                >
                                  {customer.name}
                                </Link>
                              </h3>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[9px] font-semibold ${levelBadgeTones[customer.level]}`}
                              >
                                {customer.level} 级
                              </span>
                              <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] text-muted-foreground">
                                {statusLabels[customer.status]}
                              </span>
                            </div>
                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                              <span>{customer.customer_no}</span>
                              <span>{typeLabels[customer.customer_type]}</span>
                              <span>{customer.region || "未填写地区"}</span>
                            </div>
                            {customer.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {customer.tags.slice(0, 4).map((tag) => (
                                  <span
                                    className="rounded-md bg-[#f2f6f4] px-2 py-1 text-[9px] text-[#527068]"
                                    key={tag}
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="col-span-2 lg:col-span-1">
                            <div className="flex items-center gap-2 text-[11px]">
                              <ContactRound className="size-3.5 text-primary/70" />
                              <span className="font-medium">
                                {contact?.name || "未添加联系人"}
                              </span>
                              {contact?.position && (
                                <span className="text-muted-foreground">
                                  · {contact.position}
                                </span>
                              )}
                            </div>
                            <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                              {contact?.phone || contact?.email || "暂无联系方式"}
                            </div>
                            <div className="text-[10px] leading-4 text-muted-foreground">
                              负责人：{owner?.name || "未分配"}
                            </div>
                          </div>
                          <div className="col-span-2 lg:col-span-1 lg:text-right">
                            <div className="text-[9px] text-muted-foreground">
                              最近联系
                            </div>
                            <div className="mt-1 text-[10px] font-medium text-foreground">
                              {formatDate(customer.last_contact_at)}
                            </div>
                          </div>
                          {canManage && (
                            <details className="group col-span-2 -mt-0.5 lg:col-span-4 lg:-mt-7">
                              <summary className="flex cursor-pointer list-none items-center justify-end gap-1.5 text-[10px] font-medium leading-4 text-primary marker:hidden">
                                <PencilLine className="size-3.5" />
                                编辑客户档案
                              </summary>
                              <form
                                action={updateCustomer}
                                className="mt-3 rounded-2xl border border-border/75 bg-[#fafcfe] p-4 sm:p-5 lg:mt-8"
                              >
                                <input
                                  name="customerId"
                                  type="hidden"
                                  value={customer.id}
                                />
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                  <label className="text-[10px] text-muted-foreground sm:col-span-2">
                                    客户名称
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.name}
                                      maxLength={120}
                                      name="name"
                                      required
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    客户类型
                                    <select
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.customer_type}
                                      name="customerType"
                                    >
                                      <option value="catering">餐饮客户</option>
                                      <option value="gift">礼品客户</option>
                                      <option value="distributor">经销客户</option>
                                      <option value="enterprise">企业客户</option>
                                      <option value="other">其他客户</option>
                                    </select>
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    客户等级
                                    <select
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.level}
                                      name="level"
                                    >
                                      <option value="S">S级 · 战略</option>
                                      <option value="A">A级 · 核心</option>
                                      <option value="B">B级 · 重点</option>
                                      <option value="C">C级 · 普通</option>
                                    </select>
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    当前状态
                                    <select
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.status}
                                      name="status"
                                    >
                                      <option value="lead">潜在线索</option>
                                      <option value="prospect">重点跟进</option>
                                      <option value="active">合作客户</option>
                                      <option value="inactive">暂停合作</option>
                                    </select>
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    客户负责人
                                    <select
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={
                                        customer.owner_employee_id ??
                                        employee?.id ??
                                        ""
                                      }
                                      name="ownerEmployeeId"
                                    >
                                      {assignableEmployees.map((member) => (
                                        <option
                                          key={member.id}
                                          value={member.id}
                                        >
                                          {member.name}
                                          {member.title
                                            ? ` · ${member.title}`
                                            : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    来源
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.source ?? ""}
                                      name="source"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    地区
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.region ?? ""}
                                      name="region"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground sm:col-span-2">
                                    客户标签
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.tags.join("，")}
                                      name="tags"
                                      placeholder="使用逗号分隔，最多 10 个"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground sm:col-span-2">
                                    地址
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.address ?? ""}
                                      name="address"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    下次跟进
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={
                                        customer.next_follow_up_on ?? ""
                                      }
                                      name="nextFollowUpOn"
                                      type="date"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    主要联系人
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={contact?.name ?? ""}
                                      name="contactName"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    联系人职位
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={contact?.position ?? ""}
                                      name="contactPosition"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    联系电话
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={contact?.phone ?? ""}
                                      name="contactPhone"
                                      type="tel"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    微信
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={contact?.wechat ?? ""}
                                      name="contactWechat"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground">
                                    联系邮箱
                                    <input
                                      className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                      defaultValue={contact?.email ?? ""}
                                      name="contactEmail"
                                      type="email"
                                    />
                                  </label>
                                  <label className="text-[10px] text-muted-foreground sm:col-span-2 lg:col-span-4">
                                    备注
                                    <textarea
                                      className="mt-1.5 min-h-20 w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-xs outline-none focus:border-primary/40"
                                      defaultValue={customer.note ?? ""}
                                      maxLength={500}
                                      name="note"
                                    />
                                  </label>
                                </div>
                                <div className="mt-4 flex justify-end gap-2 border-t border-border/70 pt-4">
                                  <span className="self-center text-[9px] text-muted-foreground">
                                    保存后会记录操作审计
                                  </span>
                                  <button
                                    className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                                    type="submit"
                                  >
                                    保存客户档案
                                  </button>
                                </div>
                              </form>
                            </details>
                          )}
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-6 py-16 text-center">
                    <Handshake className="mx-auto size-10 text-muted-foreground/45" />
                    <h3 className="mt-4 text-sm font-medium">还没有客户档案</h3>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      创建第一个客户后，联系人和跟进计划会显示在这里。
                    </p>
                  </div>
                )}
              </section>

              <div className="space-y-5">
                {canManage ? (
                  <>
                    <section className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-base font-semibold">新增客户</h2>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            建立客户主档和主要联系人
                          </p>
                        </div>
                        <Building2 className="size-5 text-primary/65" />
                      </div>
                      <form action={createCustomer} className="mt-5 space-y-4">
                        <label className="block text-[10px] text-muted-foreground">
                          客户名称
                          <input
                            className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                            name="name"
                            placeholder="企业或门店完整名称"
                            required
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-[10px] text-muted-foreground">
                            客户类型
                            <select
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                              defaultValue="enterprise"
                              name="customerType"
                            >
                              <option value="catering">餐饮客户</option>
                              <option value="gift">礼品客户</option>
                              <option value="distributor">经销客户</option>
                              <option value="enterprise">企业客户</option>
                              <option value="other">其他客户</option>
                            </select>
                          </label>
                          <label className="text-[10px] text-muted-foreground">
                            客户等级
                            <select
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                              defaultValue="B"
                              name="level"
                            >
                              <option value="S">S级 · 战略</option>
                              <option value="A">A级 · 核心</option>
                              <option value="B">B级 · 重点</option>
                              <option value="C">C级 · 普通</option>
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-[10px] text-muted-foreground">
                            当前状态
                            <select
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                              defaultValue="lead"
                              name="status"
                            >
                              <option value="lead">潜在线索</option>
                              <option value="prospect">重点跟进</option>
                              <option value="active">合作客户</option>
                              <option value="inactive">暂停合作</option>
                            </select>
                          </label>
                          <label className="text-[10px] text-muted-foreground">
                            客户负责人
                            <select
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                              defaultValue={employee?.id ?? ""}
                              name="ownerEmployeeId"
                            >
                              {assignableEmployees.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.name}
                                  {member.title ? ` · ${member.title}` : ""}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <label className="text-[10px] text-muted-foreground">
                            来源
                            <input
                              className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                              name="source"
                              placeholder="转介绍、展会等"
                            />
                          </label>
                          <label className="text-[10px] text-muted-foreground">
                            地区
                            <input
                              className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                              name="region"
                              placeholder="城市或区域"
                            />
                          </label>
                        </div>
                        <label className="block text-[10px] text-muted-foreground">
                          客户标签
                          <input
                            className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                            name="tags"
                            placeholder="团购，高端餐饮，长期合作"
                          />
                        </label>
                        <div className="border-t border-border/70 pt-4">
                          <div className="mb-3 text-[10px] font-medium text-foreground">
                            主要联系人
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="text-[10px] text-muted-foreground">
                              姓名
                              <input
                                className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                                name="contactName"
                              />
                            </label>
                            <label className="text-[10px] text-muted-foreground">
                              职位
                              <input
                                className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                                name="contactPosition"
                              />
                            </label>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3">
                            <label className="text-[10px] text-muted-foreground">
                              电话
                              <input
                                className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                                name="contactPhone"
                                type="tel"
                              />
                            </label>
                            <label className="text-[10px] text-muted-foreground">
                              微信
                              <input
                                className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                                name="contactWechat"
                              />
                            </label>
                          </div>
                          <label className="mt-3 block text-[10px] text-muted-foreground">
                            企业邮箱
                            <input
                              className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                              name="contactEmail"
                              type="email"
                            />
                          </label>
                        </div>
                        <label className="block text-[10px] text-muted-foreground">
                          地址
                          <input
                            className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                            name="address"
                          />
                        </label>
                        <label className="block text-[10px] text-muted-foreground">
                          备注
                          <textarea
                            className="mt-1.5 min-h-18 w-full resize-y rounded-xl border border-border px-3 py-2.5 text-xs outline-none focus:border-primary/40"
                            maxLength={500}
                            name="note"
                          />
                        </label>
                        <button
                          className="h-10 w-full rounded-xl bg-primary text-xs font-medium text-primary-foreground"
                          type="submit"
                        >
                          创建客户档案
                        </button>
                      </form>
                    </section>

                    {customers.length > 0 && (
                      <section className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h2 className="text-base font-semibold">记录客户跟进</h2>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              更新沟通结果和下一步计划
                            </p>
                          </div>
                          <MessageSquareText className="size-5 text-primary/65" />
                        </div>
                        <form
                          action={recordCustomerFollowup}
                          className="mt-5 space-y-4"
                        >
                          <label className="block text-[10px] text-muted-foreground">
                            客户
                            <select
                              className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                              name="customerId"
                            >
                              {customers
                                .filter((customer) => customer.status !== "inactive")
                                .map((customer) => (
                                  <option key={customer.id} value={customer.id}>
                                    {customer.name}
                                  </option>
                                ))}
                            </select>
                          </label>
                          <div className="grid grid-cols-2 gap-3">
                            <label className="text-[10px] text-muted-foreground">
                              跟进方式
                              <select
                                className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                                defaultValue="wechat"
                                name="followupType"
                              >
                                <option value="call">电话</option>
                                <option value="wechat">微信</option>
                                <option value="visit">拜访</option>
                                <option value="email">邮件</option>
                                <option value="other">其他</option>
                              </select>
                            </label>
                            <label className="text-[10px] text-muted-foreground">
                              下次跟进
                              <input
                                className="mt-1.5 h-10 w-full rounded-xl border border-border px-3 text-xs outline-none focus:border-primary/40"
                                name="nextFollowUpOn"
                                type="date"
                              />
                            </label>
                          </div>
                          <label className="block text-[10px] text-muted-foreground">
                            跟进内容
                            <textarea
                              className="mt-1.5 min-h-24 w-full resize-y rounded-xl border border-border px-3 py-2.5 text-xs outline-none focus:border-primary/40"
                              maxLength={500}
                              name="summary"
                              placeholder="记录客户需求、反馈和下一步动作"
                              required
                            />
                          </label>
                          <button
                            className="h-10 w-full rounded-xl bg-primary text-xs font-medium text-primary-foreground"
                            type="submit"
                          >
                            保存跟进记录
                          </button>
                        </form>
                      </section>
                    )}
                  </>
                ) : (
                  <section className="rounded-[20px] border border-border/75 bg-white p-6 text-center">
                    <ShieldCheck className="mx-auto size-8 text-muted-foreground/50" />
                    <h2 className="mt-3 text-sm font-medium">当前为客户只读视图</h2>
                    <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                      客户创建与跟进操作由销售、客服或系统管理员负责。
                    </p>
                  </section>
                )}

                <section className="rounded-[20px] border border-border/75 bg-[#eef4f8] p-5 sm:p-6">
                  <div className="flex items-center gap-3">
                    <MessageSquareText className="size-5 text-primary" />
                    <h2 className="text-sm font-semibold">最近跟进</h2>
                  </div>
                  {followups.length ? (
                    <div className="mt-4 space-y-4">
                      {followups.slice(0, 5).map((followup) => {
                        const customer = relatedOne(followup.customers);
                        const author = relatedOne(followup.employees);
                        return (
                          <div
                            className="border-b border-[#dce9e3] pb-4 last:border-0 last:pb-0"
                            key={followup.id}
                          >
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-medium">
                                {customer?.name ?? "客户"}
                              </span>
                              <span className="text-muted-foreground">
                                {followupLabels[followup.followup_type]}
                              </span>
                            </div>
                            <p className="mt-2 line-clamp-2 text-[10px] leading-5 text-[#5c7587]">
                              {followup.summary}
                            </p>
                            <div className="mt-2 text-[9px] text-muted-foreground">
                              {author?.name ?? "员工"} ·{" "}
                              {formatDate(followup.created_at)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
                      客户跟进记录会显示在这里。
                    </p>
                  )}
                </section>
              </div>
            </div>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
