import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("sidebar follows the seven-domain product architecture", async () => {
  const source = await read("src/config/platform-navigation.ts");
  const domains = [
    "经营决策",
    "业务管理",
    "供应链",
    "财务管理",
    "组织运营",
    "协同办公",
    "系统管理",
  ];

  for (const domain of domains) {
    assert.match(source, new RegExp(`label: \\"${domain}\\"`));
  }
  assert.match(source, /label: "系统管理"[\s\S]*?placement: "bottom"/);
  assert.doesNotMatch(source, /label: "0[1-7] /);
  assert.doesNotMatch(source, /label: "AI/);
  assert.doesNotMatch(source, /label: "销售管理"/);
  assert.doesNotMatch(source, /label: "应收 AR"|label: "应付 AP"|label: "角色与权限 IAM"/);
});

test("all application shells use the shared sidebar renderer", async () => {
  const paths = [
    "src/components/navigation/platform-sidebar-menu.tsx",
    "src/components/dashboard/Sidebar.tsx",
    "src/features/approvals/workflow-shell.tsx",
  ];

  for (const path of paths) {
    assert.match(await read(path), /PlatformNavigationList/);
  }
});

test("module title and submenu toggle remain separate controls", async () => {
  const source = await read(
    "src/components/navigation/platform-navigation-list.tsx",
  );

  assert.match(source, /<Link[\s\S]*?href=\{item\.href\}/);
  assert.match(source, /<details[\s\S]*?<summary/);
  assert.doesNotMatch(source, /item\.english/);
});
