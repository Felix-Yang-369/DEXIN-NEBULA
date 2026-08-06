import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenText,
  ChevronRight,
  FileSearch,
  LibraryBig,
  Search,
  ShieldCheck,
} from "lucide-react";
import { DexiaoxinAvatar } from "@/components/brand/dexiaoxin-avatar";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  isKnowledgeCategory,
  knowledgeCategories,
  type KnowledgeDocument,
} from "@/features/knowledge/knowledge-types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "制度中心",
  description: "德馨淼盛内部制度、文化与岗位知识库",
};

export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN");
}

function formatDate(value: string | null) {
  if (!value) return "待确认";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const query = normalize(params.q ?? "");
  const category = isKnowledgeCategory(params.category)
    ? params.category
    : "all";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, slug, title, title_en, category_code, summary, content, keywords, owner_label, source_file_name, version, effective_on, published_at, updated_at",
    )
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);

  const documents = (data ?? []) as KnowledgeDocument[];
  const filteredDocuments = documents.filter((document) => {
    if (category !== "all" && document.category_code !== category) {
      return false;
    }

    if (!query) return true;

    return [
      document.title,
      document.title_en,
      document.summary,
      document.content,
      document.owner_label,
      ...document.keywords,
    ]
      .filter(Boolean)
      .some((value) => normalize(String(value)).includes(query));
  });

  const categoryCounts = Object.fromEntries(
    Object.keys(knowledgeCategories).map((code) => [
      code,
      documents.filter((item) => item.category_code === code).length,
    ]),
  );

  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb="协同办公 / 制度与知识"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <div className="absolute -right-20 -top-36 size-80 rounded-full border border-white/8" />
          <div className="absolute -bottom-44 right-36 size-80 rounded-full border border-white/[0.055]" />
          <LibraryBig className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
                POLICY & KNOWLEDGE
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                制度与知识库
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                统一查找公司文化、行为规范、行政考勤和岗位制度。内容来自现有正式文件，并保留来源与版本信息。
              </p>
            </div>
            <div className="flex w-fit items-center gap-3 rounded-2xl border border-white/12 bg-white/[0.07] px-4 py-3">
              <ShieldCheck className="size-5 text-[#6bd7d4]" />
              <div>
                <div className="text-[10px] text-white/42">访问范围</div>
                <div className="mt-0.5 text-xs text-white/80">仅内部在职员工</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-4 shadow-[0_10px_35px_-28px_rgba(23,57,50,.32)] sm:p-5">
          <form className="flex flex-col gap-3 lg:flex-row" method="get">
            <label className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/65" />
              <input
                aria-label="搜索制度"
                className="h-11 w-full rounded-xl border border-border bg-[#f3f7fa] pl-11 pr-4 text-xs outline-none transition-colors placeholder:text-muted-foreground/55 focus:border-primary/35 focus:bg-white focus:ring-4 focus:ring-primary/7"
                defaultValue={params.q}
                name="q"
                placeholder="搜索制度名称、关键词或正文，例如：请假、空调、保密"
                type="search"
              />
            </label>
            {category !== "all" && (
              <input name="category" type="hidden" value={category} />
            )}
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-xs font-medium text-primary-foreground transition-colors hover:bg-[#184c41]"
              type="submit"
            >
              <FileSearch className="size-4" />
              搜索制度
            </button>
          </form>
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            <Link
              className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-medium transition-colors ${
                category === "all"
                  ? "bg-[#183f37] text-white"
                  : "border border-border text-muted-foreground hover:bg-muted"
              }`}
              href={params.q ? `/knowledge?q=${encodeURIComponent(params.q)}` : "/knowledge"}
            >
              全部 · {documents.length}
            </Link>
            {Object.entries(knowledgeCategories).map(([code, meta]) => {
              const search = new URLSearchParams({ category: code });
              if (params.q) search.set("q", params.q);

              return (
                <Link
                  className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-medium transition-colors ${
                    category === code
                      ? "bg-[#183f37] text-white"
                      : "border border-border text-muted-foreground hover:bg-muted"
                  }`}
                  href={`/knowledge?${search.toString()}`}
                  key={code}
                >
                  {meta.label} · {categoryCounts[code] ?? 0}
                </Link>
              );
            })}
          </div>
        </section>

        {error ? (
          <section className="mt-5 rounded-[22px] border border-[#ead8d8] bg-[#f8eeee] px-6 py-12 text-center text-[#965151]">
            <FileSearch className="mx-auto size-7" />
            <h2 className="mt-4 text-sm font-semibold">暂时无法读取制度数据</h2>
            <p className="mt-2 text-xs text-[#965151]/75">
              请确认第十一个数据库迁移已经执行后重试。
            </p>
          </section>
        ) : filteredDocuments.length === 0 ? (
          <section className="mt-5 rounded-[22px] border border-border/80 bg-white px-6 py-14 text-center">
            <Search className="mx-auto size-7 text-muted-foreground/45" />
            <h2 className="mt-4 text-sm font-semibold">没有找到匹配的制度</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              尝试简化关键词或切换分类。
            </p>
            <Link
              className="mt-5 inline-flex h-9 items-center rounded-xl bg-[#eef4f8] px-4 text-xs font-medium text-primary"
              href="/knowledge"
            >
              清除筛选
            </Link>
          </section>
        ) : (
          <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredDocuments.map((document) => {
              const meta = knowledgeCategories[document.category_code];

              return (
                <Link
                  className="group flex min-h-[285px] flex-col overflow-hidden rounded-[22px] border border-border/80 bg-white p-6 shadow-[0_10px_35px_-28px_rgba(23,57,50,.32)] transition duration-300 hover:-translate-y-1 hover:border-primary/20 hover:shadow-[0_20px_45px_-28px_rgba(23,57,50,.34)]"
                  href={`/knowledge/${document.slug}`}
                  key={document.id}
                >
                  <div className="flex items-start justify-between gap-4">
                    <span
                      className={`rounded-full px-3 py-1.5 text-[9px] font-medium ${meta.tone}`}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[9px] tracking-[0.12em] text-muted-foreground/55">
                      V{document.version}
                    </span>
                  </div>
                  <div className="mt-7 text-[10px] font-medium tracking-[0.14em] text-primary/55">
                    {document.title_en ?? meta.eyebrow}
                  </div>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[#183c35]">
                    {document.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 text-xs leading-6 text-muted-foreground">
                    {document.summary}
                  </p>
                  <div className="mt-auto flex items-end justify-between gap-3 pt-6">
                    <div className="text-[9px] leading-5 text-muted-foreground/70">
                      <div>{document.owner_label ?? "制度发布部门"}</div>
                      <div>更新于 {formatDate(document.updated_at)}</div>
                    </div>
                    <span className="grid size-9 place-items-center rounded-xl bg-[#eef4f8] text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                      <ChevronRight className="size-4" />
                    </span>
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        <section className="mt-5 flex flex-col gap-4 rounded-[22px] border border-[#d9e8ee] bg-[#eef4f8] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-start gap-4">
            <DexiaoxinAvatar className="size-11" decorative />
            <div>
              <h2 className="text-sm font-semibold text-[#234b42]">
                为德小馨 AI 准备的可信知识底座
              </h2>
              <p className="mt-1.5 max-w-3xl text-[11px] leading-6 text-[#5c7587]">
                德小馨已经接入内部制度的结构化检索，只读取当前员工有权查看的内容，并在回答中展示来源制度。
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 text-[10px] font-medium text-primary">
            <BookOpenText className="size-3.5" />
            已收录 {documents.length} 份制度
          </span>
        </section>
      </main>
    </WorkflowShell>
  );
}
