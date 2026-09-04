import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [migration, inventoryRoute, productRoute] = await Promise.all([
  readFile(
    new URL(
      "../supabase/migrations/20260826130016_secure_business_exports.sql",
      import.meta.url,
    ),
    "utf8",
  ),
  readFile(new URL("../src/app/inventory/export/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/products/export/route.ts", import.meta.url), "utf8"),
]);

test("仓储和产品导出在查询业务数据前先校验数据库权限", () => {
  assert.ok(
    inventoryRoute.indexOf('rpc(\n    "can_export_inventory"') <
      inventoryRoute.indexOf('.from("inventory_items")'),
  );
  assert.ok(
    productRoute.indexOf('rpc(\n    "can_export_products"') <
      productRoute.indexOf('.from("products")'),
  );
  assert.match(inventoryRoute, /status: 403/);
  assert.match(productRoute, /status: 403/);
});

test("导出权限仅授予业务部门或董事长", () => {
  assert.match(migration, /can_manage_inventory\(\)[\s\S]*has_org_role\('chairman'\)/);
  assert.match(migration, /can_manage_products\(\)[\s\S]*has_org_role\('chairman'\)/);
  assert.doesNotMatch(migration, /has_org_role\('admin'\)/);
});

test("所有导出必须审计成功才返回下载", () => {
  assert.match(inventoryRoute, /record_inventory_export_audit/);
  assert.match(productRoute, /record_product_export_audit/);
  assert.match(inventoryRoute, /导出审计记录失败，未生成下载/);
  assert.match(productRoute, /导出审计记录失败，未生成下载/);
  assert.match(migration, /revoke all on function public\.record_product_export_audit[\s\S]*from public, anon/);
});
