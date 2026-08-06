import {
  getCurrentEmployee,
} from "@/features/auth/current-employee";
import { getDashboardData } from "@/lib/api/dashboard";
import type { DashboardApiResponse } from "@/types/dashboard";

export const dynamic = "force-dynamic";

export async function GET() {
  const employee = await getCurrentEmployee();
  if (!employee) {
    return Response.json(
      { ok: false, error: "登录状态已失效，请重新登录" } satisfies DashboardApiResponse,
      { status: 401 },
    );
  }

  try {
    const data = await getDashboardData(employee);
    return Response.json(
      { ok: true, data } satisfies DashboardApiResponse,
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      },
    );
  } catch (error) {
    console.error(
      "dashboard data load failed",
      error instanceof Error ? error.name : "unknown",
    );
    return Response.json(
      { ok: false, error: "经营数据读取失败，请稍后重试" } satisfies DashboardApiResponse,
      { status: 500 },
    );
  }
}
