import assert from "node:assert/strict";
import test from "node:test";
import {
  passwordConfirmationError,
  passwordPolicyError,
  safePasswordReturnPath,
} from "../src/lib/auth/password.ts";

test("密码恢复回跳只允许站内路径", () => {
  assert.equal(safePasswordReturnPath("/reset-password"), "/reset-password");
  assert.equal(safePasswordReturnPath("//evil.example"), "/reset-password");
  assert.equal(
    safePasswordReturnPath("https://evil.example/reset"),
    "/reset-password",
  );
});

test("新密码需满足长度和字符类别要求", () => {
  assert.match(passwordPolicyError("Short1!") ?? "", /至少/);
  assert.match(
    passwordPolicyError("alllowercase12") ?? "",
    /三类/,
  );
  assert.equal(passwordPolicyError("SecurePass12!"), null);
});

test("两次输入的新密码必须一致", () => {
  assert.equal(
    passwordConfirmationError("SecurePass12!", "DifferentPass12!"),
    "两次输入的新密码不一致。",
  );
  assert.equal(
    passwordConfirmationError("SecurePass12!", "SecurePass12!"),
    null,
  );
});
