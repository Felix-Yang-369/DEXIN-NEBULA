import "server-only";

import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;

type SessionPayload = {
  version: 1;
  workspaceId: string;
  visitorId: string;
  conversationId: string;
  origin: string;
  expiresAt: number;
  nonce: string;
};

export type VerifiedCustomerSession = SessionPayload & {
  tokenHash: string;
};

function tokenSecret() {
  const value = process.env.CUSTOMER_SERVICE_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new Error("CUSTOMER_SERVICE_TOKEN_SECRET must contain at least 32 characters");
  }
  return value;
}

export function normalizeOrigin(value: string) {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error("Invalid website origin");
  }
  return url.origin;
}

export function hashCustomerToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function signPayload(encoded: string) {
  return createHmac("sha256", tokenSecret()).update(encoded).digest("base64url");
}

function encodeSession(payload: SessionPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${signPayload(encoded)}`;
}

function decodeSession(token: string): SessionPayload {
  const [encoded, suppliedSignature, extra] = token.split(".");
  if (!encoded || !suppliedSignature || extra) throw new Error("Invalid customer session");
  const expectedSignature = signPayload(encoded);
  const left = Buffer.from(suppliedSignature);
  const right = Buffer.from(expectedSignature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw new Error("Invalid customer session");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
  if (payload.version !== 1 || payload.expiresAt <= Math.floor(Date.now() / 1000)) throw new Error("Expired customer session");
  return payload;
}

export async function verifyCustomerSession(token: string, expectedOrigin?: string) {
  const payload = decodeSession(token);
  if (expectedOrigin && payload.origin !== normalizeOrigin(expectedOrigin)) throw new Error("Customer session origin mismatch");
  const tokenHash = hashCustomerToken(token);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("customer_service_session_tokens")
    .select("id")
    .eq("token_hash", tokenHash)
    .eq("workspace_id", payload.workspaceId)
    .eq("visitor_id", payload.visitorId)
    .eq("conversation_id", payload.conversationId)
    .eq("origin", payload.origin)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) throw new Error("Customer session is no longer valid");
  void admin.from("customer_service_session_tokens").update({ last_used_at: new Date().toISOString() }).eq("token_hash", tokenHash);
  return { ...payload, tokenHash } satisfies VerifiedCustomerSession;
}

export async function createCustomerSession(input: {
  workspaceCode: string;
  origin: string;
  pageUrl?: string;
  userAgent?: string;
}) {
  const admin = createAdminClient();
  const origin = normalizeOrigin(input.origin);
  const { data: workspace, error: workspaceError } = await admin
    .from("customer_service_workspaces")
    .select("id, organization_id, code, name, assistant_name, assistant_avatar_url, allowed_origins, theme, welcome_message, quick_questions, business_hours")
    .eq("code", input.workspaceCode)
    .eq("status", "active")
    .maybeSingle();
  if (workspaceError || !workspace || !(workspace.allowed_origins as string[]).includes(origin)) throw new Error("Website is not allowed to use this assistant");

  const publicVisitorId = randomUUID();
  const publicIdHash = createHash("sha256").update(`${workspace.id}:${publicVisitorId}:${tokenSecret()}`).digest("hex");
  const { data: visitor, error: visitorError } = await admin
    .from("customer_service_visitors")
    .insert({
      workspace_id: workspace.id,
      public_id_hash: publicIdHash,
      first_page_url: input.pageUrl?.slice(0, 1000) || null,
      last_page_url: input.pageUrl?.slice(0, 1000) || null,
      user_agent_family: input.userAgent?.slice(0, 200) || null,
    })
    .select("id")
    .single();
  if (visitorError || !visitor) throw new Error("Could not create visitor session");

  const { data: conversation, error: conversationError } = await admin
    .from("customer_service_conversations")
    .insert({
      organization_id: workspace.organization_id,
      workspace_id: workspace.id,
      visitor_id: visitor.id,
      source_page_url: input.pageUrl?.slice(0, 1000) || null,
    })
    .select("id, status")
    .single();
  if (conversationError || !conversation) throw new Error("Could not create customer conversation");

  const payload: SessionPayload = {
    version: 1,
    workspaceId: workspace.id,
    visitorId: visitor.id,
    conversationId: conversation.id,
    origin,
    expiresAt: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    nonce: randomBytes(12).toString("base64url"),
  };
  const token = encodeSession(payload);
  const { error: tokenError } = await admin.from("customer_service_session_tokens").insert({
    workspace_id: workspace.id,
    visitor_id: visitor.id,
    conversation_id: conversation.id,
    token_hash: hashCustomerToken(token),
    origin,
    expires_at: new Date(payload.expiresAt * 1000).toISOString(),
  });
  if (tokenError) throw new Error("Could not secure customer session");

  return { token, conversation, workspace };
}

export async function sessionSnapshot(session: VerifiedCustomerSession) {
  const admin = createAdminClient();
  const [{ data: workspace }, { data: conversation }, { data: messages }, { data: lead }] = await Promise.all([
    admin.from("customer_service_workspaces").select("id, code, name, assistant_name, assistant_avatar_url, theme, welcome_message, quick_questions, business_hours").eq("id", session.workspaceId).single(),
    admin.from("customer_service_conversations").select("id, status, assigned_employee_id, last_message_at").eq("id", session.conversationId).single(),
    admin.from("customer_service_messages").select("id, sequence_no, sender_type, content, source_refs, needs_human, created_at").eq("conversation_id", session.conversationId).order("sequence_no").limit(100),
    admin.from("customer_service_leads").select("id, status").eq("conversation_id", session.conversationId).maybeSingle(),
  ]);
  if (!workspace || !conversation) throw new Error("Customer conversation is unavailable");
  return { workspace, conversation, messages: messages ?? [], hasLead: Boolean(lead) };
}

export function bearerToken(request: Request) {
  const value = request.headers.get("authorization") ?? "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}
