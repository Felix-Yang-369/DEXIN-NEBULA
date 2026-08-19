import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routeRoot = new URL("../src/app/finance/cash-documents/", import.meta.url);

test("收付款单加载态使用接近真实布局的骨架并预留稳定高度", async () => {
  const loading = await readFile(new URL("loading.tsx", routeRoot), "utf8");
  assert.match(loading, /aria-busy="true"/);
  assert.match(loading, /min-h-\[196px\]/);
  assert.match(loading, /xl:grid-cols-\[minmax\(0,1\.4fr\)_minmax\(380px,\.6fr\)\]/);
  assert.match(loading, /min-h-\[620px\]/);
  assert.match(loading, /animate-pulse/);
});

test("收付款单请求失败时显示错误和重试而不是永久骨架", async () => {
  const [page, error] = await Promise.all([
    readFile(new URL("page.tsx", routeRoot), "utf8"),
    readFile(new URL("error.tsx", routeRoot), "utf8"),
  ]);
  assert.match(page, /throw new Error\("收付款单数据请求失败"\)/);
  assert.match(error, /reset: \(\) => void/);
  assert.match(error, /重新加载/);
  assert.doesNotMatch(error, /animate-pulse/);
});
