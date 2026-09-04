import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenText,
  Building2,
  ChevronRight,
  ClipboardCheck,
  FileArchive,
  Handshake,
  Landmark,
  Megaphone,
  PackageSearch,
  Search,
  ShoppingCart,
  Truck,
  UsersRound,
} from "lucide-react";
import { navigationGroupsForRoles } from "@/config/platform-navigation";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  classifySearchDomains,
  normalizeSearchQuery,
  postgrestContainsFilter,
  rankSearchResults,
} from "@/lib/search/global-search";
import {
  createServerTimer,
  logServerEvent,
} from "@/lib/observability/server-log";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "全局搜索",
  description: "在权限范围内搜索德馨星云功能、人员、主数据、业务单据和企业知识",
};

export const dynamic = "force-dynamic";

type SearchResult = {
  id: string;
  title: string;
  description: string;
  meta: string;
  href: string;
};

function relatedName(value: unknown) {
  const item = Array.isArray(value) ? value[0] : value;
  if (!item || typeof item !== "object" || !("name" in item)) return "";
  return String(item.name ?? "");
}

function relatedProductNames(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) =>
      item && typeof item === "object" && "product_name" in item
        ? String(item.product_name ?? "")
        : "",
    )
    .filter(Boolean);
}

function SearchGroup({
  title,
  count,
  icon: Icon,
  results,
}: {
  title: string;
  count: number;
  icon: typeof UsersRound;
  results: SearchResult[];
}) {
  if (results.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-md border border-border/80 bg-white">
      <div className="flex items-center justify-between border-b border-border/75 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-md bg-muted text-primary">
            <Icon className="size-4" />
          </span>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        <span className="text-xs text-muted-foreground">{count} 条结果</span>
      </div>
      <div className="divide-y divide-border/75">
        {results.map((result) => (
          <Link
            className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted sm:px-6"
            href={result.href}
            key={result.id}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-semibold text-foreground">
                  {result.title}
                </h3>
                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                  {result.meta}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {result.description}
              </p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground/35 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const query = normalizeSearchQuery(params.q ?? "");
  const supabase = await createClient();
  const searchDurationMs = createServerTimer();
  let searchedDomainCount = 0;

  let functionResults: SearchResult[] = [];
  let employeeResults: SearchResult[] = [];
  let knowledgeResults: SearchResult[] = [];
  let productResults: SearchResult[] = [];
  let customerResults: SearchResult[] = [];
  let supplierResults: SearchResult[] = [];
  let salesOrderResults: SearchResult[] = [];
  let purchaseOrderResults: SearchResult[] = [];
  let approvalResults: SearchResult[] = [];
  let financeResults: SearchResult[] = [];
  let announcementResults: SearchResult[] = [];
  let documentResults: SearchResult[] = [];
  let unavailableCount = 0;

  if (query) {
    const domains = classifySearchDomains(query);
    searchedDomainCount = Object.entries(domains).filter(
      ([key, enabled]) => key !== "hasExplicitDomain" && enabled,
    ).length;
    const skipped = Promise.resolve({ data: [], error: null });
    const navigationCandidates = navigationGroupsForRoles(
      employee.roleCodes,
      employee.accessPermissionCodes,
    )
      .flatMap((group) =>
        group.items.flatMap((item) => [
          {
            id: `${item.href}:${item.label}`,
            label: item.label,
            href: item.href,
            group: group.label,
            english: group.english,
          },
          ...(item.children ?? []).map((child) => ({
            id: `${child.href}:${child.label}`,
            label: child.label,
            href: child.href,
            group: group.label,
            english: group.english,
          })),
        ]),
      )
      .filter(
        (item, index, items) =>
          items.findIndex(
            (candidate) =>
              candidate.href === item.href && candidate.label === item.label,
          ) === index,
      );
    functionResults = rankSearchResults(
      navigationCandidates,
      query,
      (item) => [item.label, item.group, item.english],
      () => [],
      6,
    ).map((item) => ({
      id: item.id,
      title: item.label,
      description: `打开${item.group}中的“${item.label}”`,
      meta: "功能",
      href: item.href,
    }));

    const employeesFilter = postgrestContainsFilter(
      ["employee_no", "name", "english_name", "title", "email"],
      query,
    );
    const knowledgeFilter = postgrestContainsFilter(
      ["title", "title_en", "summary", "content"],
      query,
    );
    const productsFilter = postgrestContainsFilter(
      ["code", "barcode", "short_name", "name", "brand", "specification"],
      query,
    );
    const customersFilter = postgrestContainsFilter(
      ["customer_no", "name", "customer_type", "region", "note"],
      query,
    );
    const suppliersFilter = postgrestContainsFilter(
      ["supplier_no", "name", "short_name", "unified_credit_code", "category"],
      query,
    );
    const salesOrdersFilter = postgrestContainsFilter(
      ["order_no", "note"],
      query,
    );
    const purchaseOrdersFilter = postgrestContainsFilter(
      ["order_no", "note"],
      query,
    );
    const approvalsFilter = postgrestContainsFilter(
      ["request_no", "title", "summary"],
      query,
    );
    const financeFilter = postgrestContainsFilter(
      ["document_no", "counterparty_name", "source_no", "invoice_no", "summary"],
      query,
    );
    const announcementsFilter = postgrestContainsFilter(
      ["title", "summary", "content"],
      query,
    );
    const documentsFilter = postgrestContainsFilter(
      [
        "document_no",
        "title",
        "description",
        "original_file_name",
        "related_party_name",
        "reference_no",
      ],
      query,
    );
    const noMatch = "id.is.null";

    const [
      employees,
      knowledge,
      products,
      customers,
      suppliers,
      salesOrders,
      purchaseOrders,
      approvals,
      financeDocuments,
      announcements,
      documents,
    ] = await Promise.all([
        domains.employee
          ? supabase
          .from("employees")
          .select("id, employee_no, name, english_name, title, email")
          .eq("status", "active")
          .or(employeesFilter ?? noMatch)
          .order("employee_no")
          .limit(12)
          : skipped,
        domains.knowledge
          ? supabase
          .from("knowledge_documents")
          .select("id, slug, title, title_en, summary, content, keywords")
          .eq("status", "published")
          .or(knowledgeFilter ?? noMatch)
          .order("published_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.product
          ? supabase
          .from("products")
          .select(
            "id, code, short_name, name, brand, specification, keywords, category",
          )
          .eq("status", "active")
          .or(productsFilter ?? noMatch)
          .order("code")
          .limit(12)
          : skipped,
        domains.customer
          ? supabase
          .from("customers")
          .select("id, customer_no, name, customer_type, region, tags, note")
          .neq("status", "inactive")
          .or(customersFilter ?? noMatch)
          .order("updated_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.supplier
          ? supabase
          .from("suppliers")
          .select(
            "id, supplier_no, name, short_name, category, cooperation_status, unified_credit_code",
          )
          .neq("cooperation_status", "inactive")
          .or(suppliersFilter ?? noMatch)
          .order("updated_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.salesOrder
          ? supabase
          .from("sales_orders")
          .select(
            "id, order_no, status, order_date, total_cny, note, customers(name), sales_order_items(product_name)",
          )
          .or(salesOrdersFilter ?? noMatch)
          .order("created_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.purchaseOrder
          ? supabase
          .from("purchase_orders")
          .select(
            "id, order_no, status, order_date, total_amount, note, suppliers(name), purchase_order_items(product_name)",
          )
          .or(purchaseOrdersFilter ?? noMatch)
          .order("created_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.approval
          ? supabase
          .from("approval_requests")
          .select("id, request_no, request_type, title, summary, status")
          .or(approvalsFilter ?? noMatch)
          .order("updated_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.finance
          ? supabase
          .from("finance_documents")
          .select(
            "id, document_no, document_type, counterparty_name, source_no, invoice_no, summary, status",
          )
          .neq("status", "void")
          .or(financeFilter ?? noMatch)
          .order("updated_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.announcement
          ? supabase
          .from("announcements")
          .select("id, title, summary, content, category_code")
          .eq("status", "published")
          .or(announcementsFilter ?? noMatch)
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(12)
          : skipped,
        domains.document
          ? supabase
          .from("business_documents")
          .select(
            "id, document_no, title, description, original_file_name, category, related_party_name, reference_no",
          )
          .eq("status", "active")
          .or(documentsFilter ?? noMatch)
          .order("created_at", { ascending: false })
          .limit(12)
          : skipped,
      ]);

    unavailableCount = [
      employees.error,
      knowledge.error,
      products.error,
      customers.error,
      suppliers.error,
      salesOrders.error,
      purchaseOrders.error,
      approvals.error,
      financeDocuments.error,
      announcements.error,
      documents.error,
    ].filter(Boolean).length;

    employeeResults = rankSearchResults(
      employees.data ?? [],
      query,
      (item) => [
          item.employee_no,
          item.name,
          item.english_name,
          item.title,
          item.email,
        ],
      (item) => [item.employee_no],
    )
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.english_name, item.title, item.email]
          .filter(Boolean)
          .join(" · "),
        meta: item.employee_no,
        href: "/organization",
      }));

    knowledgeResults = rankSearchResults(
      knowledge.data ?? [],
      query,
      (item) => [
          item.title,
          item.title_en,
          item.summary,
          item.content,
          item.keywords,
        ],
    )
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.summary,
        meta: "制度中心",
        href: `/knowledge/${item.slug}`,
      }));

    productResults = rankSearchResults(
      products.data ?? [],
      query,
      (item) => [
          item.code,
          item.short_name,
          item.name,
          item.brand,
          item.specification,
          item.keywords,
        ],
      (item) => [item.code],
    )
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.brand, item.specification].filter(Boolean).join(" · "),
        meta: item.code,
        href: `/products?product=${item.id}`,
      }));

    customerResults = rankSearchResults(
      customers.data ?? [],
      query,
      (item) => [
          item.customer_no,
          item.name,
          item.customer_type,
          item.region,
          item.tags,
          item.note,
        ],
      (item) => [item.customer_no],
    )
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.region, ...(item.tags ?? [])]
          .filter(Boolean)
          .join(" · "),
        meta: item.customer_no,
        href: `/customers?q=${encodeURIComponent(item.name)}`,
      }));

    supplierResults = rankSearchResults(
      suppliers.data ?? [],
      query,
      (item) => [
        item.supplier_no,
        item.name,
        item.short_name,
        item.category,
        item.unified_credit_code,
      ],
      (item) => [item.supplier_no, item.unified_credit_code],
    ).map((item) => ({
      id: item.id,
      title: item.name,
      description: [item.short_name, item.category].filter(Boolean).join(" · "),
      meta: item.supplier_no,
      href: `/suppliers/${item.id}`,
    }));

    salesOrderResults = rankSearchResults(
      salesOrders.data ?? [],
      query,
      (item) => [
        item.order_no,
        item.note,
        relatedName(item.customers),
        ...relatedProductNames(item.sales_order_items),
      ],
      (item) => [item.order_no],
    ).map((item) => ({
      id: item.id,
      title: item.order_no,
      description: [
        relatedName(item.customers),
        ...relatedProductNames(item.sales_order_items).slice(0, 2),
      ]
        .filter(Boolean)
        .join(" · "),
      meta: "销售订单",
      href: "/sales#orders",
    }));

    purchaseOrderResults = rankSearchResults(
      purchaseOrders.data ?? [],
      query,
      (item) => [
        item.order_no,
        item.note,
        relatedName(item.suppliers),
        ...relatedProductNames(item.purchase_order_items),
      ],
      (item) => [item.order_no],
    ).map((item) => ({
      id: item.id,
      title: item.order_no,
      description: [
        relatedName(item.suppliers),
        ...relatedProductNames(item.purchase_order_items).slice(0, 2),
      ]
        .filter(Boolean)
        .join(" · "),
      meta: "采购订单",
      href: "/purchasing#orders",
    }));

    approvalResults = rankSearchResults(
      approvals.data ?? [],
      query,
      (item) => [item.request_no, item.title, item.summary, item.request_type],
      (item) => [item.request_no],
    ).map((item) => ({
      id: item.id,
      title: item.title,
      description: item.summary ?? "查看审批详情与当前进度",
      meta: item.request_no,
      href: "/approvals",
    }));

    financeResults = rankSearchResults(
      financeDocuments.data ?? [],
      query,
      (item) => [
        item.document_no,
        item.counterparty_name,
        item.source_no,
        item.invoice_no,
        item.summary,
      ],
      (item) => [item.document_no, item.source_no, item.invoice_no],
    ).map((item) => ({
      id: item.id,
      title: item.document_no,
      description: [item.counterparty_name, item.summary]
        .filter(Boolean)
        .join(" · "),
      meta: item.document_type === "payable" ? "应付" : "应收",
      href:
        item.document_type === "payable"
          ? "/finance?book=payable#documents"
          : "/finance?book=receivable#documents",
    }));

    announcementResults = rankSearchResults(
      announcements.data ?? [],
      query,
      (item) => [item.title, item.summary, item.content],
    )
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.summary,
        meta: "公告",
        href: `/announcements/${item.id}`,
      }));

    documentResults = rankSearchResults(
      documents.data ?? [],
      query,
      (item) => [
          item.document_no,
          item.title,
          item.description,
          item.original_file_name,
          item.related_party_name,
          item.reference_no,
        ],
      (item) => [item.document_no, item.reference_no],
    )
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: [item.related_party_name, item.original_file_name]
          .filter(Boolean)
          .join(" · "),
        meta: item.document_no,
        href: `/documents?q=${encodeURIComponent(item.title)}`,
      }));
  }

  const groups = [
    {
      title: "功能与页面",
      icon: Search,
      results: functionResults,
    },
    {
      title: "员工",
      icon: UsersRound,
      results: employeeResults,
    },
    {
      title: "制度与知识",
      icon: BookOpenText,
      results: knowledgeResults,
    },
    {
      title: "产品",
      icon: PackageSearch,
      results: productResults,
    },
    {
      title: "客户",
      icon: Handshake,
      results: customerResults,
    },
    {
      title: "供应商",
      icon: Building2,
      results: supplierResults,
    },
    {
      title: "销售订单",
      icon: ShoppingCart,
      results: salesOrderResults,
    },
    {
      title: "采购订单",
      icon: Truck,
      results: purchaseOrderResults,
    },
    {
      title: "审批",
      icon: ClipboardCheck,
      results: approvalResults,
    },
    {
      title: "财务单据",
      icon: Landmark,
      results: financeResults,
    },
    {
      title: "公告",
      icon: Megaphone,
      results: announcementResults,
    },
    {
      title: "文件",
      icon: FileArchive,
      results: documentResults,
    },
  ];
  const total = groups.reduce((sum, group) => sum + group.results.length, 0);

  if (query) {
    logServerEvent("global_search_completed", {
      durationMs: Math.round(searchDurationMs()),
      queryLength: query.length,
      searchedDomainCount,
      unavailableDomainCount: unavailableCount,
      resultCount: total,
    });
  }

  return (
    <WorkflowShell
      activeItem=""
      breadcrumb="全局搜索"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1200px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <Search className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative max-w-3xl">
            <div className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
              GLOBAL SEARCH
            </div>
            <h1 className="mt-3 text-2xl font-semibold">全局搜索</h1>
            <p className="mt-3 text-sm leading-7 text-white/55">
              搜索功能、员工、客户、供应商、商品、业务单据和企业知识。结果只包含当前账号有权查看的数据。
            </p>
            <form className="relative mt-6" method="get">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-foreground" />
              <input
                autoFocus
                className="h-12 w-full rounded-lg bg-white pl-11 pr-24 text-xs text-foreground outline-none ring-4 ring-white/8 placeholder:text-foreground"
                defaultValue={query}
                maxLength={80}
                name="q"
                placeholder="输入功能、编号、名称或业务关键词"
                type="search"
              />
              <button
                className="absolute right-1.5 top-1.5 h-9 rounded-md bg-primary px-4 text-xs font-medium text-white"
                type="submit"
              >
                搜索
              </button>
            </form>
          </div>
        </section>

        {unavailableCount > 0 && (
          <div className="mt-5 rounded-md border border-border bg-muted px-4 py-3 text-xs text-foreground">
            有 {unavailableCount} 类数据暂时无法检索，其余结果仍可正常使用。
          </div>
        )}

        {!query ? (
          <section className="mt-5 rounded-md border border-border/80 bg-white px-6 py-14 text-center">
            <Search className="mx-auto size-7 text-muted-foreground/40" />
            <h2 className="mt-4 text-sm font-semibold">输入关键词开始搜索</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              例如：应收、销售订单号、五常大米、客户名称或员工姓名。
            </p>
          </section>
        ) : total === 0 ? (
          <section className="mt-5 rounded-md border border-border/80 bg-white px-6 py-14 text-center">
            <Search className="mx-auto size-7 text-muted-foreground/40" />
            <h2 className="mt-4 text-sm font-semibold">没有找到“{query}”</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              尝试缩短关键词，或确认当前账号是否具有对应模块权限。
            </p>
          </section>
        ) : (
          <>
            <div className="mt-5 text-xs text-muted-foreground">
              找到 {total} 条可访问结果
            </div>
            <div className="mt-3 space-y-4">
              {groups.map((group) => (
                <SearchGroup
                  count={group.results.length}
                  icon={group.icon}
                  key={group.title}
                  results={group.results}
                  title={group.title}
                />
              ))}
            </div>
          </>
        )}
      </main>
    </WorkflowShell>
  );
}
