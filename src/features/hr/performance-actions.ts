"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const metricCodes = [
  "crm_sales_increment",
  "crm_profit_increment",
  "monthly_operating_revenue",
] as const;

const performancePlanSchema = z.object({
  employeeId: z.uuid("请选择员工"),
  planName: z.string().trim().min(2, "方案名称至少 2 个字").max(80),
  baseSalary: z
    .union([z.literal(""), z.coerce.number().min(0).max(1_000_000)])
    .transform((value) => (value === "" ? null : value)),
  revenueCommissionWanfen: z.coerce.number().min(0).max(10_000),
  effectiveFrom: z.iso.date("请选择生效日期"),
  metricCodes: z.array(z.enum(metricCodes)).min(1, "至少选择一个绩效指标"),
  salesTarget: z.union([z.literal(""), z.coerce.number()]),
  profitTarget: z.union([z.literal(""), z.coerce.number()]),
  revenueTarget: z.union([z.literal(""), z.coerce.number()]),
});

const metricDefinitions = {
  crm_sales_increment: {
    name: "负责客户销售增量",
    formulaNote: "本月负责客户已接受报价额－上月负责客户已接受报价额",
    targetField: "salesTarget",
  },
  crm_profit_increment: {
    name: "负责客户预计利润增量",
    formulaNote: "本月负责客户报价预计毛利－上月预计毛利",
    targetField: "profitTarget",
  },
  monthly_operating_revenue: {
    name: "公司月度营业收入",
    formulaNote: "当前暂按财务中心当月已确认收入流水汇总",
    targetField: "revenueTarget",
  },
} as const;

function redirectWithError(message: string): never {
  redirect(`/hr/performance?error=${encodeURIComponent(message)}`);
}

export async function savePerformancePlanAction(formData: FormData) {
  const currentEmployee = await requireCurrentEmployee();
  if (
    !currentEmployee.roleCodes.some((role) =>
      ["hr", "chairman"].includes(role),
    )
  ) {
    redirectWithError("当前账号没有绩效方案配置权限");
  }

  const parsed = performancePlanSchema.safeParse({
    employeeId: formData.get("employeeId"),
    planName: formData.get("planName"),
    baseSalary: formData.get("baseSalary") ?? "",
    revenueCommissionWanfen:
      formData.get("revenueCommissionWanfen") ?? "0",
    effectiveFrom: formData.get("effectiveFrom"),
    metricCodes: formData.getAll("metricCodes"),
    salesTarget: formData.get("salesTarget") ?? "",
    profitTarget: formData.get("profitTarget") ?? "",
    revenueTarget: formData.get("revenueTarget") ?? "",
  });

  if (!parsed.success) {
    redirectWithError(parsed.error.issues[0]?.message ?? "请检查绩效方案");
  }

  const metrics = parsed.data.metricCodes.map((code, index) => {
    const definition = metricDefinitions[code];
    const target = parsed.data[definition.targetField];
    return {
      code,
      name: definition.name,
      unit: "元",
      targetValue: target === "" ? null : target,
      weightPercent: null,
      formulaNote: definition.formulaNote,
      sortOrder: (index + 1) * 10,
    };
  });

  const supabase = await createClient();
  const { error } = await supabase.rpc("save_employee_performance_plan", {
    p_employee_id: parsed.data.employeeId,
    p_plan_name: parsed.data.planName,
    p_base_salary_cny: parsed.data.baseSalary,
    p_revenue_commission_rate:
      parsed.data.revenueCommissionWanfen / 10_000,
    p_effective_from: parsed.data.effectiveFrom,
    p_metrics: metrics,
  });

  if (error) {
    redirectWithError(
      error.message.includes("只有人事")
        ? "当前账号没有绩效方案配置权限"
        : "绩效方案保存失败，请刷新后重试",
    );
  }

  revalidatePath("/hr");
  revalidatePath("/hr/performance");
  redirect("/hr/performance?saved=1");
}
