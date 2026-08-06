import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, FilePlus2, ReceiptText, Stamp } from "lucide-react";
import { ApprovalCenterDemo } from "@/features/approvals/approval-center-demo";
import { ConnectedApprovalCenter } from "@/features/approvals/connected-approval-center";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = {
  title: "审批中心",
  description: "德馨星云统一审批中心与请假流程演示",
};

export const dynamic = "force-dynamic";

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    hr: "人事行政",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "普通员工",
  };

  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{
    created?: string;
    updated?: string;
    expenseCreated?: string;
    expenseUpdated?: string;
    sealCreated?: string;
    sealUpdated?: string;
    error?: string;
  }>;
}) {
  const configured = isSupabaseConfigured();
  const employee = configured ? await requireCurrentEmployee() : null;
  const feedback = await searchParams;

  return (
    <WorkflowShell
      breadcrumb="协同办公 / 审批中心"
      currentUser={
        employee
          ? {
              name: employee.name,
              roleLabel: roleLabel(employee.roleCodes) || "内部员工",
            }
          : undefined
      }
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <div className="absolute -right-16 -top-24 size-72 rounded-full border border-white/8" />
          <ClipboardCheck className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
                UNIFIED APPROVAL · CONNECTED
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                统一审批中心
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                集中处理请假、费用报销与用印申请。流程节点由服务端生成，待办只允许当前负责人在有效状态下处理。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/14 bg-white/8 px-4 text-xs text-white/75 transition-colors hover:bg-white/12"
                href="/requests/leave"
              >
                <FilePlus2 className="size-3.5" />
                请假申请
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/14 bg-white/8 px-4 text-xs text-white/75 transition-colors hover:bg-white/12"
                href="/requests/expense"
              >
                <ReceiptText className="size-3.5" />
                费用报销
              </Link>
              <Link
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#6bd7d4] px-4 text-xs font-medium text-[#0b3152] transition-colors hover:bg-[#a3e2ca]"
                href="/requests/seal"
              >
                <Stamp className="size-3.5" />
                用印申请
              </Link>
            </div>
          </div>
        </section>

        <div className="mt-5">
          {employee ? (
            <ConnectedApprovalCenter
              employee={employee}
              feedback={feedback}
            />
          ) : (
            <ApprovalCenterDemo />
          )}
        </div>
      </main>
    </WorkflowShell>
  );
}
