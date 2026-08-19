import assert from "node:assert/strict";
import test from "node:test";
import {
  bearerToken,
  buildSessionUser,
  createOpaqueToken,
  hashOpaqueToken,
  permissionsForRole,
  roleFromEmployeeRoles,
} from "../src/lib/miniprogram/auth.ts";

test("小程序会话令牌使用足够随机度且数据库只需保存固定长度哈希", () => {
  const first = createOpaqueToken();
  const second = createOpaqueToken();
  assert.notEqual(first, second);
  assert.ok(first.length >= 40);
  assert.match(hashOpaqueToken(first), /^[0-9a-f]{64}$/);
  assert.notEqual(hashOpaqueToken(first), first);
});

test("Authorization 只接受规范 Bearer 会话令牌", () => {
  const token = createOpaqueToken();
  assert.equal(bearerToken(`Bearer ${token}`), token);
  assert.equal(bearerToken(`Basic ${token}`), null);
  assert.equal(bearerToken("Bearer short"), null);
  assert.equal(bearerToken(null), null);
});

test("未绑定员工的微信身份只能获得客户权限", () => {
  const user = buildSessionUser({
    identityId: "identity-1",
    displayName: "微信用户",
  });
  assert.equal(user.role, "customer");
  assert.deepEqual(user.permissions, [
    "store.products.read",
    "store.orders.read",
  ]);
  assert.equal(user.employeeId, undefined);
});

test("员工角色由服务端角色关系计算，管理员获得管理权限", () => {
  assert.equal(roleFromEmployeeRoles(["employee"]), "employee");
  assert.equal(roleFromEmployeeRoles(["employee", "admin"]), "admin");
  assert.ok(permissionsForRole("admin").includes("nebula.admin"));

  const user = buildSessionUser({
    identityId: "identity-2",
    displayName: "旧名称",
    employee: {
      id: "employee-1",
      employeeNo: "DX0001",
      organizationId: "organization-1",
      name: "测试员工",
    },
    roleCodes: ["admin"],
  });
  assert.equal(user.displayName, "测试员工");
  assert.equal(user.role, "admin");
  assert.equal(user.employeeNo, "DX0001");
});
