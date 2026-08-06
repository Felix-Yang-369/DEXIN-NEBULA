import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenText,
  ChevronRight,
  FileArchive,
  Handshake,
  Megaphone,
  PackageSearch,
  Search,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "全局搜索",
  description: "在权限范围内搜索德馨星云员工、制度、产品、客户和公告",
};

export const dynamic = "force-dynamic";

type SearchResult = {
  id: string;
  title: string;
  description: string;
  meta: string;
  href: string;
};

function matches(query: string, values: unknown[]) {
  const normalized = query.toLocaleLowerCase("zh-CN");
  return values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .filter(Boolean)
    .some((value) =>
      String(value).toLocaleLowerCase("zh-CN").includes(normalized),
    );
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
    <section className="overflow-hidden rounded-[22px] border border-border/80 bg-white">
      <div className="flex items-center justify-between border-b border-border/75 px-5 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#eef4f8] text-primary">
            <Icon className="size-4" />
          </span>
          <h2 className="text-sm font-semibold text-[#294b65]">{title}</h2>
        </div>
        <span className="text-[10px] text-muted-foreground">{count} 条结果</span>
      </div>
      <div className="divide-y divide-border/75">
        {results.map((result) => (
          <Link
            className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-[#fbfcfc] sm:px-6"
            href={result.href}
            key={result.id}
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-xs font-semibold text-[#294b65]">
                  {result.title}
                </h3>
                <span className="rounded-full bg-[#f1f5f3] px-2 py-1 text-[9px] text-muted-foreground">
                  {result.meta}
                </span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-5 text-muted-foreground">
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
  const query = (params.q ?? "").trim().slice(0, 80);
  const supabase = await createClient();

  let employeeResults: SearchResult[] = [];
  let knowledgeResults: SearchResult[] = [];
  let productResults: SearchResult[] = [];
  let customerResults: SearchResult[] = [];
  let announcementResults: SearchResult[] = [];
  let documentResults: SearchResult[] = [];
  let unavailableCount = 0;

  if (query) {
    const [employees, knowledge, products, customers, announcements, documents] =
      await Promise.all([
        supabase
          .from("employees")
          .select("id, employee_no, name, english_name, title, email")
          .eq("status", "active")
          .order("employee_no")
          .limit(100),
        supabase
          .from("knowledge_documents")
          .select("id, slug, title, title_en, summary, content, keywords")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(100),
        supabase
          .from("products")
          .select(
            "id, code, short_name, name, brand, specification, keywords, category",
          )
          .eq("status", "active")
          .order("code")
          .limit(100),
        supabase
          .from("customers")
          .select("id, customer_no, name, customer_type, region, tags, note")
          .neq("status", "inactive")
          .order("updated_at", { ascending: false })
          .limit(100),
        supabase
          .from("announcements")
          .select("id, title, summary, content, category_code")
          .eq("status", "published")
          .order("is_pinned", { ascending: false })
          .order("published_at", { ascending: false })
          .limit(100),
        supabase
          .from("business_documents")
          .select(
            "id, document_no, title, description, original_file_name, category, related_party_name, reference_no",
          )
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

    unavailableCount = [
      employees.error,
      knowledge.error,
      products.error,
      customers.error,
      announcements.error,
      documents.error,
    ].filter(Boolean).length;

    employeeResults = (employees.data ?? [])
      .filter((item) =>
        matches(query, [
          item.employee_no,
          item.name,
          item.english_name,
          item.title,
          item.email,
        ]),
      )
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.english_name, item.title, item.email]
          .filter(Boolean)
          .join(" · "),
        meta: item.employee_no,
        href: "/organization",
      }));

    knowledgeResults = (knowledge.data ?? [])
      .filter((item) =>
        matches(query, [
          item.title,
          item.title_en,
          item.summary,
          item.content,
          item.keywords,
        ]),
      )
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.summary,
        meta: "制度中心",
        href: `/knowledge/${item.slug}`,
      }));

    productResults = (products.data ?? [])
      .filter((item) =>
        matches(query, [
          item.code,
          item.short_name,
          item.name,
          item.brand,
          item.specification,
          item.keywords,
        ]),
      )
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.brand, item.specification].filter(Boolean).join(" · "),
        meta: item.code,
        href: `/products?product=${item.id}`,
      }));

    customerResults = (customers.data ?? [])
      .filter((item) =>
        matches(query, [
          item.customer_no,
          item.name,
          item.customer_type,
          item.region,
          item.tags,
          item.note,
        ]),
      )
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.name,
        description: [item.region, ...(item.tags ?? [])]
          .filter(Boolean)
          .join(" · "),
        meta: item.customer_no,
        href: `/customers?q=${encodeURIComponent(item.name)}`,
      }));

    announcementResults = (announcements.data ?? [])
      .filter((item) =>
        matches(query, [item.title, item.summary, item.content]),
      )
      .slice(0, 5)
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.summary,
        meta: "公告",
        href: `/announcements/${item.id}`,
      }));

    documentResults = (documents.data ?? [])
      .filter((item) =>
        matches(query, [
          item.document_no,
          item.title,
          item.description,
          item.original_file_name,
          item.related_party_name,
          item.reference_no,
        ]),
      )
      .slice(0, 5)
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

  return (
    <WorkflowShell
      activeItem=""
      breadcrumb="全局搜索"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1280px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-9">
          <Search className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative max-w-3xl">
            <div className="text-[10px] font-medium tracking-[0.14em] text-[#79d8d5]">
              GLOBAL SEARCH
            </div>
            <h1 className="mt-3 text-2xl font-semibold">全局搜索</h1>
            <p className="mt-3 text-sm leading-7 text-white/55">
              搜索员工、制度、产品、客户、公告和企业文件。结果只包含当前账号有权查看的数据。
            </p>
            <form className="relative mt-6" method="get">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#52756c]" />
              <input
                autoFocus
                className="h-12 w-full rounded-2xl bg-white pl-11 pr-24 text-xs text-[#294b65] outline-none ring-4 ring-white/8 placeholder:text-[#82958f]"
                defaultValue={query}
                maxLength={80}
                name="q"
                placeholder="输入姓名、制度、产品、客户、公告或文件"
                type="search"
              />
              <button
                className="absolute right-1.5 top-1.5 h-9 rounded-xl bg-primary px-4 text-xs font-medium text-white"
                type="submit"
              >
                搜索
              </button>
            </form>
          </div>
        </section>

        {unavailableCount > 0 && (
          <div className="mt-5 rounded-xl border border-[#f0dfc7] bg-[#fff8ee] px-4 py-3 text-xs text-[#8b6d46]">
            有 {unavailableCount} 类数据暂时无法检索，其余结果仍可正常使用。
          </div>
        )}

        {!query ? (
          <section className="mt-5 rounded-[22px] border border-border/80 bg-white px-6 py-14 text-center">
            <Search className="mx-auto size-7 text-muted-foreground/40" />
            <h2 className="mt-4 text-sm font-semibold">输入关键词开始搜索</h2>
            <p className="mt-2 text-[10px] text-muted-foreground">
              例如：请假、五常大米、客户名称、员工姓名或网络通知。
            </p>
          </section>
        ) : total === 0 ? (
          <section className="mt-5 rounded-[22px] border border-border/80 bg-white px-6 py-14 text-center">
            <Search className="mx-auto size-7 text-muted-foreground/40" />
            <h2 className="mt-4 text-sm font-semibold">没有找到“{query}”</h2>
            <p className="mt-2 text-[10px] text-muted-foreground">
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
