import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  CalendarClock,
  ContactRound,
  Landmark,
  Mail,
  MapPin,
  MessageSquareText,
  Phone,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { CustomerLevelBadge } from "@/components/business/customer-level-badge";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  createCustomerContact,
  createCustomerLegalEntity,
  createLegalEntityBankAccount,
  recordCustomerFollowup,
} from "@/features/customers/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "客户详情",
  description: "德馨星云 CRM 客户档案、联系人和跟进时间线",
};

export const dynamic = "force-dynamic";

type Contact = {
  id: string;
  name: string;
  position: string | null;
  phone: string | null;
  email: string | null;
  wechat: string | null;
  is_primary: boolean;
  created_at: string;
};

type Followup = {
  id: string;
  followup_type: "call" | "wechat" | "visit" | "email" | "other";
  summary: string;
  next_follow_up_on: string | null;
  created_at: string;
  employees: { name: string } | Array<{ name: string }> | null;
};

type BankAccount = {
  id: string;
  account_name: string;
  bank_name: string;
  bank_branch: string | null;
  account_no: string;
  currency: string;
  is_default: boolean;
  status: "active" | "inactive";
};

type LegalEntity = {
  id: string;
  entity_code: string;
  legal_name: string;
  short_name: string | null;
  unified_social_credit_code: string | null;
  entity_type: "company" | "individual_business" | "government" | "other";
  taxpayer_type: "general" | "small_scale" | "non_taxable" | "other";
  registered_address: string | null;
  invoice_phone: string | null;
  invoice_email: string | null;
  status: "active" | "inactive";
  is_default: boolean;
  note: string | null;
  legal_entity_bank_accounts: BankAccount[];
};

const typeLabels: Record<string, string> = {
  catering: "餐饮客户",
  gift: "礼品客户",
  distributor: "经销客户",
  enterprise: "企业客户",
  other: "其他客户",
};

const statusLabels: Record<string, string> = {
  lead: "潜在线索",
  prospect: "重点跟进",
  active: "合作客户",
  inactive: "暂停合作",
};

const followupLabels: Record<string, string> = {
  call: "电话",
  wechat: "微信",
  visit: "拜访",
  email: "邮件",
  other: "其他",
};

const entityTypeLabels: Record<LegalEntity["entity_type"], string> = {
  company: "企业法人",
  individual_business: "个体工商户",
  government: "机关事业单位",
  other: "其他主体",
};

const taxpayerTypeLabels: Record<LegalEntity["taxpayer_type"], string> = {
  general: "一般纳税人",
  small_scale: "小规模纳税人",
  non_taxable: "非税主体",
  other: "其他",
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(value: string | null, includeTime = false) {
  if (!value) return "尚未安排";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(includeTime
      ? { hour: "2-digit", minute: "2-digit", hour12: false }
      : {}),
  }).format(new Date(value));
}

