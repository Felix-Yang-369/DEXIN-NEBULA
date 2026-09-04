import { bearerToken, verifyCustomerSession } from "@/features/customer-service/public-session";
import { notifyCustomerServiceHandoff } from "@/features/customer-service/wecom-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const session = await verifyCustomerSession(bearerToken(request));
    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: conversation, error } = await admin.from("customer_service_conversations").update({ status: "waiting_human", requested_human_at: now, last_message_at: now }).eq("id", session.conversationId).neq("status", "closed").select("id, organization_id, assigned_employee_id, subject").single();
    if (error || !conversation) throw error ?? new Error("Conversation is unavailable");
    await admin.from("customer_service_messages").insert({ conversation_id: session.conversationId, sender_type: "system", content: "客户申请转接人工客服" });
    void notifyCustomerServiceHandoff(conversation).catch((notifyError) => console.error("Customer service notification failed", notifyError instanceof Error ? notifyError.message : "unknown"));
    return Response.json({ status: "waiting_human" });
  } catch {
    return Response.json({ error: "暂时无法申请人工客服，请稍后重试" }, { status: 401 });
  }
}
