import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260812074336_miniprogram_auth_sessions.sql",
  import.meta.url,
);

test("小程序认证表启用 RLS 并撤销客户端权限", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /alter table public\.miniprogram_identities enable row level security/i);
  assert.match(sql, /alter table public\.miniprogram_sessions enable row level security/i);
  assert.match(sql, /revoke all on table public\.miniprogram_identities[\s\S]*from public, anon, authenticated/i);
  assert.match(sql, /revoke all on table public\.miniprogram_sessions[\s\S]*from public, anon, authenticated/i);
});

test("小程序会话表仅保存 SHA-256 格式哈希并支持撤销与过期", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  assert.match(sql, /token_hash text not null unique/i);
  assert.match(sql, /token_hash ~ '\^\[0-9a-f\]\{64\}\$'/i);
  assert.match(sql, /expires_at timestamptz not null/i);
  assert.match(sql, /revoked_at timestamptz/i);
  assert.doesNotMatch(sql, /\baccess_token\b/i);
});
