"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

async function requirePermission(code: string) {
  await requireCurrentEmployee();
  const supabase = await createClient();
  const { data } = await supabase.rpc("has_access_permission", { p_permission_code: code });
  if (data !== true) redirect("/customer-service?error=forbidden");
  return supabase;
}

function finish(target: string, result: { error?: { code?: string } | null }) {
  revalidatePath("/customer-service"); revalidatePath("/notifications"); revalidatePath("/customers");
  redirect(`/customer-service?${result.error ? "error=operation_failed" : "saved=1"}${target}`);
}

export async function replyCustomerConversationAction(formData: FormData) {
  const parsed = z.object({ conversationId: z.uuid(), content: z.string().trim().min(1).max(3000) }).safeParse({ conversationId: formData.get("conversationId"), content: formData.get("content") });
  if (!parsed.success) redirect("/customer-service?error=invalid_message");
  const supabase = await requirePermission("customer_service.conversation.reply");
  const { error } = await supabase.rpc("customer_service_reply", { p_conversation_id: parsed.data.conversationId, p_content: parsed.data.content });
  finish(`&tab=conversations&conversation=${parsed.data.conversationId}`, { error });
}

export async function transferCustomerConversationAction(formData: FormData) {
  const parsed = z.object({ conversationId: z.uuid(), employeeId: z.string() }).safeParse({ conversationId: formData.get("conversationId"), employeeId: formData.get("employeeId") ?? "" });
  if (!parsed.success || (parsed.data.employeeId && !z.uuid().safeParse(parsed.data.employeeId).success)) redirect("/customer-service?error=invalid_transfer");
  const supabase = await requirePermission("customer_service.conversation.transfer");
  const { error } = await supabase.rpc("customer_service_transfer", { p_conversation_id: parsed.data.conversationId, p_employee_id: parsed.data.employeeId || null });
  finish(`&tab=conversations&conversation=${parsed.data.conversationId}`, { error });
}

export async function closeCustomerConversationAction(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("conversationId"));
  if (!id.success) redirect("/customer-service?error=invalid_conversation");
  const supabase = await requirePermission("customer_service.conversation.reply");
  const { error } = await supabase.rpc("customer_service_close", { p_conversation_id: id.data });
  finish("&tab=conversations", { error });
}

export async function updateCustomerServiceLeadAction(formData: FormData) {
  const parsed = z.object({ leadId: z.uuid(), status: z.enum(["new", "following", "qualified", "closed"]), note: z.string().trim().max(1000) }).safeParse({ leadId: formData.get("leadId"), status: formData.get("status"), note: formData.get("note") ?? "" });
  if (!parsed.success) redirect("/customer-service?error=invalid_lead&tab=leads");
  const supabase = await requirePermission("customer_service.lead.manage");
  const { error } = await supabase.rpc("customer_service_update_lead", { p_lead_id: parsed.data.leadId, p_status: parsed.data.status, p_note: parsed.data.note });
  finish("&tab=leads", { error });
}

export async function convertCustomerServiceLeadAction(formData: FormData) {
  const id = z.uuid().safeParse(formData.get("leadId"));
  if (!id.success) redirect("/customer-service?error=invalid_lead&tab=leads");
  const supabase = await requirePermission("customer_service.lead.convert");
  const { error } = await supabase.rpc("convert_customer_service_lead", { p_lead_id: id.data });
  finish("&tab=leads", { error });
}

export async function saveCustomerServiceKnowledgeAction(formData: FormData) {
  const parsed = z.object({ workspaceId: z.uuid(), itemId: z.union([z.literal(""), z.uuid()]), title: z.string().trim().min(2).max(120), content: z.string().trim().min(10).max(6000), sourceUrl: z.union([z.literal(""), z.url()]), keywords: z.string().max(500), status: z.enum(["draft", "published", "inactive"]) }).safeParse({ workspaceId: formData.get("workspaceId"), itemId: formData.get("itemId") ?? "", title: formData.get("title"), content: formData.get("content"), sourceUrl: formData.get("sourceUrl") ?? "", keywords: formData.get("keywords") ?? "", status: formData.get("status") });
  if (!parsed.success) redirect("/customer-service?error=invalid_knowledge&tab=knowledge");
  const supabase = await requirePermission("customer_service.knowledge.publish");
  const { error } = await supabase.rpc("customer_service_save_knowledge", { p_workspace_id: parsed.data.workspaceId, p_item_id: parsed.data.itemId || null, p_title: parsed.data.title, p_content: parsed.data.content, p_source_url: parsed.data.sourceUrl || null, p_keywords: parsed.data.keywords.split(/[，,]/).map((item) => item.trim()).filter(Boolean), p_status: parsed.data.status });
  finish("&tab=knowledge", { error });
}

export async function updateCustomerServiceWorkspaceAction(formData: FormData) {
  const parsed = z.object({ workspaceId: z.uuid(), assistantName: z.string().trim().min(2).max(30), welcomeMessage: z.string().trim().min(10).max(500), quickQuestions: z.string().min(2).max(1000), start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) }).safeParse({ workspaceId: formData.get("workspaceId"), assistantName: formData.get("assistantName"), welcomeMessage: formData.get("welcomeMessage"), quickQuestions: formData.get("quickQuestions"), start: formData.get("start"), end: formData.get("end") });
  if (!parsed.success) redirect("/customer-service?error=invalid_settings&tab=settings");
  const supabase = await requirePermission("customer_service.settings.manage");
  const { error } = await supabase.rpc("customer_service_update_workspace", { p_workspace_id: parsed.data.workspaceId, p_assistant_name: parsed.data.assistantName, p_welcome_message: parsed.data.welcomeMessage, p_quick_questions: parsed.data.quickQuestions.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 8), p_business_hours: { timezone: "Asia/Shanghai", weekdays: [1,2,3,4,5], start: parsed.data.start, end: parsed.data.end }, p_wecom_enabled: formData.get("wecomEnabled") === "on" });
  finish("&tab=settings", { error });
}
