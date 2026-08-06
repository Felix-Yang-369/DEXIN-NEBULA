export const IMPORTANT_SEAL_TYPES = [
  "company",
  "contract",
  "finance",
  "legal_representative",
] as const;

export type SealType =
  | (typeof IMPORTANT_SEAL_TYPES)[number]
  | "other";

export type SealApprovalStep = {
  code: "department_review" | "chairman_approval" | "seal_custodian";
  label: string;
};

export function requiresChairmanApproval(
  sealType: SealType,
  isExternal: boolean,
) {
  return IMPORTANT_SEAL_TYPES.includes(
    sealType as (typeof IMPORTANT_SEAL_TYPES)[number],
  ) || isExternal;
}

export function buildSealApprovalRoute(
  sealType: SealType,
  isExternal: boolean,
): SealApprovalStep[] {
  const steps: SealApprovalStep[] = [
    { code: "department_review", label: "直属负责人" },
  ];

  if (requiresChairmanApproval(sealType, isExternal)) {
    steps.push({ code: "chairman_approval", label: "董事长审批" });
  }

  steps.push({ code: "seal_custodian", label: "行政用印登记" });
  return steps;
}
