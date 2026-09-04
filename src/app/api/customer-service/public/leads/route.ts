import { z } from "zod";
import { bearerToken, verifyCustomerSession } from "@/features/customer-service/public-session";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(50),
  phone: z.string().trim().regex(/^\+?[0-9\s-]{7,20}$/),
  company: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  businessType: z.enum(["catering", "gift", "distributor", "enterprise", "other"]).optional(),
  requestedProducts: z.string().trim().max(500).optional(),
  expectedVolume: z.string().trim().max(120).optional(),
  procurementTimeline: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  try {
    const session = await verifyCustomerSession(bearerToken(request));
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "请检查姓名、电话和需求信息" }, { status: 400 });
    const value = parsed.data;
    const normalizedPhone = value.phone.replace(/\D/g, "");
    const level = value.company && value.requestedProducts && value.procurementTimeline ? "A" : value.requestedProducts ? "B" : "C";
    const admin = createAdminClient();
    const { data: conversation } = await admin.from("customer_service_conversations").select("organization_id").eq("id", session.conversationId).single();
    if (!conversation) throw new Error("Conversation is unavailable");
    const leadValues = {
      organization_id: conversation.organization_id,
      workspace_id: session.workspaceId,
      conversation_id: session.conversationId,
      name: value.name,
      phone: value.phone,
      normalized_phone: normalizedPhone,
      company: value.company || null,
      city: value.city || null,
      business_type: value.businessType || null,
      requested_products: value.requestedProducts || null,
      expected_volume: value.expectedVolume || null,
      procurement_timeline: value.procurementTimeline || null,
      notes: value.notes || null,
      level,
      consent_at: new Date().toISOString(),
    };
    const { data: existingLead } = await admin.from("customer_service_leads").select("id").eq("conversation_id", session.conversationId).maybeSingle();
    const query = existingLead
      ? admin.from("customer_service_leads").update(leadValues).eq("id", existingLead.id)
      : admin.from("customer_service_leads").insert(leadValues);
    const { data, error } = await query.select("id, status, level").single();
    if (error || !data) throw error ?? new Error("Could not save lead");
    await admin.from("customer_service_lead_activities").insert({ lead_id: data.id, activity_type: "created", content: "客户通过官网客服提交联系信息" });
    return Response.json({ lead: data });
  } catch (error) {
    console.error("Customer service lead failed", error instanceof Error ? error.message : "unknown");
    return Response.json({ error: "留资未保存，请稍后重试" }, { status: 401 });
  }
}
