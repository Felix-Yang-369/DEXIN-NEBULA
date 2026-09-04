import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Columns3,
  Download,
  FileArchive,
  FileText,
  Folder,
  FolderInput,
  FolderKey,
  HardDrive,
  History,
  Info,
  List,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  archiveBusinessDocument,
  createDocumentFolder,
  moveBusinessDocument,
  processDocumentFolderAccess,
  renameBusinessDocument,
  requestDocumentFolderAccess,
  restoreBusinessDocument,
  uploadBusinessDocument,
} from "@/features/documents/server-actions";
import { DirectDocumentUpload } from "@/features/documents/direct-document-upload";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "文件中心",
  description: "德馨星云企业文件目录、权限审批与 NAS 安全存储",
};

export const dynamic = "force-dynamic";

type DocumentCategory = "contract" | "customer" | "supplier" | "internal";
type DocumentView = "all" | "mine" | "recent" | "archived";

type DocumentFolder = {
  id: string;
  parent_id: string | null;
  code: string;
  name: string;
  description: string | null;
  access_level: number;
  sort_order: number;
  owner_name: string | null;
  is_locked: boolean;
  can_download: boolean;
  can_upload: boolean;
  can_manage: boolean;
  can_authorize: boolean;
  is_requestable: boolean;
  pending_request_id: string | null;
  file_count: number;
};

type BusinessDocument = {
  id: string;
  folder_id: string;
  document_no: string;
  category: DocumentCategory;
  title: string;
  description: string | null;
  original_file_name: string;
  file_size: number;
  related_party_name: string | null;
  reference_no: string | null;
  uploaded_by_employee_id: string;
  status: "active" | "archived";
  created_at: string;
  employees: { name: string } | { name: string }[] | null;
  customers: { name: string } | { name: string }[] | null;
};

type FolderAccessDetail = {
  folder_id: string;
  reason: string;
  related_context: string | null;
  duration_hours: number;
  requested_can_download: boolean;
  urgency: "normal" | "urgent";
  folder:
    | { name: string; access_level: number }
    | { name: string; access_level: number }[]
    | null;
};

type FolderAccessRequest = {
  id: string;
  request_no: string;
  applicant_employee_id: string;
  current_approver_employee_id: string | null;
  status: "pending" | "approved" | "rejected" | "returned" | "withdrawn";
  current_step_order: number;
  total_steps: number;
  version: number;
  created_at: string;
  applicant: { name: string } | { name: string }[] | null;
  folder_access: FolderAccessDetail | FolderAccessDetail[] | null;
};

const categoryLabels: Record<DocumentCategory, string> = {
  contract: "合同文件",
  customer: "客户文件",
  supplier: "供应商资料",
  internal: "内部资料",
};

const levelLabels: Record<number, string> = {
  1: "L1 公开",
  2: "L2 部门",
  3: "L3 高级",
  4: "L4 核心",
};

const levelTones: Record<number, string> = {
  1: "bg-muted text-foreground",
  2: "bg-muted text-foreground",
  3: "bg-muted text-foreground",
  4: "bg-muted text-foreground",
};

const statusLabels: Record<FolderAccessRequest["status"], string> = {
  pending: "审批中",
  approved: "已通过",
  rejected: "已拒绝",
  returned: "已退回",
  withdrawn: "已撤回",
};

function one<T>(input: T | T[] | null) {
  return Array.isArray(input) ? (input[0] ?? null) : input;
}

function displaySize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function displayDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    employee: "员工",
    department_lead: "部门负责人",
    hr: "人力资源",
    finance: "财务",
    admin: "系统管理员",
    chairman: "董事长",
  };
  return roleCodes
    .map((code) => labels[code])
    .filter(Boolean)
    .join(" · ");
}

function durationLabel(hours: number) {
  if (hours === 0) return "长期";
  if (hours === 24) return "24 小时";
  if (hours === 168) return "7 天";
  if (hours === 720) return "30 天";
  return "90 天";
}

