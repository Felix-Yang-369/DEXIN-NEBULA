import type { Metadata } from "next";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { AiChatWorkspace } from "@/features/ai/ai-chat-workspace";
import type {
  AiChatMessage,
  AiConversationSummary,
  AiSource,
} from "@/features/ai/types";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "德小馨 AI",
  description: "德馨星云企业 AI 助手能力入口",
};

export const dynamic = "force-dynamic";

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    hr: "人事行政",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "普通员工",
  };
  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

function safeSources(value: unknown): AiSource[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is AiSource =>
      Boolean(
        item &&
          typeof item === "object" &&
          "id" in item &&
          "type" in item &&
          "title" in item &&
          "href" in item,
      ),
  );
}

export default async function AiPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const requestedConversationId = /^[0-9a-f-]{36}$/i.test(
    params.conversation ?? "",
  )
    ? params.conversation!
    : null;
  const supabase = await createClient();
  const { data: conversationRows } = await supabase
    .from("ai_conversations")
    .select("id, title, updated_at")
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);
  const conversations: AiConversationSummary[] = (conversationRows ?? []).map(
    (conversation) => ({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updated_at,
    }),
  );
  const selectedConversation = requestedConversationId
    ? conversations.find(
        (conversation) => conversation.id === requestedConversationId,
      )
    : null;
  const { data: messageRows } = selectedConversation
    ? await supabase
        .from("ai_messages")
        .select("id, role, content, sources, created_at")
        .eq("conversation_id", selectedConversation.id)
        .order("created_at")
        .limit(100)
    : { data: [] };
  const initialMessages: AiChatMessage[] = (messageRows ?? []).map(
    (message) => ({
      id: message.id,
      role: message.role as "user" | "assistant",
      content: message.content,
      sources: safeSources(message.sources),
      createdAt: message.created_at,
    }),
  );

  return (
    <WorkflowShell
      activeItem="德小馨 AI"
      breadcrumb="德小馨 AI / 智能入口"
      currentUser={{
        name: employee.name,
        roleLabel: roleLabel(employee.roleCodes) || "德馨淼盛员工",
      }}
    >
      <AiChatWorkspace
        configured={Boolean(process.env.DEEPSEEK_API_KEY?.trim())}
        conversations={conversations}
        employeeName={employee.name}
        initialConversationId={selectedConversation?.id ?? null}
        initialMessages={initialMessages}
      />
    </WorkflowShell>
  );
}
