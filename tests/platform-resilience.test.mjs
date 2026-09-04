import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [nextConfig, appError, globalError, notFound, serverLog] = await Promise.all([
  readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/error.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/global-error.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/app/not-found.tsx", import.meta.url), "utf8"),
  readFile(
    new URL("../src/lib/observability/server-log.ts", import.meta.url),
    "utf8",
  ),
]);

test("开发来源和 Supabase 图片域名由环境配置", () => {
  assert.match(nextConfig, /NEXT_ALLOWED_DEV_ORIGINS/);
  assert.match(nextConfig, /NEXT_PUBLIC_SUPABASE_URL/);
  assert.match(nextConfig, /maximumRedirects:\s*0/);
  assert.doesNotMatch(nextConfig, /192\.168\./);
  assert.doesNotMatch(nextConfig, /yzedobnkuyqhthyitmwn/);
});

test("应用具有路由、根布局和 404 兜底页", () => {
  assert.match(appError, /^"use client";/);
  assert.match(globalError, /^"use client";/);
  assert.match(globalError, /<html lang="zh-CN">/);
  assert.match(globalError, /<body>/);
  assert.match(notFound, /没有找到这个页面/);
});

test("结构化日志拒绝敏感字段并限制字符串长度", () => {
  assert.match(serverLog, /authorization\|cookie\|password\|secret\|token/);
  assert.match(serverLog, /content\|prompt\|message\|query\|queryText/);
  assert.match(serverLog, /slice\(0, 240\)/);
  assert.match(serverLog, /JSON\.stringify/);
});
