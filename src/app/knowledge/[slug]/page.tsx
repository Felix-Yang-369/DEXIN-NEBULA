import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BookOpenText,
  Building2,
  CalendarDays,
  FileText,
  Tag,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  KnowledgeContent,
  KnowledgeMetaItem,
} from "@/features/knowledge/knowledge-content";
import {
  knowledgeCategories,
  type KnowledgeDocument,
} from "@/features/knowledge/knowledge-types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function formatDate(value: string | null) {
  if (!value) return "以正式发布记录为准";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

async function getDocument(slug: string, strict = true) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("knowledge_documents")
    .select(
      "id, slug, title, title_en, category_code, summary, content, keywords, owner_label, source_file_name, version, effective_on, published_at, updated_at",
    )
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();

  if (error && strict) {
    throw new Error("knowledge_document_unavailable");
  }

  return error ? null : (data as KnowledgeDocument | null);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const document = await getDocument(slug, false);

  return {
    title: document?.title ?? "制度详情",
    description: document?.summary ?? "德馨淼盛内部制度详情",
  };
}

export default async function KnowledgeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const { slug } = await params;
  const document = await getDocument(slug);

  if (!document) notFound();

  const category = knowledgeCategories[document.category_code];

  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb={`协同办公 / 制度与知识 / ${document.title}`}
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1380px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-white px-3 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          href="/knowledge"
        >
          <ArrowLeft className="size-3.5" />
          返回制度中心
        </Link>

        <section className="relative mt-4 overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-9 sm:py-10">
          <div className="absolute -right-20 -top-40 size-96 rounded-full border border-white/8" />
          <BookOpenText className="pointer-events-none absolute right-10 top-1/2 hidden size-44 -translate-y-1/2 text-white/[0.055] md:block" />
          <div className="relative max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-[#6bd7d4] px-3 py-1.5 text-[9px] font-semibold text-[#0b3152]">
                {category.label}
              </span>
              <span className="text-[9px] tracking-[0.13em] text-white/42">
                INTERNAL · V{document.version}
              </span>
            </div>
            {document.title_en && (
              <div className="mt-7 text-[10px] font-medium tracking-[0.16em] text-[#79d8d5]">
                {document.title_en.toUpperCase()}
              </div>
            )}
            <h1 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-4xl">
              {document.title}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58">
              {document.summary}
            </p>
          </div>
        </section>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
          <article className="rounded-[22px] border border-border/80 bg-white px-6 py-7 shadow-[0_10px_35px_-28px_rgba(23,57,50,.32)] sm:px-9 sm:py-10">
            <KnowledgeContent content={document.content} />
          </article>

          <aside className="space-y-4 lg:sticky lg:top-[92px]">
            <section className="rounded-[22px] border border-border/80 bg-white p-5">
              <h2 className="text-xs font-semibold tracking-[-0.01em] text-[#294b65]">
                文档信息
              </h2>
              <div className="mt-5 space-y-5">
                <KnowledgeMetaItem
                  icon={<Building2 className="size-3.5" />}
                  label="负责部门"
                  value={document.owner_label ?? "待确认"}
                />
                <KnowledgeMetaItem
                  icon={<FileText className="size-3.5" />}
                  label="来源文件"
                  value={document.source_file_name ?? "内部制度"}
                />
                <KnowledgeMetaItem
                  icon={<CalendarDays className="size-3.5" />}
                  label="最近更新"
                  value={formatDate(document.updated_at)}
                />
                <KnowledgeMetaItem
                  icon={<Tag className="size-3.5" />}
                  label="制度版本"
                  value={`V${document.version}`}
                />
              </div>
            </section>

            <section className="rounded-[22px] border border-[#d9e8ee] bg-[#eef4f8] p-5">
              <div className="text-[10px] font-medium tracking-[0.12em] text-primary">
                阅读提示
              </div>
              <p className="mt-2 text-[11px] leading-6 text-[#5c7587]">
                本页用于内部查询。涉及劳动、薪酬或处罚等事项时，以公司正式发布文件、最新通知及依法履行的程序为准。
              </p>
            </section>
          </aside>
        </div>
      </main>
    </WorkflowShell>
  );
}
