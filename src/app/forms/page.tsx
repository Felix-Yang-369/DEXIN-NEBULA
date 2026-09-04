import type { Metadata } from "next";
import Link from "next/link";
import { PanelsTopLeft } from "lucide-react";
import { CapabilityHero } from "@/components/business/capability-hero";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "内部表单" };
export const dynamic = "force-dynamic";
export default async function Page() {
  const e = await requireCurrentEmployee();
  const s = await createClient();
  const [{ data: forms }, { data: submissions }] = await Promise.all([
    s
      .from("configurable_forms")
      .select("id,code,name,description,field_schema,version")
      .eq("status", "published")
      .order("name"),
    s
      .from("configurable_form_submissions")
      .select("id,submission_no,status,submitted_at,configurable_forms(name)")
      .order("submitted_at", { ascending: false })
      .limit(20),
  ]);
  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb="协同 / 内部表单"
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1200px] p-4 sm:p-6 xl:p-8">
        <CapabilityHero
          eyebrow="SELF SERVICE · FORMS"
          title="内部表单"
          description="按需填写已发布的企业表单，并跟踪自己的提交记录。"
          icon={PanelsTopLeft}
        />
        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {(forms ?? []).map((form) => (
            <Link
              className="rounded-md border border-border bg-white p-5"
              href={`/forms/${form.id}`}
              key={form.id}
            >
              <div className="text-sm font-semibold">{form.name}</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">
                {form.description ?? "企业内部标准表单"}
              </p>
              <div className="mt-4 text-xs text-primary">
                {Array.isArray(form.field_schema)
                  ? form.field_schema.length
                  : 0}{" "}
                个字段 · V{form.version}
              </div>
            </Link>
          ))}
        </section>
        <h2 className="mb-3 mt-7 text-sm font-semibold">我的提交</h2>
        <div className="space-y-2">
          {(submissions ?? []).map((row) => {
            const form = Array.isArray(row.configurable_forms)
              ? row.configurable_forms[0]
              : row.configurable_forms;
            return (
              <div
                className="flex justify-between rounded-md border border-border bg-white p-4 text-xs"
                key={row.id}
              >
                <span>
                  {form?.name} · <b>{row.submission_no}</b>
                </span>
                <span>
                  {row.status} ·{" "}
                  {new Date(row.submitted_at).toLocaleDateString("zh-CN")}
                </span>
              </div>
            );
          })}
        </div>
      </main>
    </WorkflowShell>
  );
}
