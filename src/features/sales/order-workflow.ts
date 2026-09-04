export type SalesOrderStatus =
  | "draft"
  | "pending_approval"
  | "confirmed"
  | "fulfilling"
  | "completed"
  | "cancelled";

const transitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  pending_approval: [],
  confirmed: ["cancelled"],
  fulfilling: [],
  completed: [],
  cancelled: [],
};

export function availableSalesOrderTransitions(status: SalesOrderStatus) {
  return transitions[status];
}

export function canTransitionSalesOrder(
  current: SalesOrderStatus,
  target: SalesOrderStatus,
) {
  return transitions[current].includes(target);
}
