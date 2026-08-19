import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Megaphone, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { AnnouncementForm } from "@/features/announcements/announcement-form";
import type { AnnouncementRow } from "@/features/announcements/announcement-data";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "新建公告",
  description: "创建德馨淼盛内部公告草稿或正式发布",
};

export const dynamic = "force-dynamic";

export default async function NewAnnouncementPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; saved?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const canPublish = employee.roleCodes.some((role) =>
    ["hr", "admin"].includes(role),
  );
  if (!canPublish) redirect("/announcements");

  const params = await searchParams;
  const supabase = await createClient();
  const [{ data: departments }, draftResult] = await Promise.all([
    supabase
      .from("departments")
      .select("id, name")
      .eq("status", "active")
      .order("code"),
    params.edit
      ? supabase
          .from("announcements")
          .select(
            "id, title, summary, content, category_code, scope_type, scope_department_id, status, is_pinned, author_employee_id, author_name, published_at, created_at, updated_at",
          )
          .eq("id", params.edit)
          .eq("status", "draft")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  const draft = (draftResult.data ?? null) as AnnouncementRow | null;

  return (
    <WorkflowShell
      activeItem="协同工作台"
      breadcrumb="协同办公 / 协同工作台 / 公告 / 新建"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1180px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-white px-3 text-[10px] font-medium text-muted-foreground"
          href="/announcements"
        >
          <ArrowLeft className="size-3.5" />
          返回公告中心
        </Link>

        <section className="relative mt-4 overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-9">
          <Megaphone className="pointer-events-none absolute right-10 top-1/2 hidden size-36 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative">
            <div className="text-[10px] font-medium tracking-[0.14em] text-[#79d8d5]">
              ANNOUNCEMENT PUBLISHING
            </div>
            <h1 className="mt-3 text-2xl font-semibold">
              {draft ? "编辑公告草稿" : "新建公告"}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              发布前请确认标题、正文、可见范围和敏感信息；正式发布后将锁定内容并通知员工。
            </p>
          </div>
        </section>

        {params.saved === "draft" && (
          <div className="mt-5 rounded-xl border border-[#d8e3ea] bg-[#edf2f7] px-4 py-3 text-xs text-[#42647a]">
            公告草稿已保存，尚未向员工发布。
          </div>
        )}

        <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-7">
          <AnnouncementForm
            departments={(departments ?? []) as Array<{ id: string; name: string }>}
            draft={draft}
          />
        </section>

        <section className="mt-5 flex gap-3 rounded-[20px] border border-[#d9e8ee] bg-[#eef4f8] p-5">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-[10px] leading-6 text-[#5c7587]">
            不要在公告中写入身份证号、银行卡、工资、私人联系方式、客户底价或账号密码等敏感内容。
          </p>
        </section>
      </main>
    </WorkflowShell>
  );
}
