import { bearerToken, requestId } from "@/lib/miniprogram/auth";
import { apiError, apiSuccess } from "@/lib/miniprogram/http";
import { revokeMiniprogramSession } from "@/lib/miniprogram/session";

export async function POST(request: Request) {
  const id = requestId();
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return apiError("UNAUTHORIZED", "请重新登录", id, 401);

  try {
    await revokeMiniprogramSession(token);
    return apiSuccess({ loggedOut: true }, id);
  } catch (error) {
    console.error("Mini Program logout failed", { requestId: id, error });
    return apiError("LOGOUT_FAILED", "退出失败，请稍后重试", id, 500);
  }
}
