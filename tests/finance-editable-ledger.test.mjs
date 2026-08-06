import assert from "node:assert/strict";
import test from "node:test";
import {
  hasFinanceSettlement,
  validateFinanceDocumentDraft,
} from "../src/features/finance/editable-ledger.ts";

const validDraft = {
  counterparty_name: "长沙示例客户",
  summary: "7 月粮油配送",
  total_amount: 12800,
  issue_date: "2026-07-30",
  due_date: "2026-08-30",
};

test("可编辑应收应付行校验金额、日期和必填字段", () => {
  assert.equal(validateFinanceDocumentDraft(validDraft), null);
  assert.equal(
    validateFinanceDocumentDraft({ ...validDraft, counterparty_name: " " }),
    "往来单位不能为空",
  );
  assert.equal(
    validateFinanceDocumentDraft({ ...validDraft, summary: "" }),
    "业务摘要不能为空",
  );
  assert.equal(
    validateFinanceDocumentDraft({ ...validDraft, total_amount: 0 }),
    "单据金额必须大于 0",
  );
  assert.equal(
    validateFinanceDocumentDraft({
      ...validDraft,
      due_date: "2026-07-29",
    }),
    "到期日不能早于单据日期",
  );
});

test("存在核销金额时锁定单据类型和原始金额", () => {
  assert.equal(hasFinanceSettlement(0), false);
  assert.equal(hasFinanceSettlement(0.01), true);
  assert.equal(hasFinanceSettlement(800), true);
});
