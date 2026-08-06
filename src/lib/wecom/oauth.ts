import { timingSafeEqual } from "node:crypto";

export function safeWeComReturnPath(value: string | null | undefined) {
  return value?.startsWith("/") && !value.startsWith("//")
    ? value
    : "/dashboard";
}

export function weComStateMatches(
  actual: string | null | undefined,
  expected: string | null | undefined,
) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

export function normalizedWeComEmails(
  values: Array<string | null | undefined>,
) {
  return [
    ...new Set(
      values
        .map((value) => value?.trim().toLowerCase() ?? "")
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
    ),
  ];
}

export function createWeComQrConnectUrl({
  corpId,
  agentId,
  callbackUrl,
  state,
}: {
  corpId: string;
  agentId: string;
  callbackUrl: string;
  state: string;
}) {
  const url = new URL("https://login.work.weixin.qq.com/wwlogin/sso/login");
  url.searchParams.set("login_type", "CorpApp");
  url.searchParams.set("appid", corpId);
  url.searchParams.set("agentid", agentId);
  url.searchParams.set("redirect_uri", callbackUrl);
  url.searchParams.set("state", state);
  url.searchParams.set("lang", "zh");
  return url;
}
