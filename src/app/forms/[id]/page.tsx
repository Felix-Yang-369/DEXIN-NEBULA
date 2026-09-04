import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  DynamicForm,
  type DynamicField,
} from "@/features/experience/dynamic-form";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "填写内部表单" };
export const dynamic = "force-dynamic";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ submitted?: string; error?: string }>;
}) {
  const [e, { id }, feedback] = await Promise.all([
    requireCurrentEmployee(),
    params,
    searchParams,
  ]);
  const s = await createClient();
  const { data } = await s
    .from("configurable_forms")
    .select("id,name,description,field_schema,version")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (!data) notFound();
  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb={`协同 / 内部表单 / ${data.name}`}
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-2xl p-4 sm:p-6 xl:p-8">
        <section className="rounded-md border border-border bg-white p-6 sm:p-8">
          <div className="text-xs tracking-[.14em] text-primary">
            FORM · V{data.version}
          </div>
          <h1 className="mt-2 text-xl font-semibold">{data.name}</h1>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            {data.description}
          </p>
          {(feedback.submitted || feedback.error) && (
            <div className="my-4 rounded-md border p-3 text-xs">
              {feedback.error ? "提交失败，请检查必填字段。" : "表单已提交。"}
            </div>
          )}
          <div className="mt-6">
            <DynamicForm
              fields={(data.field_schema ?? []) as unknown as DynamicField[]}
              formId={data.id}
            />
          </div>
        </section>
      </main>
    </WorkflowShell>
  );
}
