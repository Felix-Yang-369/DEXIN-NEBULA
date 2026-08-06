import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyAiQuery,
  extractSearchTerms,
  relevanceScore,
  searchableText,
} from "../src/features/ai/search.ts";

test("德小馨检索能识别产品编号和中文关键词", () => {
  const terms = extractSearchTerms("请问 DX-R001 的团购价和库存是多少？");
  assert.ok(terms.includes("dx-r001"));
  assert.ok(terms.includes("团购"));
  assert.ok(terms.includes("库存"));
});

test("制度、产品编号和库存问题进入独立检索范围", () => {
  assert.deepEqual(classifyAiQuery("请假审批流程"), {
    knowledge: true,
    product: false,
    inventory: false,
    customer: false,
    supplier: false,
    employee: false,
    announcement: false,
    document: false,
    approval: false,
    quote: false,
    finance: false,
    hasExplicitIntent: true,
    productCode: null,
  });
  assert.deepEqual(classifyAiQuery("DX-R001 的价格和配送"), {
    knowledge: false,
    product: true,
    inventory: false,
    customer: false,
    supplier: false,
    employee: false,
    announcement: false,
    document: false,
    approval: false,
    quote: false,
    finance: false,
    hasExplicitIntent: true,
    productCode: "DX-R001",
  });
  assert.deepEqual(classifyAiQuery("万纬仓有哪些大米库存"), {
    knowledge: false,
    product: false,
    inventory: true,
    customer: false,
    supplier: false,
    employee: false,
    announcement: false,
    document: false,
    approval: false,
    quote: false,
    finance: false,
    hasExplicitIntent: true,
    productCode: null,
  });
});

test("德小馨能识别企业业务数据范围", () => {
  const intent = classifyAiQuery("查看霸碗客户的应收账款和最新报价单");
  assert.equal(intent.customer, true);
  assert.equal(intent.finance, true);
  assert.equal(intent.quote, true);
  assert.equal(intent.product, false);

  const broad = classifyAiQuery("帮我查找公司内部关于霸碗的资料");
  assert.equal(broad.document, true);
});

test("匹配内容的相关性高于无关内容", () => {
  const terms = extractSearchTerms("请假审批流程");
  const related = relevanceScore(
    searchableText(["请假申请与审批流程管理制度"]),
    terms,
  );
  const unrelated = relevanceScore(searchableText(["产品配送说明"]), terms);
  assert.ok(related > unrelated);
});
