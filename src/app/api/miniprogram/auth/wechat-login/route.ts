import { z } from "zod";
import { createMiniprogramSession } from "@/lib/miniprogram/session";
import { isMiniprogramConfigured } from "@/lib/miniprogram/config";
import { apiError, apiSuccess } from "@/lib/miniprogram/http";
import { requestId } from "@/lib/miniprogram/auth";
import { exchangeWeChatCode } from "@/lib/miniprogram/wechat";

const loginSchema = z.object({
  code: z.string().trim().min(1).max(128),
}).strict();

export async function POST(request: Request) {
  const id = requestId();
  if (!isMiniprogramConfigured()) {
    return apiError("SERVICE_NOT_CONFIGURED", "小程序登录服务尚未配置", id, 503);
  }

  let input: z.infer<typeof loginSchema>;
  try {
    input = loginSchema.parse(await request.json());
  } catch {
    return apiError("INVALID_REQUEST", "登录请求格式无效", id, 400);
  }

  try {
    const codeSession = await exchangeWeChatCode(input.code);
    const session = await createMiniprogramSession(codeSession, {
      requestId: id,
      userAgent: request.headers.get("user-agent")?.slice(0, 240) ?? "",
    });
    return apiSuccess(session, id);
  } catch (error) {
    const code = error instanceof Error ? error.message : "LOGIN_FAILED";
    if (code === "WECHAT_CODE_INVALID") {
      return apiError(code, "微信登录凭证无效，请重新登录", id, 401);
    }
    if (code === "IDENTITY_BLOCKED") {
      return apiError(code, "当前账号已停用", id, 403);
    }
    if (code === "EMPLOYEE_INACTIVE") {
      return apiError(code, "员工账号已停用，请联系管理员", id, 403);
    }
    if (code === "WECHAT_UPSTREAM_UNAVAILABLE") {
      return apiError(code, "微信登录服务暂时不可用", id, 502);
    }
    console.error("Mini Program sign-in failed", { requestId: id, error });
    return apiError("LOGIN_FAILED", "登录失败，请稍后重试", id, 500);
  }
}
