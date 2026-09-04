import type { Metadata } from "next";
import { ReceiptText } from "lucide-react";
import { ConnectedExpenseRequestForm } from "@/features/approvals/connected-expense-request-form";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "费用报销",
  description: "创建并提交德馨星云费用报销申请",
};

export const dynamic = "force-dynamic";

export default async function ExpenseRequestPage() {
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
      breadcrumb="协同办公 / 审批 / 费用报销"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="ui-page-header">
          <div className="absolute -right-16 -top-24 size-72 rounded-full border border-white/8" />
          <ReceiptText className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative">
            <div className="text-xs font-medium tracking-[0.12em] text-muted-foreground">
              EXPENSE CLAIM · UNIFIED WORKFLOW
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
              费用报销
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              填写费用信息后提交统一审批中心。系统根据金额自动生成审批节点，并在服务端校验处理人和状态。
            </p>
          </div>
        </section>

        <div className="mt-5">
          <ConnectedExpenseRequestForm
            departmentLabel={departmentLabel}
            employeeName={employee.name}
          />
        </div>
      </main>
    </WorkflowShell>
  );
}