function maskAccountNo(value: string) {
  return value.length <= 8
    ? value
    : `${value.slice(0, 4)} ···· ${value.slice(-4)}`;
}

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const { id } = await params;
  const feedback = await searchParams;
  const supabase = await createClient();

  const [
    customerResult,
    contactResult,
    followupResult,
    departmentResult,
    legalEntityResult,
  ] =
    await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, customer_no, name, customer_type, level, status, source, region, address, tags, owner_employee_id, last_contact_at, next_follow_up_on, note, created_at, employees!customers_owner_employee_id_fkey(name)",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("customer_contacts")
        .select(
          "id, name, position, phone, email, wechat, is_primary, created_at",
        )
        .eq("customer_id", id)
        .order("is_primary", { ascending: false })
        .order("updated_at", { ascending: false }),
      supabase
        .from("customer_followups")
        .select(
          "id, followup_type, summary, next_follow_up_on, created_at, employees!customer_followups_created_by_employee_id_fkey(name)",
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(100),
      employee.departmentId
        ? supabase
            .from("departments")
            .select("code")
            .eq("id", employee.departmentId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from("customer_legal_entities")
        .select(
          "id, entity_code, legal_name, short_name, unified_social_credit_code, entity_type, taxpayer_type, registered_address, invoice_phone, invoice_email, status, is_default, note, legal_entity_bank_accounts(id, account_name, bank_name, bank_branch, account_no, currency, is_default, status)",
        )
        .eq("customer_id", id)
        .order("is_default", { ascending: false })
        .order("legal_name", { ascending: true }),
    ]);

  if (!customerResult.data || customerResult.error) {
    notFound();
  }

  const customer = customerResult.data;
  const contacts = (contactResult.data ?? []) as Contact[];
  const followups = (followupResult.data ?? []) as Followup[];
  const legalEntities = (legalEntityResult.data ?? []) as LegalEntity[];
  const owner = relatedOne(customer.employees);
  const canManage =
    ["DX-SALES", "DX-CS"].includes(departmentResult.data?.code ?? "");
  const canManageEntities =
    canManage || employee.roleCodes.includes("finance");
  const canManageBankAccounts = employee.roleCodes.includes("finance");

  return (
    <WorkflowShell
      activeItem="客户管理"
      breadcrumb="客户与销售 / 客户管理 / 客户详情"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <div className="absolute -right-20 -top-28 size-80 rounded-full border border-white/8" />
          <Building2 className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative">
            <Link
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              href="/customers"
            >
              <ArrowLeft className="size-3.5" />
              返回客户管理
            </Link>
            <div className="mt-5 text-xs font-medium tracking-[0.12em] text-muted-foreground">
              CRM <strong className="font-semibold text-white">·</strong>{" "}
              Customer Relationship Management
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                {customer.name}
              </h1>
              <CustomerLevelBadge
                className="px-3 py-1"
                level={customer.level as "S" | "A" | "B" | "C"}
              />
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
                {statusLabels[customer.status]}
              </span>
            </div>
            <p className="mt-3 text-sm text-white/55">
              {customer.customer_no} · {typeLabels[customer.customer_type]} ·
              负责人：{owner?.name ?? "未分配"}
            </p>
          </div>
        </section>

        {feedback.created && (
          <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
            {feedback.created}
          </div>
        )}
        {feedback.error && (
          <div className="mt-5 rounded-lg border border-border bg-muted px-4 py-3 text-xs text-foreground">
            {feedback.error}
          </div>
        )}

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_380px]">
          <div className="space-y-5">
            <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
              <h2 className="text-base font-semibold">客户概览</h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ["来源", customer.source ?? "未填写"],
                  ["地区", customer.region ?? "未填写"],
                  ["最近联系", formatDate(customer.last_contact_at)],
                  ["下次跟进", formatDate(customer.next_follow_up_on)],
                ].map(([label, value]) => (
                  <div className="rounded-md bg-muted p-3" key={label}>
                    <div className="text-xs text-muted-foreground">
                      {label}
                    </div>
                    <div className="mt-1.5 text-xs font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="rounded-md border border-border/70 p-4">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="size-3.5" />
                    地址
                  </div>
                  <p className="mt-2 text-xs leading-6">
                    {customer.address ?? "尚未填写客户地址"}
                  </p>
                </div>
                <div className="rounded-md border border-border/70 p-4">
                  <div className="text-xs text-muted-foreground">备注</div>
                  <p className="mt-2 text-xs leading-6">
                    {customer.note ?? "尚未填写客户备注"}
                  </p>
                </div>
              </div>
              {customer.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {customer.tags.map((tag: string) => (
                    <span
                      className="rounded-full bg-muted px-3 py-1 text-xs text-primary"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Landmark className="size-4 text-primary" />
                    <h2 className="text-base font-semibold">法律实体与结算主体</h2>
                  </div>
                  <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                    CRM 按“{customer.name}”统一经营，合同、发票、应收应付与收款核销按具体法律实体执行。
                  </p>
                </div>
                <span className="w-fit rounded-full bg-muted px-3 py-1 text-xs font-medium text-primary">
                  {legalEntities.length} 个法律实体
                </span>
              </div>

              {legalEntities.length > 0 ? (
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {legalEntities.map((entity) => (
                    <article
                      className="rounded-lg border border-border bg-muted p-4"
                      key={entity.id}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xs font-semibold leading-5">
                              {entity.legal_name}
                            </h3>
                            {entity.is_default && entity.status === "active" && (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-white">
                                默认结算主体
                              </span>
                            )}
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                entity.status === "active"
                                  ? "bg-muted text-foreground"
                                  : "bg-muted text-foreground"
                              }`}
                            >
                              {entity.status === "active" ? "启用" : "停用"}
                            </span>
                          </div>
                          <div className="mt-1.5 text-xs text-muted-foreground">
                            {entity.entity_code}
                            {entity.short_name ? ` · ${entity.short_name}` : ""}
                          </div>
                        </div>
                        <Landmark className="size-5 shrink-0 text-foreground" />
                      </div>

                      <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2">
                        <div>
                          <dt className="text-muted-foreground">主体类型</dt>
                          <dd className="mt-1 font-medium">
                            {entityTypeLabels[entity.entity_type]} · {taxpayerTypeLabels[entity.taxpayer_type]}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">统一社会信用代码</dt>
                          <dd className="mt-1 font-medium tracking-wide">
                            {entity.unified_social_credit_code ?? "待补充"}
                          </dd>
                        </div>
                        <div className="sm:col-span-2">
                          <dt className="text-muted-foreground">注册地址</dt>
                          <dd className="mt-1 leading-5">
                            {entity.registered_address ?? "待补充"}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">开票联系电话</dt>
                          <dd className="mt-1">{entity.invoice_phone ?? "待补充"}</dd>
                        </div>
                        <div>
                          <dt className="text-muted-foreground">开票邮箱</dt>
                          <dd className="mt-1 break-all">{entity.invoice_email ?? "待补充"}</dd>
                        </div>
                      </dl>

                      {entity.legal_entity_bank_accounts.length > 0 && (
                        <div className="mt-4 space-y-2 border-t border-border/70 pt-3">
                          {entity.legal_entity_bank_accounts.map((account) => (
                            <div
                              className="flex items-center justify-between gap-3 rounded-md bg-white px-3 py-2 text-xs"
                              key={account.id}
                            >
                              <div className="min-w-0">
                                <div className="truncate font-medium">
                                  {account.bank_name}
                                  {account.bank_branch ? ` · ${account.bank_branch}` : ""}
                                </div>
                                <div className="mt-0.5 text-muted-foreground">
                                  {maskAccountNo(account.account_no)} · {account.currency}
                                </div>
                              </div>
                              {account.is_default && (
                                <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-foreground">
                                  默认账户
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {canManageBankAccounts && (
                        <details className="mt-4 border-t border-border/70 pt-3">
                          <summary className="cursor-pointer text-xs font-medium text-primary">
                            + 添加银行账户
                          </summary>
                          <form
                            action={createLegalEntityBankAccount}
                            className="mt-3 grid gap-2"
                          >
                            <input name="customerId" type="hidden" value={customer.id} />
                            <input name="legalEntityId" type="hidden" value={entity.id} />
                            <input
                              className="h-9 rounded-md border border-border px-3 text-xs"
                              defaultValue={entity.legal_name}
                              maxLength={160}
                              name="accountName"
                              placeholder="账户名称"
                              required
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                className="h-9 rounded-md border border-border px-3 text-xs"
                                maxLength={120}
                                name="bankName"
                                placeholder="开户银行"
                                required
                              />
                              <input
                                className="h-9 rounded-md border border-border px-3 text-xs"
                                maxLength={120}
                                name="bankBranch"
                                placeholder="开户支行"
                              />
                            </div>
                            <div className="grid grid-cols-[1fr_72px] gap-2">
                              <input
                                className="h-9 rounded-md border border-border px-3 text-xs"
                                maxLength={40}
                                name="accountNo"
                                placeholder="银行账号"
                                required
                              />
                              <input
                                className="h-9 rounded-md border border-border px-3 text-xs uppercase"
                                defaultValue="CNY"
                                maxLength={3}
                                name="currency"
                              />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-muted-foreground">
                              <input className="accent-primary" name="isDefault" type="checkbox" />
                              设为该实体的默认账户
                            </label>
                            <button className="h-9 rounded-md bg-primary text-xs font-medium text-white" type="submit">
                              保存银行账户
                            </button>
                          </form>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-border px-4 py-9 text-center">
                  <Landmark className="mx-auto size-7 text-muted-foreground/45" />
                  <p className="mt-3 text-xs font-medium">尚未建立法律实体</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    建立后才能把该客户的财务往来精确归属到开票和收付款主体。
                  </p>
                </div>
              )}

              {canManageEntities && (
                <details className="mt-4 rounded-lg border border-border bg-muted p-4">
                  <summary className="cursor-pointer text-xs font-medium text-primary">
                    + 新增法律实体
                  </summary>
                  <form action={createCustomerLegalEntity} className="mt-4 grid gap-3">
                    <input name="customerId" type="hidden" value={customer.id} />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" maxLength={160} name="legalName" placeholder="工商登记全称 *" required />
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" maxLength={80} name="shortName" placeholder="常用简称" />
                    </div>
                    <input className="h-10 rounded-md border border-border bg-white px-3 text-xs uppercase" maxLength={18} name="creditCode" placeholder="统一社会信用代码（可后补）" />
                    <div className="grid grid-cols-2 gap-3">
                      <select className="h-10 rounded-md border border-border bg-white px-3 text-xs" defaultValue="company" name="entityType">
                        <option value="company">企业法人</option>
                        <option value="individual_business">个体工商户</option>
                        <option value="government">机关事业单位</option>
                        <option value="other">其他主体</option>
                      </select>
                      <select className="h-10 rounded-md border border-border bg-white px-3 text-xs" defaultValue="general" name="taxpayerType">
                        <option value="general">一般纳税人</option>
                        <option value="small_scale">小规模纳税人</option>
                        <option value="non_taxable">非税主体</option>
                        <option value="other">其他</option>
                      </select>
                    </div>
                    <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="registeredAddress" placeholder="工商注册地址" />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="invoicePhone" placeholder="开票联系电话" />
                      <input className="h-10 rounded-md border border-border bg-white px-3 text-xs" name="invoiceEmail" placeholder="开票邮箱" type="email" />
                    </div>
                    <textarea className="min-h-16 rounded-md border border-border bg-white px-3 py-2 text-xs" name="note" placeholder="主体备注（选填）" />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input className="size-4 accent-primary" name="isDefault" type="checkbox" />
                      设为该客户默认结算主体
                    </label>
                    <button className="h-10 rounded-md bg-primary text-xs font-medium text-white" type="submit">
                      保存法律实体
                    </button>
                  </form>
                </details>
              )}
            </section>

            <section className="rounded-md border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">跟进时间线</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    电话、微信、拜访和邮件沟通记录
                  </p>
                </div>
                <MessageSquareText className="size-5 text-primary/65" />
              </div>
              {followups.length > 0 ? (
                <div className="mt-5 space-y-0">
                  {followups.map((followup, index) => {
                    const author = relatedOne(followup.employees);
                    return (
                      <article
                        className="relative grid grid-cols-[24px_1fr] gap-3 pb-6 last:pb-0"
                        key={followup.id}
                      >
                        {index < followups.length - 1 && (
                          <span className="absolute bottom-0 left-[11px] top-6 w-px bg-border" />
                        )}
                        <span className="relative mt-1 size-6 rounded-full border-4 border-border bg-primary" />
                        <div className="rounded-lg bg-muted p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-xs font-medium text-primary">
                              {followupLabels[followup.followup_type]}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(followup.created_at, true)}
                            </span>
                          </div>
                          <p className="mt-2 text-xs leading-6">
                            {followup.summary}
                          </p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            记录人：{author?.name ?? "内部员工"}
                            {followup.next_follow_up_on
                              ? ` · 下次跟进 ${formatDate(followup.next_follow_up_on)}`
                              : ""}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-lg border border-dashed border-border py-12 text-center">
                  <MessageSquareText className="mx-auto size-7 text-muted-foreground/45" />
                  <p className="mt-3 text-xs text-muted-foreground">
                    还没有客户跟进记录
                  </p>
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-md border border-border/75 bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold">客户联系人</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {contacts.length} 位联系人
                  </p>
                </div>
                <ContactRound className="size-5 text-primary/65" />
              </div>
              <div className="mt-4 space-y-3">
                {contacts.map((contact) => (
                  <article
                    className="rounded-lg border border-border/70 p-4"
                    key={contact.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-medium">{contact.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {contact.position ?? "职位未填写"}
                        </div>
                      </div>
                      {contact.is_primary && (
                        <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-primary">
                          主要联系人
                        </span>
                      )}
                    </div>
                    <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                      {contact.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="size-3" />
                          {contact.phone}
                        </div>
                      )}
                      {contact.email && (
                        <div className="flex items-center gap-2">
                          <Mail className="size-3" />
                          {contact.email}
                        </div>
                      )}
                      {contact.wechat && <div>微信：{contact.wechat}</div>}
                    </div>
                  </article>
                ))}
                {contacts.length === 0 && (
                  <p className="rounded-md bg-muted px-3 py-6 text-center text-xs text-muted-foreground">
                    还没有联系人
                  </p>
                )}
              </div>
            </section>

            {canManage ? (
              <>
                <section className="rounded-md border border-border/75 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <UserPlus className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">新增联系人</h2>
                  </div>
                  <form action={createCustomerContact} className="mt-4 space-y-3">
                    <input name="customerId" type="hidden" value={customer.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="h-10 rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                        maxLength={80}
                        name="name"
                        placeholder="姓名 *"
                        required
                      />
                      <input
                        className="h-10 rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                        name="position"
                        placeholder="职位"
                      />
                    </div>
                    <input
                      className="h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                      name="phone"
                      placeholder="联系电话"
                      type="tel"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        className="h-10 rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                        name="wechat"
                        placeholder="微信"
                      />
                      <input
                        className="h-10 rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
                        name="email"
                        placeholder="邮箱"
                        type="email"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        className="size-4 accent-primary"
                        name="isPrimary"
                        type="checkbox"
                      />
                      设为主要联系人
                    </label>
                    <button
                      className="h-10 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground"
                      type="submit"
                    >
                      添加联系人
                    </button>
                  </form>
                </section>

                <section className="rounded-md border border-border/75 bg-white p-5">
                  <div className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-primary" />
                    <h2 className="text-sm font-semibold">记录本次跟进</h2>
                  </div>
                  <form action={recordCustomerFollowup} className="mt-4 space-y-3">
                    <input name="customerId" type="hidden" value={customer.id} />
                    <input name="returnTo" type="hidden" value="detail" />
                    <div className="grid grid-cols-2 gap-3">
                      <select
                        className="h-10 rounded-md border border-border bg-white px-3 text-xs outline-none"
                        defaultValue="wechat"
                        name="followupType"
                      >
                        <option value="call">电话</option>
                        <option value="wechat">微信</option>
                        <option value="visit">拜访</option>
                        <option value="email">邮件</option>
                        <option value="other">其他</option>
                      </select>
                      <input
                        className="h-10 rounded-md border border-border px-3 text-xs outline-none"
                        name="nextFollowUpOn"
                        type="date"
                      />
                    </div>
                    <textarea
                      className="min-h-24 w-full resize-y rounded-md border border-border px-3 py-2.5 text-xs leading-5 outline-none focus:border-primary/40"
                      maxLength={500}
                      name="summary"
                      placeholder="记录客户需求、反馈和下一步动作"
                      required
                    />
                    <button
                      className="h-10 w-full rounded-md bg-primary text-xs font-medium text-primary-foreground"
                      type="submit"
                    >
                      保存跟进记录
                    </button>
                  </form>
                </section>
              </>
            ) : (
              <section className="rounded-md border border-border/75 bg-white p-5 text-center">
                <ShieldCheck className="mx-auto size-7 text-muted-foreground/50" />
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  当前账号拥有客户只读权限。
                </p>
              </section>
            )}
          </aside>
        </div>
      </main>
    </WorkflowShell>
  );
}
