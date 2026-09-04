import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("客服数据默认不向公开角色暴露并启用 RLS", async () => {
  const migration = await read("supabase/migrations/20260831153631_customer_service_v2.sql");
  assert.match(migration, /alter table public\.customer_service_conversations enable row level security/);
  assert.match(migration, /alter table public\.customer_service_session_tokens enable row level security/);
  assert.match(migration, /revoke all on table public\.customer_service_workspaces[\s\S]*from public,anon,authenticated/);
  assert.doesNotMatch(migration, /grant .* to anon/);
});

test("首位人工回复通过行锁原子认领会话", async () => {
  const migration = await read("supabase/migrations/20260831153631_customer_service_v2.sql");
  assert.match(migration, /customer_service_reply/);
  assert.match(migration, /for update/);
  assert.match(migration, /v_assigned is not null and v_assigned<>v_actor/);
  assert.match(migration, /assigned_employee_id=v_actor,status='human_active'/);
});

test("CRM 转换具备权限校验、手机号去重和幂等返回", async () => {
  const migration = await read("supabase/migrations/20260831153631_customer_service_v2.sql");
  assert.match(migration, /has_access_permission\('customer_service\.lead\.convert'\)/);
  assert.match(migration, /regexp_replace\(coalesce\(contact\.phone,''\)[\s\S]*v_lead\.normalized_phone/);
  assert.match(migration, /if v_lead\.converted_customer_id is not null then return v_lead\.converted_customer_id/);
});

test("公开客服使用独立知识表且不复用内部 AI 检索", async () => {
  const publicAi = await read("src/features/customer-service/public-ai.ts");
  const publicChat = await read("src/app/api/customer-service/public/chat/route.ts");
  assert.match(publicAi, /customer_service_knowledge_items/);
  assert.match(publicAi, /eq\("status", "published"\)/);
  assert.doesNotMatch(publicAi, /retrieveAiContext|businessTool|ai_conversations/);
  assert.match(publicChat, /customer_service_messages/);
});

test("客服令牌绑定工作空间、访客、会话和来源网站", async () => {
  const session = await read("src/features/customer-service/public-session.ts");
  assert.match(session, /workspaceId: string/);
  assert.match(session, /visitorId: string/);
  assert.match(session, /conversationId: string/);
  assert.match(session, /origin: string/);
  assert.match(session, /timingSafeEqual/);
  assert.match(session, /token_hash/);
});
