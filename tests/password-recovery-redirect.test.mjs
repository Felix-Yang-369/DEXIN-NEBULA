import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourceUrl = new URL("../src/app/auth/confirm/route.ts", import.meta.url);

test("password recovery redirects use the configured public origin", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /getPasswordRecoveryRedirectUrl/);
  assert.match(source, /new URL\(nextPath, publicOrigin\)/);
  assert.doesNotMatch(source, /new URL\(nextPath, request\.url\)/);
  assert.doesNotMatch(
    source,
    /new URL\("\/forgot-password\?error=invalid_link", request\.url\)/,
  );
});
