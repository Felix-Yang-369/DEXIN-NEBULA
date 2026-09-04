import type { Metadata } from "next";
import { PanelsTopLeft } from "lucide-react";
import { BusinessDataTable } from "@/components/business/business-data-table";
import { CapabilityHero } from "@/components/business/capability-hero";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { saveFormDefinitionAction } from "@/features/experience/actions";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "表单设计器" };
export const dynamic = "force-dynamic";
const sample = JSON.stringify(
  [
    { key: "subject", label: "申请主题", type: "text", required: true },
    { key: "amount", label: "金额", type: "number", required: false },
  ],
  null,
  2,
);
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const [e, p] = await Promise.all([requireCurrentEmployee(), searchParams]);
  const s = await createClient();
  const { data } = await s
    .from("configurable_forms")
    .select("id,code,name,status,version,field_schema,updated_at")
    .order("updated_at", { ascending: false });
  return (
    <WorkflowShell
      activeItem="系统管理"
      breadcrumb="系统 / 表单设计器"
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1300px] p-4 sm:p-6 xl:p-8">
        <CapabilityHero
          eyebrow="FORM · VERSION · WORKFLOW"
          title="表单设计器"
          description="以版本化字段定义快速创建内部表单，字段校验和提交权限由服务端统一执行。"
          icon={PanelsTopLeft}
        />
        {(p.created || p.error) && (
          <div className="mt-4 rounded-xl border p-3 text-[10px]">
            {p.error ? "保存失败，请检查字段定义和权限。" : "表单已保存。"}
          </div>
        )}
        <div className="mt-5 grid gap-5 xl:grid-cols-[420px_1fr]">
          <form
            action={saveFormDefinitionAction}
            className="grid gap-3 rounded-[20px] border border-border bg-white p-5"
          >
            <h2 className="text-sm font-semibold">创建表单</h2>
            <input
              className="h-9 rounded-xl border px-3 text-[10px]"
              name="code"
              placeholder="form_code"
              required
            />
            <input
              className="h-9 rounded-xl border px-3 text-[10px]"
              name="name"
              placeholder="表单名称"
              required
            />
            <input
              className="h-9 rounded-xl border px-3 text-[10px]"
              name="description"
              placeholder="用途说明"
            />
            <select
              className="h-9 rounded-xl border bg-white px-3 text-[10px]"
              name="status"
            >
              <option value="draft">草稿</option>
              <option value="published">发布</option>
            </select>
            <textarea
              className="min-h-72 rounded-xl border p-3 font-mono text-[9px]"
              defaultValue={sample}
              name="schema"
            />
            <button className="h-9 rounded-xl bg-primary text-[10px] text-white">
              保存表单
            </button>
          </form>
          <BusinessDataTable
            columns={[
              { key: "form", label: "表单" },
              { key: "status", label: "状态" },
              { key: "version", label: "版本" },
              { key: "fields", label: "字段数" },
              { key: "updated", label: "更新时间" },
            ]}
            rows={(data ?? []).map((x) => ({
              form: (
                <div>
                  <b>{x.name}</b>
                  <div className="font-mono text-[9px] text-muted-foreground">
                    {x.code}
                  </div>
                </div>
              ),
              status: x.status,
              version: `V${x.version}`,
              fields: Array.isArray(x.field_schema) ? x.field_schema.length : 0,
              updated: new Date(x.updated_at).toLocaleString("zh-CN"),
            }))}
            rowKeys={(data ?? []).map((x) => x.id)}
            total={(data ?? []).length}
            page={1}
            pageSize={100}
            pathname="/system/forms"
          />
        </div>
      </main>
    </WorkflowShell>
  );
}
