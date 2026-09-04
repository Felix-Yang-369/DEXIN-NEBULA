import { bearerToken, verifyCustomerSession } from "@/features/customer-service/public-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const session = await verifyCustomerSession(bearerToken(request));
    const lastSequence = Number(new URL(request.url).searchParams.get("after") ?? "0") || 0;
    const admin = createAdminClient();
    const encoder = new TextEncoder();
    let cursor = lastSequence;
    let cancelled = false;
    const stream = new ReadableStream({
      async start(controller) {
        request.signal.addEventListener("abort", () => { cancelled = true; });
        controller.enqueue(encoder.encode("retry: 2000\n\n"));
        for (let index = 0; index < 25 && !cancelled; index += 1) {
          const [{ data: messages }, { data: conversation }] = await Promise.all([
            admin.from("customer_service_messages").select("id, sequence_no, sender_type, content, source_refs, needs_human, created_at").eq("conversation_id", session.conversationId).gt("sequence_no", cursor).order("sequence_no").limit(50),
            admin.from("customer_service_conversations").select("status, assigned_employee_id").eq("id", session.conversationId).single(),
          ]);
          for (const message of messages ?? []) {
            cursor = Math.max(cursor, Number(message.sequence_no));
            controller.enqueue(encoder.encode(`id: ${cursor}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`));
          }
          controller.enqueue(encoder.encode(`event: status\ndata: ${JSON.stringify(conversation)}\n\n`));
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
        if (!cancelled) controller.close();
      },
      cancel() { cancelled = true; },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store, no-transform", Connection: "keep-alive", "X-Accel-Buffering": "no" } });
  } catch {
    return Response.json({ error: "客服实时连接已失效" }, { status: 401 });
  }
}
