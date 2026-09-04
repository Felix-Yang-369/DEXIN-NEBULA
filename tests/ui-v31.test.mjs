import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("UI V3.1 exposes controlled functional colors", async () => {
  const css = await read("src/app/globals.css");
  for (const color of ["#2f6fab", "#5865a8", "#a96f16", "#2f7d5b", "#c4474e"]) assert.match(css.toLowerCase(), new RegExp(color));
  assert.match(css, /ui-lazy-section/);
});

test("business table V3 saves governed personal view configuration", async () => {
  const table = await read("src/components/business/business-data-table.tsx");
  const route = await read("src/app/api/workspace/views/[viewKey]/route.ts");
  const migration = await read("supabase/migrations/20260904143000_ui_v31_saved_view_management.sql");
  for (const field of ["visibleColumns", "columnOrder", "columnWidths", "stickyColumns", "pageSize"]) assert.match(table, new RegExp(field));
  assert.match(route, /viewConfigSchema/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /export async function DELETE/);
  assert.match(migration, /rename_business_view/);
  assert.match(migration, /delete_business_view/);
});

test("mobile task workspace is task-first and keeps high-risk work on desktop", async () => {
  const shell = await read("src/components/navigation/mobile-task-shell.tsx");
  const scanner = await read("src/features/mobile/mobile-barcode-scanner.tsx");
  assert.match(shell, /首页.*待办.*新建.*德小馨.*我的/s);
  assert.match(shell, /请在桌面端处理/);
  assert.match(scanner, /getUserMedia/);
  assert.match(scanner, /BarcodeDetector/);
});

test("shared feedback and recovery primitives are wired", async () => {
  const layout = await read("src/app/layout.tsx");
  const financeGrid = await read("src/features/finance/editable-document-grid.tsx");
  const command = await read("src/components/navigation/command-center.tsx");
  assert.match(layout, /ToastProvider/);
  assert.match(financeGrid, /UnsavedChangesGuard/);
  assert.match(command, /ArrowDown/);
  assert.match(command, /FAVORITE_KEY/);
});
