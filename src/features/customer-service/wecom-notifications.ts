import "server-only";

import { isWeComConfigured } from "@/lib/wecom/config";
import { sendWeComTextMessage } from "@/lib/wecom/client";
import { createAdminClient } from "@/lib/supabase/admin";

type ConversationForNotification = {
  id: string;
  organization_id: string;
  assigned_employee_id: string | null;
  subject: string | null;
};

export async function notifyCustomerServiceHandoff(conversation: ConversationForNotification) {
  const admin = createAdminClient();
  let employeeIds: string[] = conversation.assigned_employee_id ? [conversation.assigned_employee_id] : [];

  if (employeeIds.length === 0) {
    const [{ data: customAssignments }, { data: legacyAssignments }, { data: serviceEmployees }] = await Promise.all([
      admin.from("employee_access_roles").select("employee_id, access_roles!inner(organization_id, access_role_permissions!inner(access_permissions!inner(code)))").eq("organization_id", conversation.organization_id).eq("access_roles.access_role_permissions.access_permissions.code", "customer_service.conversation.reply"),
      admin.from("employee_roles").select("employee_id, roles!inner(code, organization_id)").eq("roles.organization_id", conversation.organization_id).in("roles.code", ["admin", "chairman"]),
      admin.from("employees").select("id, departments!inner(code)").eq("organization_id", conversation.organization_id).eq("status", "active").eq("departments.code", "DX-CS"),
    ]);
    employeeIds = [...new Set([
      ...(customAssignments ?? []).map((row) => row.employee_id),
      ...(legacyAssignments ?? []).map((row) => row.employee_id),
      ...(serviceEmployees ?? []).map((row) => row.id),
    ])];
  }
  if (employeeIds.length === 0) return;

  const title = "官网客户申请人工客服";
  const body = conversation.subject ? `客户咨询：${conversation.subject.slice(0, 80)}` : "客户正在等待人工接待，请尽快处理。";
  await admin.from("notifications").insert(employeeIds.map((employeeId) => ({
    organization_id: conversation.organization_id,
    recipient_employee_id: employeeId,
    notification_type: "customer_service",
    title,
    body,
    href: `/customer-service?conversation=${conversation.id}`,
    entity_type: "customer_service_conversation",
    entity_id: conversation.id,
  })));
  await admin.from("customer_service_notification_deliveries").insert(employeeIds.map((employeeId) => ({ conversation_id: conversation.id, recipient_employee_id: employeeId, channel: "in_app", status: "sent" })));

  if (!isWeComConfigured()) {
    await admin.from("customer_service_notification_deliveries").insert(employeeIds.map((employeeId) => ({ conversation_id: conversation.id, recipient_employee_id: employeeId, channel: "wecom", status: "skipped", error_code: "NOT_CONFIGURED" })));
    return;
  }
  const { data: identities } = await admin.from("employee_auth_identities").select("employee_id, provider_subject").eq("provider", "wecom").in("employee_id", employeeIds);
  const wecomIds = (identities ?? []).map((item) => item.provider_subject);
  try {
    await sendWeComTextMessage(wecomIds, `${title}\n${body}\n请登录德馨星云客服中心处理。`);
    await admin.from("customer_service_notification_deliveries").insert((identities ?? []).map((identity) => ({ conversation_id: conversation.id, recipient_employee_id: identity.employee_id, channel: "wecom", status: "sent" })));
  } catch (error) {
    await admin.from("customer_service_notification_deliveries").insert((identities ?? []).map((identity) => ({ conversation_id: conversation.id, recipient_employee_id: identity.employee_id, channel: "wecom", status: "failed", error_code: error instanceof Error ? error.message.slice(0, 120) : "UNKNOWN" })));
  }
}
