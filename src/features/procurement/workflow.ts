export type PurchaseRequestStatus =
  | "submitted"
  | "approved"
  | "rejected"
  | "converted"
  | "cancelled";

export type PurchaseOrderStatus =
  | "draft"
  | "confirmed"
  | "partial_received"
  | "received"
  | "cancelled";

const requestTransitions: Record<PurchaseRequestStatus, PurchaseRequestStatus[]> = {
  submitted: ["approved", "rejected", "cancelled"],
  approved: ["converted"],
  rejected: [],
  converted: [],
  cancelled: [],
};

const orderTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ["confirmed", "cancelled"],
  confirmed: ["partial_received", "received", "cancelled"],
  partial_received: ["partial_received", "received"],
  received: [],
  cancelled: [],
};

export function canTransitionPurchaseRequest(
  current: PurchaseRequestStatus,
  target: PurchaseRequestStatus,
) {
  return requestTransitions[current].includes(target);
}

export function canTransitionPurchaseOrder(
  current: PurchaseOrderStatus,
  target: PurchaseOrderStatus,
) {
  return orderTransitions[current].includes(target);
}

export function purchaseOrderOutstanding(
  quantity: number,
  receivedQuantity: number,
) {
  return Math.max(0, quantity - receivedQuantity);
}
