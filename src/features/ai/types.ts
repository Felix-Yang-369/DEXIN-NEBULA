export type AiSourceType =
  | "knowledge"
  | "product"
  | "inventory"
  | "customer"
  | "supplier"
  | "employee"
  | "announcement"
  | "document"
  | "approval"
  | "quote"
  | "finance";

export type AiSource = {
  id: string;
  type: AiSourceType;
  title: string;
  description: string;
  href: string;
  updatedAt?: string | null;
};

export type AiChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: AiSource[];
  createdAt?: string;
};

export type AiConversationSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

export type AiRetrievalAudit = {
  toolName: string;
  queryText: string;
  resultCount: number;
  sourceIds: string[];
  durationMs: number;
};