function folderHref(folderId?: string | null, extras?: Record<string, string>) {
  const query = new URLSearchParams(extras);
  if (folderId) query.set("folder", folderId);
  const suffix = query.toString();
  return suffix ? `/documents?${suffix}` : "/documents";
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    folder?: string;
    q?: string;
    category?: string;
    status?: string;
    view?: string;
    created?: string;
    updated?: string;
    error?: string;
    document?: string;
  }>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const supabase = await createClient();
  const query = (params.q ?? "").trim().slice(0, 80);
  const fileView: DocumentView = ["mine", "recent", "archived"].includes(
    params.view ?? "",
  )
    ? (params.view as DocumentView)
    : "all";
  const category = ["contract", "customer", "supplier", "internal"].includes(
    params.category ?? "",
  )
    ? (params.category as DocumentCategory)
    : "all";
  const status =
    fileView === "archived" || params.status === "archived"
      ? "archived"
      : "active";

  const [folderResult, customerResult, accessRequestResult] = await Promise.all(
    [
      supabase.rpc("list_document_folder_tree"),
      supabase
        .from("customers")
        .select("id, name, customer_no")
        .neq("status", "inactive")
        .order("name")
        .limit(200),
      supabase
        .from("approval_requests")
        .select(
          "id, request_no, applicant_employee_id, current_approver_employee_id, status, current_step_order, total_steps, version, created_at, applicant:employees!approval_requests_applicant_employee_id_fkey(name), folder_access:document_folder_access_requests(folder_id, reason, related_context, duration_hours, requested_can_download, urgency, folder:document_folders(name, access_level))",
        )
        .eq("request_type", "folder_access")
        .order("created_at", { ascending: false })
        .limit(100),
    ],
  );

  const folders = (folderResult.data ?? []) as DocumentFolder[];
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  const rootFolders = folders.filter((folder) => !folder.parent_id);
  const selectedFolder = params.folder
    ? (folderMap.get(params.folder) ?? null)
    : null;
  const uploadFolders = folders.filter(
    (folder) => !folder.is_locked && folder.can_upload,
  );
  const accessRequests = (accessRequestResult.data ??
    []) as unknown as FolderAccessRequest[];
  const myRequests = accessRequests.filter(
    (request) => request.applicant_employee_id === employee.id,
  );
  const myPendingApprovals = accessRequests.filter(
    (request) =>
      request.status === "pending" &&
      request.current_approver_employee_id === employee.id,
  );

  let documents: BusinessDocument[] = [];
  let documentError = null as { code?: string } | null;
  if (!selectedFolder?.is_locked) {
    let documentQuery = supabase
      .from("business_documents")
      .select(
        "id, folder_id, document_no, category, title, description, original_file_name, file_size, related_party_name, reference_no, uploaded_by_employee_id, status, created_at, employees!business_documents_uploaded_by_employee_id_fkey(name), customers(name)",
      )
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(200);
    if (selectedFolder)
      documentQuery = documentQuery.eq("folder_id", selectedFolder.id);
    if (fileView === "mine")
      documentQuery = documentQuery.eq("uploaded_by_employee_id", employee.id);
    if (fileView === "recent") {
      const recentFrom = new Date();
      recentFrom.setDate(recentFrom.getDate() - 30);
      documentQuery = documentQuery.gte("created_at", recentFrom.toISOString());
    }
    if (category !== "all")
      documentQuery = documentQuery.eq("category", category);
    if (query) {
      const safeQuery = query.replaceAll(",", "");
      documentQuery = documentQuery.or(
        `title.ilike.%${safeQuery}%,document_no.ilike.%${safeQuery}%,related_party_name.ilike.%${safeQuery}%,reference_no.ilike.%${safeQuery}%`,
      );
    }
    const result = await documentQuery;
    documents = (result.data ?? []) as BusinessDocument[];
    documentError = result.error;
  }

  const hasAdminView = employee.roleCodes.includes("admin");
  const isChairman = employee.roleCodes.includes("chairman");
  const canDownload = (document: BusinessDocument) =>
    document.uploaded_by_employee_id === employee.id ||
    hasAdminView ||
    Boolean(folderMap.get(document.folder_id)?.can_download);
  const canArchive = (document: BusinessDocument) =>
    document.uploaded_by_employee_id === employee.id ||
    isChairman ||
    Boolean(folderMap.get(document.folder_id)?.can_manage);

  const breadcrumbs: DocumentFolder[] = [];
  let breadcrumbFolder = selectedFolder;
  while (breadcrumbFolder) {
    breadcrumbs.unshift(breadcrumbFolder);
    breadcrumbFolder = breadcrumbFolder.parent_id
      ? (folderMap.get(breadcrumbFolder.parent_id) ?? null)
      : null;
  }
  const selectedDocument = params.document
    ? (documents.find((document) => document.id === params.document) ?? null)
    : null;
  const explorerRoot = breadcrumbs[0] ?? null;
  const explorerFolderParent = selectedFolder?.parent_id
    ? (folderMap.get(selectedFolder.parent_id) ?? null)
    : selectedFolder;
  const explorerFolders = explorerFolderParent
    ? folders.filter((folder) => folder.parent_id === explorerFolderParent.id)
    : [];

  return (
    <WorkflowShell
      activeItem="文件中心"
      breadcrumb="协同办公 / 文件中心"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <FileArchive className="pointer-events-none absolute right-10 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.13em] text-muted-foreground">
                DOCUMENT CENTER · NAS PRIVATE STORAGE
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                企业网盘
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">
                像使用企业网盘一样管理公司文件：按目录浏览、快速搜索、上传下载和权限申请；文件正文安全保存在公司
                NAS。
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Link
                className="rounded-md border border-white/15 bg-white/10 px-4 py-3 text-white/80"
                href="/documents?view=my-requests"
              >
                我的申请{" "}
                {myRequests.filter((item) => item.status === "pending").length}
              </Link>
              <Link
                className="rounded-md bg-white px-4 py-3 font-medium text-foreground"
                href="/documents?view=approvals"
              >
                权限审批 {myPendingApprovals.length}
              </Link>
            </div>
          </div>
        </section>

        {(params.created || params.updated || params.error) && (
          <div
            className={`mt-5 rounded-lg border px-4 py-3 text-xs ${params.error ? "border-border bg-muted text-foreground" : "border-border bg-muted text-foreground"}`}
          >
            {params.error || params.created || params.updated}
          </div>
        )}

        {folderResult.error && (
          <div className="mt-5 rounded-lg border border-border bg-muted px-5 py-4 text-xs text-foreground">
            文件夹权限数据尚未就绪。请先执行本次 Supabase 数据库迁移。
          </div>
        )}

        <nav className="mt-5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <Link className="hover:text-primary" href="/documents">
            全部文件
          </Link>
          {breadcrumbs.map((folder) => (
            <span className="flex items-center gap-1.5" key={folder.id}>
              <ChevronRight className="size-3" />
              <Link className="hover:text-primary" href={folderHref(folder.id)}>
                {folder.name}
              </Link>
            </span>
          ))}
        </nav>

        {params.view === "approvals" ? (
          <AccessRequestList
            currentEmployeeId={employee.id}
            mode="approvals"
            requests={myPendingApprovals}
          />
        ) : params.view === "my-requests" ? (
          <AccessRequestList
            currentEmployeeId={employee.id}
            mode="mine"
            requests={myRequests}
          />
        ) : (
          <>
            {fileView === "all" ? (
              <>
                <MicrodriveExplorer
                  canArchive={canArchive}
                  canDownload={canDownload}
                  documentError={documentError}
                  documents={documents}
                  explorerFolders={explorerFolders}
                  explorerRoot={explorerRoot}
                  rootFolders={rootFolders}
                  selectedDocument={selectedDocument}
                  selectedFolder={selectedFolder}
                  uploadFolders={uploadFolders}
                />
                {selectedFolder?.is_locked ? (
                  <LockedFolder folder={selectedFolder} />
                ) : (
                  selectedFolder?.can_manage && (
                    <div className="mt-5 max-w-2xl">
                      <CreateFolderPanel folder={selectedFolder} />
                    </div>
                  )
                )}
              </>
            ) : selectedFolder?.is_locked ? (
              <LockedFolder folder={selectedFolder} />
            ) : (
              <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,.55fr)]">
                <DocumentList
                  canArchive={canArchive}
                  canDownload={canDownload}
                  category={category}
                  documentError={documentError}
                  documents={documents}
                  folders={folderMap}
                  fileView={fileView}
                  query={query}
                  selectedFolder={selectedFolder}
                  status={status}
                  uploadFolders={uploadFolders}
                />
                <aside className="space-y-5">
                  <UploadPanel
                    customers={customerResult.data ?? []}
                    selectedFolder={selectedFolder}
                    uploadFolders={uploadFolders}
                  />
                  {selectedFolder?.can_manage && (
                    <CreateFolderPanel folder={selectedFolder} />
                  )}
                </aside>
              </div>
            )}
          </>
        )}

        <DriveNavigation
          activeView={params.view ?? fileView}
          myPendingApprovals={myPendingApprovals.length}
          myPendingRequests={
            myRequests.filter((item) => item.status === "pending").length
          }
        />
      </main>
    </WorkflowShell>
  );
}

