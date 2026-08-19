import "server-only";

import { getMiniprogramConfig } from "./config";
import type { WeChatCodeSession } from "./types";

type WeChatError = {
  errcode?: number;
  errmsg?: string;
};

export async function exchangeWeChatCode(code: string): Promise<WeChatCodeSession> {
  const { appId, appSecret } = getMiniprogramConfig();
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", appId);
  url.searchParams.set("secret", appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("WECHAT_UPSTREAM_UNAVAILABLE");

  const body = (await response.json()) as WeChatCodeSession & WeChatError;
  if (body.errcode || !body.openid || !body.session_key) {
    throw new Error(body.errcode === 40029 ? "WECHAT_CODE_INVALID" : "WECHAT_LOGIN_FAILED");
  }
  return body;
}
