const successStatuses = new Set([
  "accepted", "active", "approved", "completed", "confirmed", "matched", "paid", "posted", "published", "resolved", "success",
]);
const warningStatuses = new Set([
  "expiring", "partial", "pending", "pending_approval", "probation", "reviewed", "sent", "waiting", "waiting_human",
]);
const dangerStatuses = new Set([
  "cancelled", "departed", "error", "expired", "failed", "overdue", "rejected", "reversed", "void",
]);
const infoStatuses = new Set([
  "fulfilling", "human_active", "in_progress", "processing", "running",
]);

export function statusToneClass(status: string | null | undefined) {
  const normalized = status?.trim().toLowerCase() ?? "";
  if (successStatuses.has(normalized)) return "ui-status-success";
  if (warningStatuses.has(normalized)) return "ui-status-warning";
  if (dangerStatuses.has(normalized)) return "ui-status-danger";
  if (infoStatuses.has(normalized)) return "ui-status-info";
  return "bg-muted text-muted-foreground";
}
