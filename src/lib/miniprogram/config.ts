import "server-only";

type MiniprogramConfig = {
  appId: string;
  appSecret: string;
  sessionTtlHours: number;
};

function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export function getMiniprogramConfig(): MiniprogramConfig {
  const ttl = Number(process.env.WECHAT_MINIPROGRAM_SESSION_TTL_HOURS ?? "12");
  if (!Number.isFinite(ttl) || ttl < 1 || ttl > 168) {
    throw new Error("WECHAT_MINIPROGRAM_SESSION_TTL_HOURS must be 1-168");
  }

  return {
    appId: required("WECHAT_MINIPROGRAM_APP_ID"),
    appSecret: required("WECHAT_MINIPROGRAM_APP_SECRET"),
    sessionTtlHours: ttl,
  };
}

export function isMiniprogramConfigured() {
  return Boolean(
    process.env.WECHAT_MINIPROGRAM_APP_ID?.trim()
      && process.env.WECHAT_MINIPROGRAM_APP_SECRET?.trim(),
  );
}
