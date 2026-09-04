import assert from "node:assert/strict";
import test from "node:test";
import {
  classifySearchDomains,
  normalizeSearchQuery,
  postgrestContainsFilter,
  rankSearchResults,
  searchResultScore,
} from "../src/lib/search/global-search.ts";

test("明确业务词只进入相关搜索域", () => {
  const inventory = classifySearchDomains("五常大米库存");
  assert.equal(inventory.product, true);
  assert.equal(inventory.hasExplicitDomain, true);
  assert.equal(inventory.customer, false);
  assert.equal(inventory.finance, false);

  const finance = classifySearchDomains("查询客户应收余额");
  assert.equal(finance.customer, true);
  assert.equal(finance.finance, true);
  assert.equal(finance.employee, false);
});

test("无明确业务域时保留跨模块搜索", () => {
  const broad = classifySearchDomains("霸碗");
  assert.equal(broad.hasExplicitDomain, false);
  assert.ok(
    Object.entries(broad)
      .filter(([key]) => key !== "hasExplicitDomain")
      .every(([, enabled]) => enabled),
  );
});

test("全局搜索统一全角字符、空白和长度", () => {
  assert.equal(normalizeSearchQuery("  ＤＸ－R001   五常大米  "), "DX-R001 五常大米");
  assert.equal(normalizeSearchQuery("a".repeat(100)).length, 80);
});

test("PostgREST 过滤器移除语法分隔符和用户通配符", () => {
  assert.equal(
    postgrestContainsFilter(["order_no", "note"], "SO-001,%.or(id.eq.1)"),
    "order_no.ilike.%SO-001 .or id.eq.1%,note.ilike.%SO-001 .or id.eq.1%",
  );
  assert.equal(postgrestContainsFilter(["name"], "%_(),"), null);
});

test("编号精确匹配优先于前缀和名称包含匹配", () => {
  assert.equal(searchResultScore("SO-001", ["SO-001"], ["SO-001"]), 100);
  assert.equal(searchResultScore("SO", ["SO-001"], ["SO-001"]), 80);
  assert.ok(
    searchResultScore("五常", ["五常大米礼盒"]) >
      searchResultScore("五常", ["东北五常大米礼盒"]),
  );
});

test("结果按相关性排序并保留原始顺序作为同分条件", () => {
  const rows = [
    { code: "DX-R002", name: "东北五常大米" },
    { code: "DX-R001", name: "五常大米" },
    { code: "DX-O001", name: "食用油" },
  ];
  const ranked = rankSearchResults(
    rows,
    "五常",
    (row) => [row.code, row.name],
    (row) => [row.code],
  );

  assert.deepEqual(
    ranked.map((row) => row.code),
    ["DX-R001", "DX-R002"],
  );
});
