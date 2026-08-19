export type CashDocumentType = "receipt" | "payment";
export type CashDocumentStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "completed"
  | "void";
export type CashDocumentAction =
  | "submit"
  | "approve"
  | "reject"
  | "complete"
  | "void";
export type CashDocumentReversalStatus = "pending" | "reversed" | null;
export type CashDocumentReversalAction = "request" | "approve" | "reject";

export function cashDocumentActions({
  type,
  status,
  roleCodes,
}: {
  type: CashDocumentType;
  status: CashDocumentStatus;
  roleCodes: string[];
}): CashDocumentAction[] {
  const finance = roleCodes.includes("finance");
  const chairman = roleCodes.includes("chairman");

  if (status === "completed" || status === "void") return [];
  if (status === "draft") return finance ? ["submit", "void"] : [];
  if (status === "submitted" && type === "receipt") {
    return finance ? ["complete"] : chairman ? ["void"] : [];
  }
  if (status === "submitted" && type === "payment") {
    return chairman ? ["approve", "reject", "void"] : [];
  }
  if (status === "approved" && type === "payment") {
    return finance ? ["complete"] : chairman ? ["void"] : [];
  }
  return [];
}

export function cashDocumentReversalActions({
  status,
  reversalStatus,
  roleCodes,
}: {
  status: CashDocumentStatus;
  reversalStatus: CashDocumentReversalStatus;
  roleCodes: string[];
}): CashDocumentReversalAction[] {
  if (status !== "completed" || reversalStatus === "reversed") return [];
  if (reversalStatus === "pending") {
    return roleCodes.includes("chairman") ? ["approve", "reject"] : [];
  }
  return roleCodes.includes("finance") ? ["request"] : [];
}

export function nextCashDocumentStatus(
  type: CashDocumentType,
  status: CashDocumentStatus,
  action: CashDocumentAction,
): CashDocumentStatus | null {
  if (status === "draft" && action === "submit") return "submitted";
  if (status === "draft" && action === "void") return "void";
  if (type === "receipt" && status === "submitted" && action === "complete") {
    return "completed";
  }
  if (type === "payment" && status === "submitted" && action === "approve") {
    return "approved";
  }
  if (type === "payment" && status === "submitted" && action === "reject") {
    return "draft";
  }
  if (type === "payment" && status === "approved" && action === "complete") {
    return "completed";
  }
  if (["submitted", "approved"].includes(status) && action === "void") {
    return "void";
  }
  return null;
}
