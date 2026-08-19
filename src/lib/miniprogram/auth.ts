import { createHash, randomBytes, randomUUID } from "node:crypto";
import type {
  MiniprogramRole,
  MiniprogramSessionUser,
} from "./types";

const EMPLOYEE_PERMISSIONS = [
  "nebula.dashboard.read",
  "attendance.clock",
  "orders.read",
];

const ADMIN_PERMISSIONS = [
  ...EMPLOYEE_PERMISSIONS,
  "nebula.admin",
  "attendance.manage",
];

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashOpaqueToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function bearerToken(authorization: string | null) {
  if (!authorization) return null;
  const match = authorization.match(/^Bearer ([A-Za-z0-9_-]{32,256})$/);
  return match?.[1] ?? null;
}

export function requestId() {
  return randomUUID();
}

export function roleFromEmployeeRoles(roleCodes: string[]): MiniprogramRole {
  if (roleCodes.includes("admin")) return "admin";
  return "employee";
}

export function permissionsForRole(role: MiniprogramRole) {
  if (role === "admin") return ADMIN_PERMISSIONS;
  if (role === "employee") return EMPLOYEE_PERMISSIONS;
  return ["store.products.read", "store.orders.read"];
}

export function buildSessionUser(input: {
  identityId: string;
  displayName: string;
  employee?: {
    id: string;
    employeeNo: string;
    organizationId: string;
    name: string;
  } | null;
  roleCodes?: string[];
}): MiniprogramSessionUser {
  if (!input.employee) {
    return {
      id: input.identityId,
      displayName: input.displayName || "微信用户",
      role: "customer",
      permissions: permissionsForRole("customer"),
    };
  }

  const role = roleFromEmployeeRoles(input.roleCodes ?? []);
  return {
    id: input.identityId,
    displayName: input.employee.name,
    role,
    employeeId: input.employee.id,
    employeeNo: input.employee.employeeNo,
    organizationId: input.employee.organizationId,
    permissions: permissionsForRole(role),
  };
}
