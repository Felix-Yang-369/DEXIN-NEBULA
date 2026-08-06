import assert from "node:assert/strict";
import test from "node:test";
import { getProductQualityFlags } from "../src/features/products/quality.ts";

const completeProduct = {
  image_path: "rice/DX-R001.png",
  barcode: "6970000000001",
  customer_query_reply: "查询回复",
  out_of_stock_reply: "缺货回复",
  order_guide_reply: "下单引导",
};

test("完整产品主档不产生质量问题", () => {
  assert.deepEqual(getProductQualityFlags(completeProduct, true), []);
});

test("识别图片、条码、价格和话术缺失", () => {
  assert.deepEqual(
    getProductQualityFlags(
      {
        image_path: null,
        barcode: "供应商待确认",
        customer_query_reply: null,
        out_of_stock_reply: null,
        order_guide_reply: null,
      },
      false,
    ),
    ["missing_image", "missing_barcode", "missing_price", "incomplete_reply"],
  );
});
