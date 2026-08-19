import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));
const appRoot = path.join(projectRoot, "src/app");
const intentionallyUncovered = new Set([
  path.join(appRoot, "page.tsx"),
  path.join(appRoot, "login/page.tsx"),
  path.join(appRoot, "forgot-password/page.tsx"),
  path.join(appRoot, "reset-password/page.tsx"),
]);

async function findPages(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return findPages(entryPath);
      return entry.name === "page.tsx" ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

function nearestLoading(pagePath) {
  let directory = path.dirname(pagePath);
  while (directory.startsWith(appRoot)) {
    const candidate = path.join(directory, "loading.tsx");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

test("所有合适的业务页面都有最近的骨架加载边界", async () => {
  const pages = await findPages(appRoot);
  const uncovered = pages
    .filter((page) => !intentionallyUncovered.has(page))
    .filter((page) => !nearestLoading(page))
    .map((page) => path.relative(projectRoot, page));
  assert.deepEqual(uncovered, []);
});

test("认证和密码恢复页面不使用企业工作台骨架", () => {
  for (const route of ["login", "forgot-password", "reset-password"]) {
    assert.equal(existsSync(path.join(appRoot, route, "loading.tsx")), false);
  }
});

test("共享骨架具备布局稳定尺寸、无障碍状态和减少动画支持", async () => {
  const skeleton = await readFile(
    path.join(projectRoot, "src/components/business/platform-page-skeleton.tsx"),
    "utf8",
  );
  const shell = await readFile(
    path.join(projectRoot, "src/components/business/platform-route-state-shell.tsx"),
    "utf8",
  );
  assert.match(skeleton, /aria-busy="true"/);
  assert.match(skeleton, /motion-reduce:animate-none/);
  assert.match(skeleton, /min-h-\[190px\]/);
  assert.match(skeleton, /min-h-\[108px\]/);
  assert.match(skeleton, /min-h-\[560px\]/);
  for (const variant of ["dashboard", "list", "detail", "form", "chat"]) {
    assert.match(skeleton, new RegExp(`"${variant}"`));
  }
  assert.match(shell, /role="status"/);
  assert.match(shell, /animate-spin/);
  assert.match(shell, /motion-reduce:animate-none/);
  assert.match(shell, /正在加载\{loadingLabel\}/);
});
