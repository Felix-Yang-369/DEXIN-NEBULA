export type BusinessToolName = "finance.receivables.summary" | "inventory.availability" | "sales.order.trace" | "sales.order.draft.plan" | "finance.journal.draft.plan";

function inventoryKeyword(message: string) {
  const code = message.normalize("NFKC").match(/\bdx-[a-z0-9_-]+\b/i)?.[0];
  if (code) return code.toLowerCase();
  return message
    .replace(/(库存|可用量|缺货|余量|仓库|还有|多少|查询|查看|请问|帮我|的)/g, " ")
    .trim()
    .slice(0, 80);
}

export function planReadOnlyBusinessTools(message: string) {
  const plans: Array<{ tool: BusinessToolName; input: Record<string, string> }> = [];
  if (/(应收|回款|账龄|欠款|逾期)/.test(message)) {
    plans.push({ tool: "finance.receivables.summary", input: {} });
  }
  if (/(库存|可用量|缺货|余量|仓库)/.test(message)) {
    const keyword = inventoryKeyword(message);
    if (keyword) plans.push({ tool: "inventory.availability", input: { keyword } });
  }
  const orderId = message.match(/\b[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\b/i)?.[0];
  if (orderId && /(订单|出库|履约|销售)/.test(message)) {
    plans.push({ tool: "sales.order.trace", input: { orderId } });
  }
  return plans;
}
