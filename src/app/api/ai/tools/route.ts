import { z } from "zod";
import { getCurrentEmployee } from "@/features/auth/current-employee";
import { executeBusinessTool } from "@/features/ai/business-tools";
import { logServerEvent } from "@/lib/observability/server-log";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const requestSchema = z.object({ tool: z.string().min(1).max(80), input: z.unknown() }).strict();

export async function POST(request: Request) {
  const employee = await getCurrentEmployee();
  if (!employee) return Response.json({ error: "登录状态已失效", code: "UNAUTHORIZED" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: "请求格式不正确", code: "INVALID_JSON" }, { status: 400 }); }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "工具请求格式无效", code: "INVALID_TOOL_REQUEST" }, { status: 400 });
  try {
    const payload = await executeBusinessTool(await createClient(), parsed.data.tool, parsed.data.input, employee.id);
    return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerEvent("ai_business_tool_failed", { tool: parsed.data.tool, employeeId: employee.id, error: error instanceof Error ? error.name : "unknown" }, "warn");
    return Response.json({ error: "工具无法完成查询，可能是数据不存在或当前账号无权访问", code: "TOOL_UNAVAILABLE" }, { status: 400 });
  }
}