function DriveNavigation({
  activeView,
  myPendingApprovals,
  myPendingRequests,
}: {
  activeView: string;
  myPendingApprovals: number;
  myPendingRequests: number;
}) {
  const items = [
    {
      key: "all",
      label: "全部文件",
      note: "目录与文件",
      href: "/documents",
      icon: <HardDrive className="size-4" />,
    },
    {
      key: "mine",
      label: "我的文件",
      note: "由我上传",
      href: "/documents?view=mine",
      icon: <UserRound className="size-4" />,
    },
    {
      key: "recent",
      label: "最近文件",
      note: "近 30 天",
      href: "/documents?view=recent",
      icon: <History className="size-4" />,
    },
    {
      key: "archived",
      label: "回收站",
      note: "可恢复文件",
      href: "/documents?view=archived",
      icon: <Trash2 className="size-4" />,
    },
    {
      key: "my-requests",
      label: "权限申请",
      note: `${myPendingRequests} 项处理中`,
      href: "/documents?view=my-requests",
      icon: <FolderKey className="size-4" />,
    },
    {
      key: "approvals",
      label: "待我审批",
      note: `${myPendingApprovals} 项待处理`,
      href: "/documents?view=approvals",
      icon: <ShieldCheck className="size-4" />,
    },
  ];

  return (
    <section className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
      {items.map((item) => {
        const active = activeView === item.key;
        return (
          <Link
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition ${
              active
                ? "border-primary/25 bg-primary text-white "
                : "border-border/75 bg-white hover:border-primary/20 hover:bg-muted"
            }`}
            href={item.href}
            key={item.key}
          >
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-md ${
                active ? "bg-white/15" : "bg-muted text-primary"
              }`}
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium">
                {item.label}
              </span>
              <span
                className={`mt-0.5 block truncate text-xs ${
                  active ? "text-white/65" : "text-muted-foreground"
                }`}
              >
                {item.note}
              </span>
            </span>
          </Link>
        );
      })}
    </section>
  );
}

