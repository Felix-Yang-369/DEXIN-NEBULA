export type SalesOrderStatus =
  | "draft"
  | "confirmed"
  | "fulfilling"
  | "completed"
  | "cancelled";

const transitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
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
