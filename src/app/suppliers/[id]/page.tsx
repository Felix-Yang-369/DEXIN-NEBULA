import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ContactRound,
  FileCheck2,
  FileText,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { qualificationRisk } from "@/features/suppliers/risk";
import {
  addSupplierContactAction,
  addSupplierQualificationAction,
  saveSupplierAction,
} from "@/features/suppliers/server-actions";
import { SupplierFields } from "@/features/suppliers/supplier-fields";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "供应商档案",
  description: "德馨星云供应商详情、联系人和资质台账",
};

export const dynamic = "force-dynamic";

type SupplierDetail = {
  id: string;
  supplier_no: string;
  name: string;
  short_name: string | null;
  unified_credit_code: string | null;
  category: string;
  cooperation_level: string;
  cooperation_status: string;
  legal_representative: string | null;
  business_scope: string | null;
  address: string | null;
  settlement_terms: string | null;
  owner_employee_id: string | null;
  note: string | null;
  created_at: string;
  owner: { name: string } | { name: string }[] | null;
  contacts: Array<{
    id: string;
    name: string;
    position: string | null;
    mobile: string | null;
    email: string | null;
    is_primary: boolean;
    note: string | null;
  }>;
  qualifications: Array<{
    id: string;
    qualification_type: string;
    name: string;
    certificate_no: string | null;
    effective_on: string | null;
    expires_on: string | null;
    business_document_id: string | null;
    status: string;
    note: string | null;
    document:
      | { id: string; title: string; document_no: string }
      | Array<{ id: string; title: string; document_no: string }>
      | null;
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
  core: "核心供应商",
  preferred: "优选供应商",
  standard: "标准供应商",
  backup: "备选供应商",
};
const statusLabels: Record<string, string> = {
  candidate: "待准入",
  active: "合作中",
  suspended: "暂停合作",
  inactive: "已终止",
};
const qualificationLabels: Record<string, string> = {
  business_license: "营业执照",
  food_production: "食品生产许可证",
  food_operation: "食品经营许可证",
  brand_authorization: "品牌授权书",
  quality_report: "质检报告",
  other: "其他资质",
};

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
  if (params.created) return "供应商档案已创建。";
  if (params.updated) return "供应商档案已更新。";
  if (params.contactCreated) return "供应商联系人已添加。";
  if (params.qualificationCreated) return "供应商资质已登记。";
  const labels: Record<string, string> = {
    invalid: "请检查供应商档案内容。",
    duplicate: "统一社会信用代码已存在。",
    save_failed: "档案保存失败，请确认权限后重试。",
    invalid_contact: "联系人姓名以及手机号或邮箱为必填项。",
    contact_failed: "联系人添加失败。",
    invalid_qualification: "请检查资质名称、类型和有效期。",
    qualification_failed: "资质登记失败，请确认关联文件有效。",
  };
  return params.error ? labels[params.error] ?? "操作失败。" : null;
}

