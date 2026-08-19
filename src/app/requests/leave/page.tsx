import type { Metadata } from "next";
import { FilePlus2 } from "lucide-react";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { ConnectedLeaveRequestForm } from "@/features/approvals/connected-leave-request-form";
import { LeaveRequestForm } from "@/features/approvals/leave-request-form";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "请假申请",
  description: "创建并提交德馨星云请假申请",
};

export const dynamic = "force-dynamic";

export default async function LeaveRequestPage() {
  const configured = isSupabaseConfigured();
  const employee = configured ? await requireCurrentEmployee() : null;
  let departmentLabel = "部门未设置";

  if (employee?.departmentId) {
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
      activeItem="人力资源"
      breadcrumb="组织运营 / 人力资源 / 请假"
      currentUser={
        employee
          ? {
              name: employee.name,
              roleLabel: employee.title ?? "内部员工",
            }
          : undefined
      }
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <div className="absolute -right-16 -top-24 size-72 rounded-full border border-white/8" />
          <FilePlus2 className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative">
            <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
              LEAVE REQUEST · CONNECTED
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
              请假申请
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              流程将根据请假天数自动匹配直属上级、董事长和行政人事备案节点。
              当前规则依据《考勤管理制度》，审批通过后自动写入 HRM 考勤与假期记录。
            </p>
          </div>
        </section>

        <div className="mt-5">
          {employee ? (
            <ConnectedLeaveRequestForm
              departmentLabel={departmentLabel}
              employeeName={employee.name}
            />
          ) : (
            <LeaveRequestForm />
          )}
        </div>
      </main>
    </WorkflowShell>
  );
}