function MicrodriveExplorer({
  canArchive,
  canDownload,
  documentError,
  documents,
  explorerFolders,
  explorerRoot,
  rootFolders,
  selectedDocument,
  selectedFolder,
  uploadFolders,
}: {
  canArchive: (document: BusinessDocument) => boolean;
  canDownload: (document: BusinessDocument) => boolean;
  documentError: { code?: string } | null;
  documents: BusinessDocument[];
  explorerFolders: DocumentFolder[];
  explorerRoot: DocumentFolder | null;
  rootFolders: DocumentFolder[];
  selectedDocument: BusinessDocument | null;
  selectedFolder: DocumentFolder | null;
  uploadFolders: DocumentFolder[];
}) {
  const selectedUploader = selectedDocument
    ? one(selectedDocument.employees)
    : null;
  const selectedCustomer = selectedDocument
    ? one(selectedDocument.customers)
    : null;

  return (
    <section className="mt-4 overflow-hidden rounded-md border border-border/75 bg-white ">
      <div className="flex min-h-16 flex-wrap items-center gap-3 border-b border-border/70 bg-muted px-4 py-3 sm:px-5">
        <Link
          aria-label="返回全部共享空间"
          className="grid size-9 place-items-center rounded-md border border-border bg-white text-muted-foreground hover:text-primary"
          href="/documents"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
          <Link
            className="text-muted-foreground hover:text-primary"
            href="/documents"
          >
            共享空间
          </Link>
          {explorerRoot && (
            <>
              <ChevronRight className="size-3 text-muted-foreground" />
              <Link
                className="truncate text-muted-foreground hover:text-primary"
                href={folderHref(explorerRoot.id)}
              >
                {explorerRoot.name}
              </Link>
            </>
          )}
          {selectedFolder?.parent_id && (
            <>
              <ChevronRight className="size-3 text-muted-foreground" />
              <span className="truncate font-medium">
                {selectedFolder.name}
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <DirectDocumentUpload
            folderId={selectedFolder?.can_upload ? selectedFolder.id : null}
          />
          <a
            className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-4 text-xs ${selectedFolder?.can_manage ? "border-border bg-white text-foreground" : "pointer-events-none border-border/60 bg-muted text-muted-foreground"}`}
            href="#drive-new"
          >
            <Plus className="size-3.5" />
            新建文件夹
          </a>
          <span className="hidden items-center rounded-md bg-muted p-1 text-muted-foreground sm:flex">
            <span className="grid size-8 place-items-center rounded-lg">
              <List className="size-4" />
            </span>
            <span className="grid size-8 place-items-center rounded-lg bg-white text-primary ">
              <Columns3 className="size-4" />
            </span>
            <span className="grid size-8 place-items-center rounded-lg">
              <Info className="size-4" />
            </span>
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-h-[560px] min-w-[1080px] grid-cols-[230px_270px_410px_minmax(280px,1fr)] divide-x divide-border/70">
          <aside className="bg-muted px-3 py-4">
            <div className="px-3 text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
              共享空间
            </div>
            <div className="mt-3 space-y-1">
              {rootFolders.map((folder) => {
                const active = explorerRoot?.id === folder.id;
                return (
                  <Link
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2.5 text-xs transition ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-white hover:text-foreground"}`}
                    href={folderHref(folder.id)}
                    key={folder.id}
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white text-primary ">
                      {folder.is_locked ? (
                        <Lock className="size-3.5 text-foreground" />
                      ) : (
                        <HardDrive className="size-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {folder.name}
                    </span>
                    {folder.is_locked && <FolderKey className="size-3" />}
                  </Link>
                );
              })}
            </div>
          </aside>

          <div className="px-3 py-4">
            <div className="flex items-center justify-between px-3">
              <h2 className="truncate text-xs font-semibold">
                {explorerRoot?.name || "请选择共享空间"}
              </h2>
              {explorerRoot && (
                <span
                  className={`rounded-full px-2 py-1 text-xs ${levelTones[explorerRoot.access_level]}`}
                >
                  {levelLabels[explorerRoot.access_level]}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1">
              {!explorerRoot ? (
                <p className="px-3 py-10 text-center text-xs leading-5 text-muted-foreground">
                  从左侧选择公司共享空间
                </p>
              ) : explorerFolders.length === 0 ? (
                <p className="px-3 py-10 text-center text-xs leading-5 text-muted-foreground">
                  当前空间暂无下级文件夹
                </p>
              ) : (
                explorerFolders.map((folder) => {
                  const active = selectedFolder?.id === folder.id;
                  return (
                    <Link
                      className={`flex items-center gap-2 rounded-md px-3 py-2.5 text-xs transition ${active ? "bg-muted font-medium" : "hover:bg-muted"}`}
                      href={folderHref(folder.id)}
                      key={folder.id}
                    >
                      <span
                        className={`grid size-7 place-items-center rounded-lg ${folder.is_locked ? "bg-muted text-foreground" : "bg-muted text-foreground"}`}
                      >
                        {folder.is_locked ? (
                          <Lock className="size-3.5" />
                        ) : (
                          <Folder className="size-3.5" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {folder.name}
                      </span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <div className="py-4">
            <div className="flex items-center justify-between px-4">
              <div>
                <h2 className="text-xs font-semibold">
                  {selectedFolder?.name || "文件列表"}
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  {selectedFolder
                    ? `${documents.length} 个文件`
                    : "选择目录后查看文件"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              {documentError ? (
                <p className="px-5 py-12 text-center text-xs text-foreground">
                  文件读取失败，请稍后重试
                </p>
              ) : selectedFolder?.is_locked ? (
                <p className="px-5 py-12 text-center text-xs leading-5 text-foreground">
                  当前目录需要申请权限后查看
                </p>
              ) : !selectedFolder ? (
                <p className="px-5 py-12 text-center text-xs text-muted-foreground">
                  请先选择左侧共享空间
                </p>
              ) : documents.length === 0 ? (
                <p className="px-5 py-12 text-center text-xs text-muted-foreground">
                  这个文件夹还没有文件
                </p>
              ) : (
                documents.map((document) => {
                  const active = selectedDocument?.id === document.id;
                  return (
                    <Link
                      className={`flex items-center gap-3 border-y border-transparent px-4 py-3 transition ${active ? "border-border/60 bg-muted" : "hover:bg-muted"}`}
                      href={folderHref(selectedFolder.id, {
                        document: document.id,
                      })}
                      key={document.id}
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-md border border-border/70 bg-white text-primary">
                        <FileText className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium">
                          {document.title}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {document.original_file_name} ·{" "}
                          {displaySize(document.file_size)}
                        </span>
                      </span>
                      <ChevronRight className="size-3 text-muted-foreground" />
                    </Link>
                  );
                })
              )}
            </div>
          </div>

          <aside className="p-5">
            {selectedDocument ? (
              <div>
                <span className="mx-auto grid size-16 place-items-center rounded-lg border border-border/70 bg-muted text-primary">
                  <FileText className="size-7" />
                </span>
                <h2 className="mt-4 break-words text-center text-sm font-semibold">
                  {selectedDocument.title}
                </h2>
                <p className="mt-1 break-all text-center text-xs text-muted-foreground">
                  {selectedDocument.original_file_name}
                </p>
                <dl className="mt-6 space-y-3 border-t border-border/70 pt-5 text-xs">
                  <DriveDetail
                    label="文件编号"
                    value={selectedDocument.document_no}
                  />
                  <DriveDetail
                    label="文件大小"
                    value={displaySize(selectedDocument.file_size)}
                  />
                  <DriveDetail
                    label="上传人"
                    value={selectedUploader?.name || "未知上传人"}
                  />
                  <DriveDetail
                    label="上传时间"
                    value={displayDate(selectedDocument.created_at)}
                  />
                  <DriveDetail
                    label="文件类型"
                    value={categoryLabels[selectedDocument.category]}
                  />
                  <DriveDetail
                    label="关联对象"
                    value={
                      selectedCustomer?.name ||
                      selectedDocument.related_party_name ||
                      "未关联"
                    }
                  />
                </dl>
                <div className="mt-6 grid gap-2">
                  {canDownload(selectedDocument) && (
                    <Link
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary text-xs text-white"
                      href={`/documents/${selectedDocument.id}/download`}
                    >
                      <Download className="size-3.5" />
                      下载文件
                    </Link>
                  )}
                  {canArchive(selectedDocument) &&
                    selectedDocument.status === "active" && (
                      <details className="rounded-md border border-border bg-white">
                        <summary className="flex h-9 cursor-pointer list-none items-center justify-center gap-2 text-xs text-muted-foreground [&::-webkit-details-marker]:hidden">
                          <MoreHorizontal className="size-3.5" />
                          更多操作
                        </summary>
                        <div className="space-y-3 border-t border-border/70 p-3">
                          <form
                            action={renameBusinessDocument}
                            className="flex gap-2"
                          >
                            <input
                              name="documentId"
                              type="hidden"
                              value={selectedDocument.id}
                            />
                            <input
                              className="h-9 min-w-0 flex-1 rounded-md border border-border px-3 text-xs"
                              defaultValue={selectedDocument.title}
                              maxLength={160}
                              minLength={2}
                              name="title"
                              required
                            />
                            <button
                              className="grid size-9 place-items-center rounded-md border border-primary/25 text-primary"
                              title="保存名称"
                              type="submit"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                          </form>
                          <form
                            action={moveBusinessDocument}
                            className="flex gap-2"
                          >
                            <input
                              name="documentId"
                              type="hidden"
                              value={selectedDocument.id}
                            />
                            <select
                              className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-xs"
                              defaultValue={selectedDocument.folder_id}
                              name="targetFolderId"
                            >
                              {uploadFolders.map((folder) => (
                                <option key={folder.id} value={folder.id}>
                                  {folder.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="grid size-9 place-items-center rounded-md border border-primary/25 text-primary"
                              title="移动文件"
                              type="submit"
                            >
                              <FolderInput className="size-3.5" />
                            </button>
                          </form>
                          <form action={archiveBusinessDocument}>
                            <input
                              name="documentId"
                              type="hidden"
                              value={selectedDocument.id}
                            />
                            <button
                              className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-xs text-foreground"
                              type="submit"
                            >
                              <Trash2 className="size-3.5" />
                              移入回收站
                            </button>
                          </form>
                        </div>
                      </details>
                    )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[460px] flex-col items-center justify-center text-center">
                <span className="grid size-12 place-items-center rounded-lg bg-muted text-muted-foreground">
                  <Info className="size-5" />
                </span>
                <h2 className="mt-4 text-xs font-medium">文件详情</h2>
                <p className="mt-2 max-w-52 text-xs leading-5 text-muted-foreground">
                  在左侧文件列表中选择一个文件，即可查看详细信息和可用操作。
                </p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}

function DriveDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="break-words text-right text-foreground">{value}</dd>
    </div>
  );
}

function LockedFolder({ folder }: { folder: DocumentFolder }) {
  return (
    <section className="mx-auto mt-6 max-w-2xl rounded-md border border-border bg-white p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-muted text-foreground">
          <FolderKey className="size-6" />
        </span>
        <div>
          <h2 className="text-lg font-semibold">{folder.name}需要授权</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            当前账号没有此目录的查看权限。提交申请后会按目录等级进入审批，审批通过后默认开放
            24 小时。
          </p>
        </div>
      </div>
      {folder.pending_request_id ? (
        <div className="mt-6 rounded-lg bg-muted px-5 py-4 text-xs text-foreground">
          <Clock3 className="mr-2 inline size-4" />
          该目录已有审批中的申请，无需重复提交。
        </div>
      ) : folder.is_requestable ? (
        <form action={requestDocumentFolderAccess} className="mt-6 space-y-4">
          <input name="folderId" type="hidden" value={folder.id} />
          <label className="block text-xs text-muted-foreground">
            申请原因
            <textarea
              className="mt-1.5 min-h-24 w-full rounded-md border border-border p-3 text-xs outline-none focus:border-primary/40"
              maxLength={1000}
              minLength={10}
              name="reason"
              placeholder="请说明需要查看的具体工作原因（至少 10 个字）"
              required
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            关联客户 / 项目 / 事项（可选）
            <input
              className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs outline-none focus:border-primary/40"
              maxLength={500}
              name="relatedContext"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">
              申请时长
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs"
                defaultValue="24"
                name="durationHours"
              >
                <option value="24">24 小时（默认）</option>
                <option value="168">7 天</option>
                <option value="720">30 天</option>
                <option value="2160">90 天</option>
                <option value="0">长期权限</option>
              </select>
            </label>
            <label className="text-xs text-muted-foreground">
              紧急程度
              <select
                className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs"
                defaultValue="normal"
                name="urgency"
              >
                <option value="normal">普通</option>
                <option value="urgent">紧急</option>
              </select>
            </label>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              className="accent-primary"
              defaultChecked
              name="requestedCanDownload"
              type="checkbox"
            />
            同时申请下载权限
          </label>
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-white"
            type="submit"
          >
            <ShieldCheck className="size-4" />
            提交查看权限申请
          </button>
        </form>
      ) : (
        <div className="mt-6 rounded-lg bg-muted px-5 py-4 text-xs text-muted-foreground">
          此目录不开放自助申请，请联系系统管理员。
        </div>
      )}
    </section>
  );
}

function DocumentList({
  canArchive,
  canDownload,
  category,
  documentError,
  documents,
  fileView,
  folders,
  query,
  selectedFolder,
  status,
  uploadFolders,
}: {
  canArchive: (document: BusinessDocument) => boolean;
  canDownload: (document: BusinessDocument) => boolean;
  category: DocumentCategory | "all";
  documentError: { code?: string } | null;
  documents: BusinessDocument[];
  fileView: DocumentView;
  folders: Map<string, DocumentFolder>;
  query: string;
  selectedFolder: DocumentFolder | null;
  status: "active" | "archived";
  uploadFolders: DocumentFolder[];
}) {
  return (
    <section className="overflow-hidden rounded-md border border-border/75 bg-white">
      <div className="border-b border-border/70 px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-base font-semibold">
              {selectedFolder?.name ||
                {
                  all: "有权查看的全部文件",
                  mine: "我的文件",
                  recent: "最近 30 天的文件",
                  archived: "回收站",
                }[fileView]}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {documents.length} 个文件 · 目录权限实时生效
            </p>
          </div>
          <form className="flex gap-2" method="get">
            {fileView !== "all" && (
              <input name="view" type="hidden" value={fileView} />
            )}
            {selectedFolder && (
              <input name="folder" type="hidden" value={selectedFolder.id} />
            )}
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-9 w-52 rounded-md border border-border bg-muted pl-9 pr-3 text-xs outline-none"
                defaultValue={query}
                name="q"
                placeholder="搜索标题、编号或往来单位"
              />
            </label>
            <button
              className="h-9 rounded-md bg-primary px-3 text-xs text-white"
              type="submit"
            >
              搜索
            </button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          {(
            [
              ["all", "全部"],
              ["contract", "合同"],
              ["customer", "客户"],
              ["supplier", "供应商"],
              ["internal", "内部资料"],
            ] as const
          ).map(([value, label]) => (
            <Link
              className={`rounded-md px-3 py-1.5 ${category === value ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
              href={folderHref(selectedFolder?.id, {
                ...(fileView === "all" ? {} : { view: fileView }),
                ...(value === "all" ? {} : { category: value }),
              })}
              key={value}
            >
              {label}
            </Link>
          ))}
          <Link
            className={`ml-auto rounded-md px-3 py-1.5 ${status === "archived" ? "bg-muted text-foreground" : "bg-muted text-muted-foreground"}`}
            href={
              status === "archived"
                ? folderHref(selectedFolder?.id)
                : folderHref(selectedFolder?.id, { view: "archived" })
            }
          >
            {status === "archived" ? "返回全部文件" : "打开回收站"}
          </Link>
        </div>
      </div>
      {documentError ? (
        <div className="px-6 py-16 text-center text-xs text-foreground">
          无法读取文件数据，请稍后重试。
        </div>
      ) : documents.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <FileArchive className="mx-auto size-9 text-primary/45" />
          <h3 className="mt-4 text-sm font-medium">这里还没有文件</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            具有上传权限的员工可以从右侧直接上传到 NAS。
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border/70 px-5 sm:px-6">
          {documents.map((document) => {
            const uploader = one(document.employees);
            const customer = one(document.customers);
            const folder = folders.get(document.folder_id);
            return (
              <article
                className="grid gap-3 py-4 lg:grid-cols-[44px_minmax(0,1fr)_180px_auto] lg:items-center"
                key={document.id}
              >
                <span className="grid size-11 place-items-center rounded-md border border-border/70 bg-muted text-primary">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-[12px] font-semibold">
                      {document.title}
                    </h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                      {categoryLabels[document.category]}
                    </span>
                  </div>
                  <p className="mt-1.5 truncate text-xs text-muted-foreground">
                    {document.document_no} · {document.original_file_name} ·{" "}
                    {displaySize(document.file_size)}
                  </p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {customer?.name ||
                      document.related_party_name ||
                      document.reference_no ||
                      "未关联往来单位"}
                  </p>
                </div>
                <div className="text-xs leading-5 text-muted-foreground">
                  <div>{folder?.name || "文件目录"}</div>
                  <div>
                    {uploader?.name || "未知上传人"} ·{" "}
                    {displayDate(document.created_at)}
                  </div>
                </div>
                <div className="flex items-start justify-end gap-2 lg:min-w-72">
                  {canDownload(document) && (
                    <Link
                      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs text-white"
                      href={`/documents/${document.id}/download`}
                    >
                      <Download className="size-3.5" />
                      下载
                    </Link>
                  )}
                  {canArchive(document) && (
                    <details className="group max-w-72 rounded-md border border-border bg-white">
                      <summary className="grid size-8 cursor-pointer list-none place-items-center text-muted-foreground [&::-webkit-details-marker]:hidden">
                        <MoreHorizontal className="size-4" />
                      </summary>
                      <div className="w-72 space-y-3 border-t border-border/70 p-3 text-left">
                        {document.status === "archived" ? (
                          <form action={restoreBusinessDocument}>
                            <input
                              name="documentId"
                              type="hidden"
                              value={document.id}
                            />
                            <button
                              className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs text-white"
                              type="submit"
                            >
                              <RotateCcw className="size-3.5" />
                              恢复到原目录
                            </button>
                          </form>
                        ) : (
                          <>
                            <form
                              action={renameBusinessDocument}
                              className="space-y-2"
                            >
                              <input
                                name="documentId"
                                type="hidden"
                                value={document.id}
                              />
                              <label className="text-xs text-muted-foreground">
                                重命名
                                <span className="mt-1 flex gap-2">
                                  <input
                                    className="h-9 min-w-0 flex-1 rounded-md border border-border px-3 text-xs"
                                    defaultValue={document.title}
                                    maxLength={160}
                                    minLength={2}
                                    name="title"
                                    required
                                  />
                                  <button
                                    className="grid size-9 place-items-center rounded-md border border-primary/25 text-primary"
                                    title="保存名称"
                                    type="submit"
                                  >
                                    <Pencil className="size-3.5" />
                                  </button>
                                </span>
                              </label>
                            </form>
                            <form
                              action={moveBusinessDocument}
                              className="space-y-2"
                            >
                              <input
                                name="documentId"
                                type="hidden"
                                value={document.id}
                              />
                              <label className="text-xs text-muted-foreground">
                                移动到
                                <span className="mt-1 flex gap-2">
                                  <select
                                    className="h-9 min-w-0 flex-1 rounded-md border border-border bg-white px-2 text-xs"
                                    defaultValue={document.folder_id}
                                    name="targetFolderId"
                                  >
                                    {uploadFolders.map((target) => (
                                      <option key={target.id} value={target.id}>
                                        {target.name}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    className="grid size-9 place-items-center rounded-md border border-primary/25 text-primary"
                                    title="移动文件"
                                    type="submit"
                                  >
                                    <FolderInput className="size-3.5" />
                                  </button>
                                </span>
                              </label>
                            </form>
                            <form action={archiveBusinessDocument}>
                              <input
                                name="documentId"
                                type="hidden"
                                value={document.id}
                              />
                              <button
                                className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border text-xs text-foreground"
                                type="submit"
                              >
                                <Trash2 className="size-3.5" />
                                移入回收站
                              </button>
                            </form>
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function UploadPanel({
  customers,
  selectedFolder,
  uploadFolders,
}: {
  customers: { id: string; name: string; customer_no: string }[];
  selectedFolder: DocumentFolder | null;
  uploadFolders: DocumentFolder[];
}) {
  if (uploadFolders.length === 0)
    return (
      <section
        id="drive-upload"
        className="scroll-mt-6 rounded-md border border-border/75 bg-white p-6 text-xs text-muted-foreground"
      >
        当前账号暂无可上传目录。可以进入锁定目录提交权限申请。
      </section>
    );
  const defaultFolder = selectedFolder?.can_upload
    ? selectedFolder.id
    : uploadFolders[0].id;
  return (
    <section
      id="drive-upload"
      className="scroll-mt-6 rounded-md border border-border/75 bg-white p-5 sm:p-6"
    >
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">上传到 NAS</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            无需打开绿联软件，单文件最大 20MB
          </p>
        </div>
        <span className="grid size-10 place-items-center rounded-md bg-muted text-primary">
          <Upload className="size-5" />
        </span>
      </div>
      <form action={uploadBusinessDocument} className="mt-5 space-y-4">
        <label className="block text-xs text-muted-foreground">
          目标文件夹
          <select
            className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs"
            defaultValue={defaultFolder}
            name="folderId"
            required
          >
            {uploadFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name} · {levelLabels[folder.access_level]}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-muted-foreground">
            文件分类
            <select
              className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs"
              defaultValue="internal"
              name="category"
            >
              <option value="internal">内部资料</option>
              <option value="contract">合同文件</option>
              <option value="customer">客户文件</option>
              <option value="supplier">供应商资料</option>
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            文件编号
            <input
              className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs"
              maxLength={100}
              name="referenceNo"
            />
          </label>
        </div>
        <label className="block text-xs text-muted-foreground">
          文件标题
          <input
            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs"
            maxLength={160}
            minLength={2}
            name="title"
            required
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          选择文件
          <input
            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
            className="mt-1.5 block w-full rounded-md border border-dashed border-primary/25 bg-muted p-3 text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-2 file:text-xs file:text-white"
            id="business-document-file"
            name="file"
            required
            type="file"
          />
        </label>
        {customers.length > 0 && (
          <label className="block text-xs text-muted-foreground">
            关联客户（可选）
            <select
              className="mt-1.5 h-10 w-full rounded-md border border-border bg-white px-3 text-xs"
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
        <label className="block text-xs text-muted-foreground">
          往来单位（可选）
          <input
            className="mt-1.5 h-10 w-full rounded-md border border-border px-3 text-xs"
            maxLength={160}
            name="relatedPartyName"
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          备注说明
          <textarea
            className="mt-1.5 min-h-20 w-full rounded-md border border-border p-3 text-xs"
            maxLength={500}
            name="description"
          />
        </label>
        <input name="visibility" type="hidden" value="department" />
        <button
          className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-white"
          type="submit"
        >
          <ShieldCheck className="size-4" />
          安全上传并归档
        </button>
      </form>
    </section>
  );
}

function CreateFolderPanel({ folder }: { folder: DocumentFolder }) {
  return (
    <section
      id="drive-new"
      className="scroll-mt-6 rounded-md border border-border/75 bg-white p-5 sm:p-6"
    >
      <div className="flex items-center gap-2">
        <Plus className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">新建子文件夹</h2>
      </div>
      <form action={createDocumentFolder} className="mt-4 space-y-3">
        <input name="parentId" type="hidden" value={folder.id} />
        <input
          className="h-10 w-full rounded-md border border-border px-3 text-xs"
          maxLength={80}
          minLength={2}
          name="name"
          placeholder="文件夹名称"
          required
        />
        <textarea
          className="min-h-16 w-full rounded-md border border-border p-3 text-xs"
          maxLength={500}
          name="description"
          placeholder="用途说明（可选）"
        />
        <select
          className="h-10 w-full rounded-md border border-border bg-white px-3 text-xs"
          defaultValue={folder.access_level}
          name="accessLevel"
        >
          {[1, 2, 3, 4]
            .filter((level) => level >= folder.access_level)
            .map((level) => (
              <option key={level} value={level}>
                {levelLabels[level]}
              </option>
            ))}
        </select>
        <button
          className="h-10 w-full rounded-md border border-primary/30 text-xs font-medium text-primary"
          type="submit"
        >
          创建文件夹
        </button>
      </form>
    </section>
  );
}

function AccessRequestList({
  currentEmployeeId,
  mode,
  requests,
}: {
  currentEmployeeId: string;
  mode: "mine" | "approvals";
  requests: FolderAccessRequest[];
}) {
  return (
    <section className="mt-5 overflow-hidden rounded-md border border-border/75 bg-white">
      <div className="border-b border-border/70 px-6 py-5">
        <h2 className="text-base font-semibold">
          {mode === "approvals" ? "待我审批的文件权限" : "我的文件权限申请"}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          审批通过后系统自动开放权限；到期后自动失效。
        </p>
      </div>
      {requests.length === 0 ? (
        <div className="px-6 py-16 text-center text-xs text-muted-foreground">
          暂无相关申请
        </div>
      ) : (
        <div className="divide-y divide-border/70 px-6">
          {requests.map((request) => {
            const access = one(request.folder_access);
            const folder = access ? one(access.folder) : null;
            const isApplicant =
              request.applicant_employee_id === currentEmployeeId;
            return (
              <article className="py-5" key={request.id}>
                <div className="flex flex-col justify-between gap-4 lg:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">
                        {folder?.name || "文件夹权限"}
                      </h3>
                      {folder && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${levelTones[folder.access_level]}`}
                        >
                          {levelLabels[folder.access_level]}
                        </span>
                      )}
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {statusLabels[request.status]}
                      </span>
                      {access?.urgency === "urgent" && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                          紧急
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {request.request_no} · 申请人{" "}
                      {one(request.applicant)?.name || "未知"} ·{" "}
                      {displayDate(request.created_at)}
                    </p>
                    <p className="mt-2 text-xs">{access?.reason}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      权限：查看
                      {access?.requested_can_download ? " + 下载" : ""} · 时长：
                      {durationLabel(access?.duration_hours ?? 24)} · 审批进度{" "}
                      {request.current_step_order}/{request.total_steps}
                    </p>
                  </div>
                  {mode === "approvals" && request.status === "pending" ? (
                    <form
                      action={processDocumentFolderAccess}
                      className="flex min-w-72 flex-col gap-2"
                    >
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <input
                        name="expectedVersion"
                        type="hidden"
                        value={request.version}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="h-9 rounded-md border border-border bg-white px-3 text-xs"
                          defaultValue={access?.duration_hours ?? 24}
                          name="durationHours"
                          title="批准时长（只能缩短）"
                        >
                          {[
                            [24, "24 小时"],
                            [168, "7 天"],
                            [720, "30 天"],
                            [2160, "90 天"],
                            [0, "长期"],
                          ]
                            .filter(
                              ([hours]) =>
                                access?.duration_hours === 0 ||
                                Number(hours) <= (access?.duration_hours ?? 24),
                            )
                            .map(([hours, label]) => (
                              <option key={hours} value={hours}>
                                {label}
                              </option>
                            ))}
                        </select>
                        <label className="flex h-9 items-center gap-2 rounded-md border border-border px-3 text-xs">
                          <input
                            className="accent-primary"
                            defaultChecked={access?.requested_can_download}
                            disabled={!access?.requested_can_download}
                            name="canDownload"
                            type="checkbox"
                          />
                          允许下载
                        </label>
                      </div>
                      <input
                        className="h-9 rounded-md border border-border px-3 text-xs"
                        name="opinion"
                        placeholder="审批意见（拒绝时必填）"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          className="flex h-9 items-center justify-center gap-1 rounded-md bg-primary text-xs text-white"
                          name="action"
                          type="submit"
                          value="approve"
                        >
                          <Check className="size-3.5" />
                          同意
                        </button>
                        <button
                          className="flex h-9 items-center justify-center gap-1 rounded-md border border-border text-xs text-foreground"
                          name="action"
                          type="submit"
                          value="reject"
                        >
                          <X className="size-3.5" />
                          拒绝
                        </button>
                      </div>
                    </form>
                  ) : isApplicant &&
                    request.status === "pending" &&
                    request.current_step_order === 1 ? (
                    <form action={processDocumentFolderAccess}>
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <input
                        name="expectedVersion"
                        type="hidden"
                        value={request.version}
                      />
                      <input name="opinion" type="hidden" value="申请人撤回" />
                      <button
                        className="h-9 rounded-md border border-border px-4 text-xs text-muted-foreground"
                        name="action"
                        type="submit"
                        value="withdraw"
                      >
                        撤回申请
                      </button>
                    </form>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