export default async function SupplierDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { id } = await params;
  const feedback = await searchParams;
  const currentEmployee = await requireCurrentEmployee();
  const supabase = await createClient();
  const [supplierResult, permissionResult, employeeResult, documentResult] =
    await Promise.all([
      supabase
        .from("suppliers")
        .select(
          "id, supplier_no, name, short_name, unified_credit_code, category, cooperation_level, cooperation_status, legal_representative, business_scope, address, settlement_terms, owner_employee_id, note, created_at, owner:employees!suppliers_owner_employee_id_fkey(name), contacts:supplier_contacts(id, name, position, mobile, email, is_primary, note), qualifications:supplier_qualifications(id, qualification_type, name, certificate_no, effective_on, expires_on, business_document_id, status, note, document:business_documents(id, title, document_no))",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase.rpc("can_manage_suppliers"),
      supabase
        .from("employees")
        .select("id, name, employee_no")
        .eq("status", "active")
        .order("employee_no"),
      supabase
        .from("business_documents")
        .select("id, title, document_no, related_party_name")
        .eq("category", "supplier")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
  if (!supplierResult.data) notFound();

  const supplier = supplierResult.data as unknown as SupplierDetail;
  const canManage = Boolean(permissionResult.data);
  const employees = employeeResult.data ?? [];
  const documents = documentResult.data ?? [];
  const owner = one(supplier.owner);
  const message = feedbackMessage(feedback);
  const inputClass =
    "h-10 rounded-xl border border-border bg-white px-3 text-xs text-foreground";

  return (
    <WorkflowShell
      activeItem="供应商管理"
      breadcrumb={`供应链 / 供应商管理 / ${supplier.short_name ?? supplier.name}`}
      currentUser={{
        name: currentEmployee.name,
        roleLabel: currentEmployee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-primary"
          href="/suppliers"
        >
          <ArrowLeft className="size-4" />
          返回供应商列表
        </Link>

        <section className="relative mt-5 overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
          <ShieldCheck className="absolute right-10 top-1/2 hidden size-36 -translate-y-1/2 text-white/[0.06] md:block" />
          <div className="relative">
            <div className="text-[10px] tracking-[0.16em] text-[#79d8d5]">
              {supplier.supplier_no} · SUPPLIER PROFILE
            </div>
            <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div>
                <h1 className="text-2xl font-semibold tracking-[-0.03em] sm:text-[30px]">
                  {supplier.name}
                </h1>
                <p className="mt-3 text-sm text-white/55">
                  {categoryLabels[supplier.category]} ·{" "}
                  {levelLabels[supplier.cooperation_level]} ·{" "}
                  {statusLabels[supplier.cooperation_status]}
                </p>
              </div>
              <div className="text-[10px] text-white/50">
                内部负责人：{owner?.name ?? "未分配"}
              </div>
            </div>
          </div>
        </section>

        {message && (
          <div
            className={`mt-4 rounded-xl border px-4 py-3 text-xs ${
              feedback.error
                ? "border-[#ead3d3] bg-[#fff7f7] text-[#914949]"
                : "border-[#cfe6dc] bg-[#f1f8f5] text-primary"
            }`}
          >
            {message}
          </div>
        )}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
          <article className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-primary" />
              <h2 className="text-base font-semibold">企业信息</h2>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              {[
                ["统一社会信用代码", supplier.unified_credit_code ?? "未填写"],
                ["法定代表人", supplier.legal_representative ?? "未填写"],
                ["结算约定", supplier.settlement_terms ?? "未填写"],
                ["内部负责人", owner?.name ?? "未分配"],
              ].map(([label, value]) => (
                <div className="rounded-xl bg-[#f6f8f7] p-4" key={label}>
                  <dt className="text-[9px] text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-xs font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {supplier.address && (
              <div className="mt-4 flex items-start gap-2 text-[10px] leading-5 text-muted-foreground">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-primary" />
                {supplier.address}
              </div>
            )}
            {supplier.business_scope && (
              <div className="mt-4 border-t border-border/60 pt-4 text-[10px] leading-6 text-muted-foreground">
                <strong className="text-foreground">经营范围：</strong>
                {supplier.business_scope}
              </div>
            )}
          </article>

          <article className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <ContactRound className="size-5 text-primary" />
              <h2 className="text-base font-semibold">联系人</h2>
            </div>
            <div className="mt-4 space-y-3">
              {(supplier.contacts ?? []).length ? (
                supplier.contacts
                  .slice()
                  .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
                  .map((contact) => (
                    <div
                      className="rounded-xl border border-border/70 p-4"
                      key={contact.id}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-xs font-semibold">
                          {contact.name}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {contact.position ?? ""}
                          </span>
                        </div>
                        {contact.is_primary && (
                          <span className="rounded-full bg-[#eaf6f0] px-2 py-1 text-[9px] text-primary">
                            主要联系人
                          </span>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
                        {contact.mobile && (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="size-3" />
                            {contact.mobile}
                          </span>
                        )}
                        {contact.email && (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="size-3" />
                            {contact.email}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-8 text-center text-[10px] text-muted-foreground">
                  尚未添加联系人。
                </div>
              )}
            </div>
          </article>
        </section>

        {canManage && (
          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <details className="rounded-[20px] border border-border/75 bg-white p-5">
              <summary className="cursor-pointer list-none text-sm font-semibold">
                + 添加联系人
              </summary>
              <form
                action={addSupplierContactAction}
                className="mt-5 grid gap-3 sm:grid-cols-2"
              >
                <input name="supplierId" type="hidden" value={supplier.id} />
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  姓名 *
                  <input className={inputClass} name="name" required />
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  职务
                  <input className={inputClass} name="position" />
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  手机
                  <input className={inputClass} name="mobile" />
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  邮箱
                  <input className={inputClass} name="email" type="email" />
                </label>
                <label className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <input name="isPrimary" type="checkbox" />
                  设为主要联系人
                </label>
                <button
                  className="h-10 rounded-xl bg-primary px-4 text-xs text-white sm:justify-self-end"
                  type="submit"
                >
                  保存联系人
                </button>
              </form>
            </details>

            <details className="rounded-[20px] border border-border/75 bg-white p-5">
              <summary className="cursor-pointer list-none text-sm font-semibold">
                + 登记供应商资质
              </summary>
              <form
                action={addSupplierQualificationAction}
                className="mt-5 grid gap-3 sm:grid-cols-2"
              >
                <input name="supplierId" type="hidden" value={supplier.id} />
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  资质类型 *
                  <select className={inputClass} name="qualificationType">
                    {Object.entries(qualificationLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  资质名称 *
                  <input className={inputClass} name="name" required />
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  证书 / 文件编号
                  <input className={inputClass} name="certificateNo" />
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  关联私有文件
                  <select className={inputClass} name="businessDocumentId">
                    <option value="">暂不关联</option>
                    {documents.map((document) => (
                      <option key={document.id} value={document.id}>
                        {document.document_no} · {document.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  生效日期
                  <input className={inputClass} name="effectiveOn" type="date" />
                </label>
                <label className="grid gap-2 text-[10px] text-muted-foreground">
                  到期日期
                  <input className={inputClass} name="expiresOn" type="date" />
                </label>
                <button
                  className="h-10 rounded-xl bg-primary px-4 text-xs text-white sm:col-start-2 sm:justify-self-end"
                  type="submit"
                >
                  登记资质
                </button>
              </form>
            </details>
          </section>
        )}

        <section className="mt-5 overflow-hidden rounded-[20px] border border-border/75 bg-white">
          <div className="flex flex-col justify-between gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-base font-semibold">资质台账</h2>
              <p className="mt-1 text-[10px] text-muted-foreground">
                到期前 60 天进入预警
              </p>
            </div>
            <Link
              className="inline-flex items-center gap-1 text-[10px] text-primary"
              href={`/documents?category=supplier&q=${encodeURIComponent(supplier.name)}`}
            >
              管理供应商文件
              <FileText className="size-3" />
            </Link>
          </div>
          {(supplier.qualifications ?? []).length ? (
            <div className="divide-y divide-border/60">
              {supplier.qualifications.map((qualification) => {
                const risk = qualificationRisk(
                  qualification.expires_on,
                  today(),
                );
                const document = one(qualification.document);
                return (
                  <div
                    className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_160px_160px_150px] md:items-center"
                    key={qualification.id}
                  >
                    <div>
                      <div className="text-xs font-medium">
                        {qualification.name}
                      </div>
                      <div className="mt-1 text-[9px] text-muted-foreground">
                        {qualificationLabels[qualification.qualification_type]} ·{" "}
                        {qualification.certificate_no ?? "未填写编号"}
                      </div>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {qualification.effective_on ?? "未设置"}
                      </div>
                      <div className="mt-1">
                        至 {qualification.expires_on ?? "长期 / 未设置"}
                      </div>
                    </div>
                    <span
                      className={`inline-flex w-fit items-center gap-1 rounded-lg px-2 py-1 text-[9px] ${
                        risk === "expired"
                          ? "bg-[#fff0f0] text-[#a34f4f]"
                          : risk === "expiring"
                            ? "bg-[#fff4df] text-[#96651f]"
                            : "bg-[#eaf6f0] text-primary"
                      }`}
                    >
                      {risk === "expired" || risk === "expiring" ? (
                        <CircleAlert className="size-3" />
                      ) : (
                        <CheckCircle2 className="size-3" />
                      )}
                      {risk === "expired"
                        ? "已过期"
                        : risk === "expiring"
                          ? "即将到期"
                          : risk === "valid"
                            ? "有效"
                            : "未设到期日"}
                    </span>
                    {document ? (
                      <Link
                        className="inline-flex items-center gap-1 text-[10px] text-primary"
                        href={`/documents/${document.id}/download`}
                      >
                        <FileCheck2 className="size-3" />
                        {document.document_no}
                      </Link>
                    ) : (
                      <span className="text-[9px] text-muted-foreground">
                        未关联文件
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-[10px] text-muted-foreground">
              尚未登记供应商资质。
            </div>
          )}
        </section>

        {canManage && (
          <details className="mt-5 rounded-[20px] border border-border/75 bg-[#f5f8fb] p-5">
            <summary className="cursor-pointer list-none text-sm font-semibold">
              编辑供应商档案
            </summary>
            <form action={saveSupplierAction} className="mt-5">
              <SupplierFields employees={employees} supplier={supplier} />
              <div className="mt-4 flex justify-end">
                <button
                  className="h-10 rounded-xl bg-primary px-5 text-xs font-medium text-white"
                  type="submit"
                >
                  保存修改
                </button>
              </div>
            </form>
          </details>
        )}

        {supplier.note && (
          <div className="mt-5 rounded-[18px] border border-border bg-white px-5 py-4 text-[10px] leading-5 text-muted-foreground">
            <strong className="text-foreground">内部备注：</strong>
            {supplier.note}
          </div>
        )}
      </main>
    </WorkflowShell>
  );
}
