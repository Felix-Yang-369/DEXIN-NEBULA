import type { Metadata } from "next";
import { Stamp } from "lucide-react";
import { ConnectedSealRequestForm } from "@/features/approvals/connected-seal-request-form";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "用印申请",
  description: "创建并提交德馨星云用印申请",
};

export const dynamic = "force-dynamic";

export default async function SealRequestPage() {
  const employee = await requireCurrentEmployee();
  let departmentLabel = "部门未设置";

  if (employee.departmentId) {
    const supabase = await createClient();
    const { data: department } = await supabase
      .from("departments")
      .select("name")
      .eq("id", employee.departmentId)
      .maybeSingle();
    departmentLabel = department?.name ?? departmentLabel;
  }

  return (
    <WorkflowShell
      activeItem="审批"
      breadcrumb="协同办公 / 审批 / 用印申请"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <div className="absolute -right-16 -top-24 size-72 rounded-full border border-white/8" />
          <Stamp className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative">
            <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
              SEAL REQUEST · CONTROLLED WORKFLOW
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
              用印申请
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              在线登记文件、印章类型、份数与外带信息。审批通过后由行政完成用印登记，过程自动通知并留存审计记录。
            </p>
          </div>
        </section>

        <div className="mt-5">
          <ConnectedSealRequestForm
            departmentLabel={departmentLabel}
            employeeName={employee.name}
          />
        </div>
      </main>
    </WorkflowShell>
  );
}
