const financeScopeElevatedRoles = new Set([
  "admin",
  "chairman",
  "department_lead",
  "hr",
]);

const financeScopeAllowedPrefixes = [
  "/auth/signout",
  "/dashboard",
  "/finance",
  "/bi",
  "/oa",
  "/approvals",
  "/requests",
  "/announcements",
  "/reports/weekly",
  "/knowledge",
  "/notifications",
  "/documents",
  "/account",
  "/help",
];

export function isScopedFinanceUser(roleCodes: string[]) {
  return (
    roleCodes.includes("finance") &&
    !roleCodes.some((role) => financeScopeElevatedRoles.has(role))
  );
}

export function isFinanceScopeAllowedPath(pathname: string) {
  return financeScopeAllowedPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
