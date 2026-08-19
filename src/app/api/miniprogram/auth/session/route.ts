import { bearerToken, requestId } from "@/lib/miniprogram/auth";
import { apiError, apiSuccess } from "@/lib/miniprogram/http";
import { getMiniprogramSession } from "@/lib/miniprogram/session";

export async function GET(request: Request) {
  const id = requestId();
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return apiError("UNAUTHORIZED", "请重新登录", id, 401);

  try {
    const session = await getMiniprogramSession(token);
    if (!session) return apiError("SESSION_EXPIRED", "登录已过期，请重新登录", id, 401);
    return apiSuccess(session, id);
  } catch (error) {
    const code = error instanceof Error ? error.message : "SESSION_FAILED";
    if (code === "IDENTITY_BLOCKED" || code === "EMPLOYEE_INACTIVE") {
      return apiError(code, "当前账号不可用，请联系管理员", id, 403);
    }
    console.error("Mini Program session lookup failed", { requestId: id, error });
    return apiError("SESSION_FAILED", "会话验证失败，请稍后重试", id, 500);
  }
}
