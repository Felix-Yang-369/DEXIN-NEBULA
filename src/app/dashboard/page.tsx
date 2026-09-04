import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import {
  getAppBootstrap,
  requireCurrentEmployee,
} from "@/features/auth/current-employee";
import { getDashboardData } from "@/lib/api/dashboard";

export const metadata: Metadata = {
  title: "企业经营驾驶舱",
  description: "连接销售、订单、库存、客户与组织协同的企业经营数据中枢",
};

export const dynamic = "force-dynamic";

function roleLabel(roleCodes: string[], title: string | null) {
  if (roleCodes.includes("admin")) {
    return "系统管理员";
  }
  if (roleCodes.includes("finance")) {
    return "财务管理";
  }
  if (roleCodes.includes("hr")) {
    return "人事管理";
  }
  if (roleCodes.includes("department_lead")) {
    return title ?? "部门负责人";
  }
  return title ?? "内部员工";
}

export default async function DashboardPage() {
  const employee = await requireCurrentEmployee();
  const [initialData, bootstrap] = await Promise.all([
    getDashboardData(employee),
    getAppBootstrap(),
  ]);
  const preference = bootstrap?.workspace;

  return (
    <WorkflowShell
      activeItem="驾驶舱"
      breadcrumb="经营决策 / 经营概览"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes, employee.title),
      }}
    >
      <DashboardClient
      initialData={initialData}
      identity={{ name: employee.name }}
      preferences={{
        pinnedModules: preference?.pinnedModules ?? ["sales", "inventory", "approvals"],
        hiddenWidgets: preference?.hiddenWidgets ?? [],
        density: "compact",
        defaultWorkspace: preference?.defaultWorkspace ?? "dashboard",
      }}
      />
    </WorkflowShell>
  );
}
