export const assignableRoleCodes = [
  "employee",
  "department_lead",
  "hr",
  "finance",
  "admin",
  "chairman",
] as const;

export type AssignableRoleCode = (typeof assignableRoleCodes)[number];

export function normalizeEmployeeRoleCodes(
  roleCodes: readonly AssignableRoleCode[],
) {
  const selected = new Set<AssignableRoleCode>(roleCodes);
  selected.add("employee");

  if (selected.has("chairman")) {
    return [...assignableRoleCodes];
  }

  return assignableRoleCodes.filter((roleCode) => selected.has(roleCode));
}

