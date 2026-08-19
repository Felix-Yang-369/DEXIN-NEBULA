import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  assignableRoleCodes,
  normalizeEmployeeRoleCodes,
} from "../src/features/permissions/employee-role-assignment.ts";
import {
  operationPermissionRows,
  pagePermissionRows,
  sensitiveFieldRows,
} from "../src/features/permissions/role-permission-matrix.ts";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("每位员工始终保留普通员工基础角色", () => {
  assert.deepEqual(normalizeEmployeeRoleCodes(["finance"]), [
    "employee",
    "finance",
  ]);
});

test("董事长自动获得全部角色", () => {
  assert.deepEqual(
    normalizeEmployeeRoleCodes(["employee", "chairman"]),
    [...assignableRoleCodes],
  );
});

test("权限矩阵中的董事长拥有全部页面、操作和敏感字段权限", () => {
  const rows = [
    ...pagePermissionRows,
    ...operationPermissionRows,
    ...sensitiveFieldRows,
  ];

  for (const row of rows) {
    assert.deepEqual(row.permissions.chairman, {
      level: "full",
      label: "全部权限",
    });
  }
});

test("数据库权限检查将董事长视为任意长期角色", async () => {
  const migration = await read(
    "supabase/migrations/20260814193000_chairman_full_permissions.sql",
  );

  assert.match(migration, /role\.code = required_code or role\.code = 'chairman'/);
  assert.match(migration, /on conflict \(employee_id, role_id\) do nothing/);
  assert.match(migration, /'chairman_permission_scope', 'all'/);
});

