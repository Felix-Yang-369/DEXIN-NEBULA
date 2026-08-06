import "server-only";

import {
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
} from "@/lib/supabase/config";

const corpId = process.env.WECOM_CORP_ID;
const agentId = process.env.WECOM_AGENT_ID;
const appSecret = process.env.WECOM_APP_SECRET;
const callbackUrl = process.env.WECOM_CALLBACK_URL;

export function isWeComConfigured() {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) return false;
  try {
    getWeComConfig();
    return true;
  } catch {
    return false;
  }
}

export function getWeComConfig() {
  if (!corpId || !agentId || !appSecret || !callbackUrl) {
    throw new Error(
      "企业微信登录尚未配置，请设置 WECOM_CORP_ID、WECOM_AGENT_ID、WECOM_APP_SECRET 和 WECOM_CALLBACK_URL。",
    );
  }

  const parsedCallbackUrl = new URL(callbackUrl);
  if (
    parsedCallbackUrl.protocol !== "https:" &&
    parsedCallbackUrl.hostname !== "localhost"
  ) {
    throw new Error("企业微信登录回调地址必须使用 HTTPS。");
  }

  if (
    parsedCallbackUrl.username ||
    parsedCallbackUrl.password ||
    parsedCallbackUrl.hash ||
    parsedCallbackUrl.pathname !== "/auth/wecom/callback"
  ) {
    throw new Error(
      "企业微信登录回调地址必须精确指向 /auth/wecom/callback。",
    );
  }

  return {
    corpId: corpId.trim(),
    agentId: agentId.trim(),
    appSecret: appSecret.trim(),
    callbackUrl: parsedCallbackUrl.toString(),
  };
}
