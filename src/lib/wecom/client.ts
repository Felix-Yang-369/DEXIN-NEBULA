import "server-only";

import { getWeComConfig } from "./config";
import { createWeComQrConnectUrl } from "./oauth";

type WeComErrorResponse = {
  errcode?: number;
  errmsg?: string;
};

type WeComIdentityResponse = WeComErrorResponse & {
  UserId?: string;
};

export type WeComMember = WeComErrorResponse & {
  userid: string;
  name?: string;
  email?: string;
  biz_mail?: string;
  status?: number;
  enable?: number;
};

let tokenCache: { value: string; expiresAt: number } | null = null;

async function fetchWeCom<T>(url: URL): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`企业微信接口请求失败（HTTP ${response.status}）`);
  }

  return (await response.json()) as T;
}

function assertWeComSuccess(response: WeComErrorResponse) {
  if (response.errcode && response.errcode !== 0) {
    throw new Error(`企业微信接口错误 ${response.errcode}: ${response.errmsg ?? "unknown"}`);
  }
}

async function getAccessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.value;
  }

  const { corpId, appSecret } = getWeComConfig();
  const url = new URL("https://qyapi.weixin.qq.com/cgi-bin/gettoken");
  url.searchParams.set("corpid", corpId);
  url.searchParams.set("corpsecret", appSecret);

  const response = await fetchWeCom<
    WeComErrorResponse & { access_token?: string; expires_in?: number }
  >(url);
  assertWeComSuccess(response);

  if (!response.access_token) {
    throw new Error("企业微信未返回 access_token。");
  }

  tokenCache = {
    value: response.access_token,
    expiresAt: Date.now() + Math.max(60, response.expires_in ?? 7200) * 1000,
  };
  return tokenCache.value;
}

export function buildWeComQrLoginUrl(state: string) {
  const { corpId, agentId, callbackUrl } = getWeComConfig();
  return createWeComQrConnectUrl({
    corpId,
    agentId,
    callbackUrl,
    state,
  });
}

export async function getWeComMemberFromCode(code: string) {
  if (!/^[A-Za-z0-9_-]{4,512}$/.test(code)) {
    throw new Error("企业微信登录 code 无效。");
  }
  const accessToken = await getAccessToken();
  const identityUrl = new URL(
    "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo",
  );
  identityUrl.searchParams.set("access_token", accessToken);
  identityUrl.searchParams.set("code", code);

  const identity = await fetchWeCom<WeComIdentityResponse>(identityUrl);
  assertWeComSuccess(identity);
  if (!identity.UserId) {
    throw new Error("扫码账号不是当前企业应用可见范围内的成员。");
  }

  const memberUrl = new URL("https://qyapi.weixin.qq.com/cgi-bin/user/get");
  memberUrl.searchParams.set("access_token", accessToken);
  memberUrl.searchParams.set("userid", identity.UserId);
  const member = await fetchWeCom<WeComMember>(memberUrl);
  assertWeComSuccess(member);

  if (!member.userid || member.enable === 0 || member.status !== 1) {
    throw new Error("企业微信成员未激活或已被停用。");
  }

  return member;
}
