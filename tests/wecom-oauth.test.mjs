import assert from "node:assert/strict";
import test from "node:test";
import {
  createWeComQrConnectUrl,
  normalizedWeComEmails,
  safeWeComReturnPath,
  weComStateMatches,
} from "../src/lib/wecom/oauth.ts";

test("企业微信登录只允许站内回跳地址", () => {
  assert.equal(safeWeComReturnPath("/finance/invoices"), "/finance/invoices");
  assert.equal(safeWeComReturnPath("//evil.example/path"), "/dashboard");
  assert.equal(safeWeComReturnPath("https://evil.example"), "/dashboard");
  assert.equal(safeWeComReturnPath(null), "/dashboard");
});

test("企业微信 OAuth state 使用完整等值校验", () => {
  assert.equal(weComStateMatches("secure-state", "secure-state"), true);
  assert.equal(weComStateMatches("secure-state", "secure-state-x"), false);
  assert.equal(weComStateMatches("", "secure-state"), false);
});

test("企业微信邮箱完成去重、规范化和格式过滤", () => {
  assert.deepEqual(
    normalizedWeComEmails([
      " Admin@DXMStech.cn ",
      "admin@dxmstech.cn",
      "invalid",
      null,
    ]),
    ["admin@dxmstech.cn"],
  );
});

test("企业微信二维码地址包含官方参数和编码后的回调", () => {
  const url = createWeComQrConnectUrl({
    corpId: "ww-test-corp",
    agentId: "1000002",
    callbackUrl: "https://nebula.example.com/auth/wecom/callback?source=login",
    state: "state-value",
  });

  assert.equal(url.origin, "https://login.work.weixin.qq.com");
  assert.equal(url.pathname, "/wwlogin/sso/login");
  assert.equal(url.searchParams.get("login_type"), "CorpApp");
  assert.equal(url.searchParams.get("appid"), "ww-test-corp");
  assert.equal(url.searchParams.get("agentid"), "1000002");
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://nebula.example.com/auth/wecom/callback?source=login",
  );
  assert.equal(url.searchParams.get("state"), "state-value");
});
