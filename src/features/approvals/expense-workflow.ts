export const EXPENSE_CHAIRMAN_THRESHOLD = 5_000;

export type ExpenseApprovalStep = {
  code: "department_review" | "finance_review" | "chairman_approval";
  label: string;
};

export function buildExpenseApprovalRoute(
  amount: number,
): ExpenseApprovalStep[] {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("报销金额必须是大于 0 的有效数字");
  }

  const steps: ExpenseApprovalStep[] = [
    { code: "department_review", label: "直属负责人" },
    { code: "finance_review", label: "财务复核" },
  ];

  if (amount > EXPENSE_CHAIRMAN_THRESHOLD) {
    steps.push({ code: "chairman_approval", label: "董事长审批" });
  }

  return steps;
}
