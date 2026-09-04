import { z } from "zod";
import { answerPublicQuestion } from "@/features/customer-service/public-ai";
import { bearerToken, verifyCustomerSession } from "@/features/customer-service/public-session";
import { notifyCustomerServiceHandoff } from "@/features/customer-service/wecom-notifications";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({ message: z.string().trim().min(1).max(1000) });

function streamAnswer(payload: { messageId: string; answer: string; sources: unknown[]; needsHuman: boolean; sequenceNo: number }) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "meta", messageId: payload.messageId })}\n`));
      for (const chunk of payload.answer.match(/[\s\S]{1,12}/g) ?? []) {
        controller.enqueue(encoder.encode(`${JSON.stringify({ type: "delta", delta: chunk })}\n`));
        await new Promise((resolve) => setTimeout(resolve, 18));
      }
      controller.enqueue(encoder.encode(`${JSON.stringify({ type: "done", sources: payload.sources, needsHuman: payload.needsHuman, sequenceNo: payload.sequenceNo })}\n`));
      controller.close();
    },
  });
}

export async function POST(request: Request) {
  try {
    const token = bearerToken(request);
    const session = await verifyCustomerSession(token);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "请输入 1 至 1000 个字符的问题" }, { status: 400 });
    const admin = createAdminClient();
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const [{ count }, { data: conversationBefore }] = await Promise.all([
      admin.from("customer_service_messages").select("id", { count: "exact", head: true }).eq("conversation_id", session.conversationId).eq("sender_type", "visitor").gte("created_at", oneMinuteAgo),
      admin.from("customer_service_conversations").select("id, organization_id, assigned_employee_id, subject, status").eq("id", session.conversationId).single(),
    ]);
    if ((count ?? 0) >= 10) return Response.json({ error: "发送频率过快，请稍后再试" }, { status: 429 });

    const now = new Date().toISOString();
    const { error: visitorError } = await admin.from("customer_service_messages").insert({ conversation_id: session.conversationId, sender_type: "visitor", content: parsed.data.message });
    if (visitorError) throw visitorError;
    await admin.from("customer_service_conversations").update({ last_message_at: now, last_visitor_message_at: now, subject: parsed.data.message.slice(0, 60) }).eq("id", session.conversationId);

    let result;
    try {
      result = await answerPublicQuestion(session, parsed.data.message);
    } catch (error) {
      console.error("Public customer AI failed", error instanceof Error ? error.message : "unknown");
      result = { answer: "德小馨暂时无法完成回答。我已经保留你的问题，你可以申请人工客服或先留下联系方式。", sources: [], needsHuman: true, confidence: 0.1, model: "fallback" };
    }
    const { data: assistantMessage, error: assistantError } = await admin.from("customer_service_messages").insert({
      conversation_id: session.conversationId,
      sender_type: "assistant",
      content: result.answer,
      source_refs: result.sources,
      needs_human: result.needsHuman,
      confidence: result.confidence,
      model: result.model,
    }).select("id, sequence_no").single();
    if (assistantError || !assistantMessage) throw assistantError ?? new Error("Could not save assistant response");
    if (result.needsHuman) {
      await Promise.all([
        admin.from("customer_service_conversations").update({ status: "waiting_human", requested_human_at: now, last_message_at: now }).eq("id", session.conversationId),
        admin.from("customer_service_unanswered_questions").insert({ workspace_id: session.workspaceId, conversation_id: session.conversationId, message_id: assistantMessage.id, question: parsed.data.message, reason: "low_confidence" }),
      ]);
      if (conversationBefore && !["waiting_human", "human_active"].includes(conversationBefore.status)) {
        void notifyCustomerServiceHandoff({ ...conversationBefore, subject: parsed.data.message.slice(0, 80) }).catch((notifyError) => console.error("Customer service notification failed", notifyError instanceof Error ? notifyError.message : "unknown"));
      }
    } else {
      await admin.from("customer_service_conversations").update({ last_message_at: now }).eq("id", session.conversationId);
    }
    return new Response(streamAnswer({ messageId: assistantMessage.id, answer: result.answer, sources: result.sources, needsHuman: result.needsHuman, sequenceNo: Number(assistantMessage.sequence_no) }), {
      headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no" },
    });
  } catch (error) {
    console.error("Customer service chat failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "会话已失效或服务暂时不可用，请刷新后重试" }, { status: 401 });
  }
}
