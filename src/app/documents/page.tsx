import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  Building2,
  Download,
  FileArchive,
  FileCheck2,
  FileClock,
  FileText,
  FolderKey,
  Search,
  ShieldCheck,
  Upload,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  archiveBusinessDocument,
  uploadBusinessDocument,
} from "@/features/documents/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "文件中心",
  description: "德馨星云合同、客户文件、供应商资质和内部资料管理",
};

export const dynamic = "force-dynamic";

type DocumentCategory = "contract" | "customer" | "supplier" | "internal";
type DocumentVisibility = "organization" | "department" | "restricted";

type BusinessDocument = {
  id: string;
  document_no: string;
  category: DocumentCategory;
  title: string;
  description: string | null;
  original_file_name: string;
  mime_type: string;
  file_size: number;
  related_party_name: string | null;
  reference_no: string | null;
  effective_on: string | null;
  expires_on: string | null;
  visibility: DocumentVisibility;
  viewer_role_codes: string[];
  uploaded_by_employee_id: string;
  status: "active" | "archived";
  created_at: string;
  employees: { name: string } | { name: string }[] | null;
  departments: { name: string } | { name: string }[] | null;
  customers: { name: string } | { name: string }[] | null;
};

const categoryLabels: Record<DocumentCategory, string> = {
  contract: "合同文件",
  customer: "客户文件",
  supplier: "供应商资质",
  internal: "内部资料",
};

const categoryTones: Record<DocumentCategory, string> = {
  contract: "bg-[#eaf3f8] text-[#0d6c78]",
  customer: "bg-[#edf3fb] text-[#426c9b]",
  supplier: "bg-[#fff4df] text-[#96651f]",
  internal: "bg-[#f1edfa] text-[#72529a]",
};

const visibilityLabels: Record<DocumentVisibility, string> = {
  organization: "全公司可见",
  department: "本部门可见",
  restricted: "指定角色可见",
};

const roleLabels: Record<string, string> = {
  employee: "普通员工",
  department_lead: "部门负责人",
  hr: "人事行政",
  finance: "财务",
  admin: "管理员",
  chairman: "董事长",
};

function relatedOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function displayDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function displaySize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function roleLabel(roleCodes: string[]) {
  return roleCodes.map((code) => roleLabels[code]).filter(Boolean).join(" · ");
}

function MetricCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <article className="rounded-[20px] border border-border/75 bg-white p-5 shadow-[0_8px_30px_-24px_rgba(23,57,50,.35)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-3 text-[27px] font-semibold tracking-[-0.04em]">
            {value}
          </div>
        </div>
        <span className={`grid size-10 place-items-center rounded-xl ${tone}`}>
          {icon}
        </span>
      </div>
      <div className="mt-4 border-t border-border/70 pt-3 text-[10px] text-muted-foreground">
        {note}
      </div>
    </article>
  );
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    category?: string;
    status?: string;
    created?: string;
    updated?: string;
    error?: string;
  }>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const query = (params.q ?? "").trim().slice(0, 80);
  const category = ["contract", "customer", "supplier", "internal"].includes(
    params.category ?? "",
  )
    ? (params.category as DocumentCategory)
    : "all";
  const status = params.status === "archived" ? "archived" : "active";
  const supabase = await createClient();

  const [
    departmentResult,
    contractPermission,
    customerPermission,
    supplierPermission,
    internalPermission,
    customerResult,
  ] = await Promise.all([
    employee.departmentId
      ? supabase
          .from("departments")
          .select("code")
          .eq("id", employee.departmentId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.rpc("can_upload_business_document", { p_category: "contract" }),
    supabase.rpc("can_upload_business_document", { p_category: "customer" }),
    supabase.rpc("can_upload_business_document", { p_category: "supplier" }),
    supabase.rpc("can_upload_business_document", { p_category: "internal" }),
    supabase
      .from("customers")
      .select("id, name, customer_no")
      .neq("status", "inactive")
      .order("name")
      .limit(200),
  ]);

  let documentQuery = supabase
    .from("business_documents")
    .select(
      "id, document_no, category, title, description, original_file_name, mime_type, file_size, related_party_name, reference_no, effective_on, expires_on, visibility, viewer_role_codes, uploaded_by_employee_id, status, created_at, employees!business_documents_uploaded_by_employee_id_fkey(name), departments!business_documents_owner_department_id_fkey(name), customers(name)",
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(200);

  if (category !== "all") documentQuery = documentQuery.eq("category", category);
  if (query) {
    const safeQuery = query.replaceAll(",", "");
    documentQuery = documentQuery.or(
      `title.ilike.%${safeQuery}%,document_no.ilike.%${safeQuery}%,related_party_name.ilike.%${safeQuery}%,reference_no.ilike.%${safeQuery}%`,
    );
  }

  const { data, error } = await documentQuery;
  const documents = (data ?? []) as BusinessDocument[];
  const customers = customerResult.data ?? [];
  const departmentCode = departmentResult.data?.code ?? null;
  const canUpload: Record<DocumentCategory, boolean> = {
    contract: Boolean(contractPermission.data),
    customer: Boolean(customerPermission.data),
    supplier: Boolean(supplierPermission.data),
    internal: Boolean(internalPermission.data),
  };
  const availableCategories = (
    Object.keys(categoryLabels) as DocumentCategory[]
  ).filter((item) => canUpload[item]);
  const canAdminAll = employee.roleCodes.includes("admin");
  const today = new Date();
  const expiryLimit = new Date();
  expiryLimit.setDate(today.getDate() + 30);
  const expiringCount = documents.filter((document) => {
    if (!document.expires_on || document.status !== "active") return false;
    const expiresOn = new Date(document.expires_on);
    return expiresOn >= today && expiresOn <= expiryLimit;
  }).length;
  const canArchive = (document: BusinessDocument) =>
    document.uploaded_by_employee_id === employee.id ||
    canAdminAll ||
    (document.category === "contract" && employee.roleCodes.includes("hr")) ||
    (document.category === "customer" &&
      ["DX-SALES", "DX-CS"].includes(departmentCode ?? "")) ||
    (document.category === "supplier" && departmentCode === "DX-PROC");

  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb="协同办公 / 文件中心"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <div className="absolute -right-16 -top-24 size-80 rounded-full border border-white/8" />
          <FileArchive className="pointer-events-none absolute right-10 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.13em] text-[#79d8d5]">
                DOCUMENT CENTER · SECURE ARCHIVE
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                企业文件中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                统一归档合同、客户文件、供应商资质和内部资料，以私有存储、数据范围和下载审计保护企业文件。
              </p>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-xl border border-white/12 bg-white/8 px-4 py-3 text-[11px] text-white/68 lg:self-auto">
              <FolderKey className="size-4" />
              私有存储 · 权限访问 · 审计留痕
            </div>
          </div>
        </section>

        {(params.created || params.updated || params.error) && (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-xs ${
              params.error
                ? "border-[#eed3cd] bg-[#fff4f1] text-[#985846]"
                : "border-[#cfe8ec] bg-[#edf7f2] text-[#0d6c78]"
            }`}
          >
            {params.error || params.created || params.updated}
          </div>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<FileText className="size-5" />}
            label="当前文件"
            note="当前权限和筛选范围"
            tone="bg-[#eaf3f8] text-[#0d6c78]"
            value={`${documents.length}`}
          />
          <MetricCard
            icon={<FileCheck2 className="size-5" />}
            label="合同文件"
            note="合同与协议资料"
            tone="bg-[#edf3fb] text-[#426c9b]"
            value={`${documents.filter((item) => item.category === "contract").length}`}
          />
          <MetricCard
            icon={<Building2 className="size-5" />}
            label="业务资料"
            note="客户文件与供应商资质"
            tone="bg-[#f1edfa] text-[#72529a]"
            value={`${
              documents.filter((item) =>
                ["customer", "supplier"].includes(item.category),
              ).length
            }`}
          />
          <MetricCard
            icon={<FileClock className="size-5" />}
            label="30天内到期"
            note="建议提前检查或续期"
            tone="bg-[#fff4df] text-[#96651f]"
            value={`${expiringCount}`}
          />
        </section>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
          <section className="overflow-hidden rounded-[20px] border border-border/75 bg-white">
            <div className="border-b border-border/70 px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-base font-semibold">文件档案</h2>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    只展示当前账号有权查看的文件
                  </p>
                </div>
                <form className="flex gap-2" method="get">
                  {category !== "all" && (
                    <input name="category" type="hidden" value={category} />
                  )}
                  <label className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      className="h-9 w-48 rounded-xl border border-border bg-[#fafcfe] pl-9 pr-3 text-[10px] outline-none focus:border-primary/40 sm:w-60"
                      defaultValue={query}
                      name="q"
                      placeholder="搜索标题、编号或往来单位"
                    />
                  </label>
                  <button
                    className="h-9 rounded-xl bg-primary px-3 text-[10px] text-white"
                    type="submit"
                  >
                    搜索
                  </button>
                </form>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
                {[
                  ["all", "全部"],
                  ["contract", "合同"],
                  ["customer", "客户"],
                  ["supplier", "供应商"],
                  ["internal", "内部资料"],
                ].map(([value, label]) => (
                  <Link
                    className={`rounded-full px-3 py-1.5 ${
                      category === value
                        ? "bg-primary text-white"
                        : "bg-[#f2f5f4] text-muted-foreground"
                    }`}
                    href={
                      value === "all"
                        ? "/documents"
                        : `/documents?category=${value}`
                    }
                    key={value}
                  >
                    {label}
                  </Link>
                ))}
                <Link
                  className={`ml-auto rounded-full px-3 py-1.5 ${
                    status === "archived"
                      ? "bg-[#eee9e2] text-[#756657]"
                      : "bg-[#f2f5f4] text-muted-foreground"
                  }`}
                  href="/documents?status=archived"
                >
                  已归档
                </Link>
              </div>
            </div>

            {error ? (
              <div className="px-6 py-16 text-center text-xs text-[#985846]">
                无法读取文件数据，请确认数据库迁移已经执行。
              </div>
            ) : documents.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <FileArchive className="mx-auto size-9 text-primary/50" />
                <h3 className="mt-4 text-sm font-medium">暂无可见文件</h3>
                <p className="mt-2 text-xs text-muted-foreground">
                  上传第一份文件，或调整搜索和分类条件。
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/70 px-5 sm:px-6">
                {documents.map((document) => {
                  const uploader = relatedOne(document.employees);
                  const department = relatedOne(document.departments);
                  const customer = relatedOne(document.customers);
                  return (
                    <article
                      className="grid gap-3 py-4 lg:grid-cols-[44px_minmax(0,1fr)_190px_auto] lg:items-center"
                      key={document.id}
                    >
                      <span className="grid size-11 place-items-center rounded-[14px] border border-border/70 bg-[#f6f9f7] text-primary">
                        <FileText className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-[12px] font-semibold">
                            {document.title}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] ${categoryTones[document.category]}`}
                          >
                            {categoryLabels[document.category]}
                          </span>
                          {document.status === "archived" && (
                            <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[9px] text-muted-foreground">
                              已归档
                            </span>
                          )}
                        </div>
                        <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
                          {document.document_no} · {document.original_file_name} ·{" "}
                          {displaySize(document.file_size)}
                        </p>
                        <p className="mt-1 truncate text-[10px] text-muted-foreground">
                          {customer?.name ||
                            document.related_party_name ||
                            document.reference_no ||
                            "未关联往来单位"}
                        </p>
                      </div>
                      <div className="text-[10px] leading-5 text-muted-foreground">
                        <div>
                          {visibilityLabels[document.visibility]}
                          {document.visibility === "restricted" &&
                            document.viewer_role_codes.length > 0 &&
                            ` · ${document.viewer_role_codes
                              .map((code) => roleLabels[code])
                              .filter(Boolean)
                              .join("/")}`}
                        </div>
                        <div>
                          {department?.name || "未分部门"} ·{" "}
                          {uploader?.name || "未知上传人"}
                        </div>
                        <div>
                          到期：{displayDate(document.expires_on)}
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-primary px-3 text-[10px] font-medium text-white"
                          href={`/documents/${document.id}/download`}
                        >
                          <Download className="size-3.5" />
                          下载
                        </Link>
                        {document.status === "active" &&
                          canArchive(document) && (
                            <form action={archiveBusinessDocument}>
                              <input
                                name="documentId"
                                type="hidden"
                                value={document.id}
                              />
                              <button
                                className="grid size-8 place-items-center rounded-xl border border-border text-muted-foreground hover:bg-muted"
                                title="归档文件"
                                type="submit"
                              >
                                <Archive className="size-3.5" />
                              </button>
                            </form>
                          )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold">上传并归档</h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  PDF、图片、Word、Excel，单文件最大 20MB
                </p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-primary">
                <Upload className="size-5" />
              </span>
            </div>

            <form action={uploadBusinessDocument} className="mt-5 space-y-4">
              <label className="block text-[10px] text-muted-foreground">
                文件分类
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                  name="category"
                  required
                >
                  {availableCategories.map((item) => (
                    <option key={item} value={item}>
                      {categoryLabels[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[10px] text-muted-foreground">
                文件标题
                <input
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                  maxLength={160}
                  name="title"
                  placeholder="例如：2026年度粮油采购框架协议"
                  required
                />
              </label>
              <label className="block text-[10px] text-muted-foreground">
                选择文件
                <input
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
                  className="mt-1.5 block w-full rounded-xl border border-dashed border-primary/25 bg-[#f5faf7] p-3 text-[10px] file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-[10px] file:text-white"
                  name="file"
                  required
                  type="file"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                <label className="text-[10px] text-muted-foreground">
                  可见范围
                  <select
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                    defaultValue="department"
                    name="visibility"
                  >
                    <option value="department">本部门可见</option>
                    <option value="organization">全公司可见</option>
                    <option value="restricted">指定角色可见</option>
                  </select>
                </label>
                <label className="text-[10px] text-muted-foreground">
                  文件编号 / 合同号
                  <input
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                    maxLength={100}
                    name="referenceNo"
                  />
                </label>
              </div>
              {customers.length > 0 && (
                <label className="block text-[10px] text-muted-foreground">
                  关联客户（可选）
                  <select
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                    name="customerId"
                  >
                    <option value="">不关联客户</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name} · {customer.customer_no}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-[10px] text-muted-foreground">
                客户 / 供应商 / 往来单位
                <input
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                  maxLength={160}
                  name="relatedPartyName"
                  placeholder="未关联客户档案时填写"
                />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="text-[10px] text-muted-foreground">
                  生效日期
                  <input
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                    name="effectiveOn"
                    type="date"
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  到期日期
                  <input
                    className="mt-1.5 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/40"
                    name="expiresOn"
                    type="date"
                  />
                </label>
              </div>
              <fieldset className="rounded-xl border border-border/75 bg-[#fafcfe] p-3">
                <legend className="px-1 text-[10px] text-muted-foreground">
                  指定角色（仅“指定角色可见”时生效）
                </legend>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {["department_lead", "hr", "finance", "admin", "chairman"].map(
                    (code) => (
                      <label
                        className="flex items-center gap-2 text-[10px]"
                        key={code}
                      >
                        <input
                          className="accent-primary"
                          name="viewerRoleCodes"
                          type="checkbox"
                          value={code}
                        />
                        {roleLabels[code]}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <label className="block text-[10px] text-muted-foreground">
                备注说明
                <textarea
                  className="mt-1.5 min-h-20 w-full rounded-xl border border-border bg-white p-3 text-xs outline-none focus:border-primary/40"
                  maxLength={500}
                  name="description"
                  placeholder="补充文件用途、版本或注意事项"
                />
              </label>
              <button
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary text-xs font-medium text-white"
                type="submit"
              >
                <ShieldCheck className="size-4" />
                安全上传并归档
              </button>
              <p className="flex items-start gap-2 text-[9px] leading-4 text-muted-foreground">
                <UsersRound className="mt-0.5 size-3 shrink-0" />
                上传、下载和归档都会记录操作审计；已归档文件不会立即删除。
              </p>
            </form>
          </section>
        </div>
      </main>
    </WorkflowShell>
  );
}
