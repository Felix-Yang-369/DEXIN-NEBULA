import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const actionUrl = new URL(
  "../src/features/documents/server-actions.ts",
  import.meta.url,
);
const downloadUrl = new URL(
  "../src/app/documents/[id]/download/route.ts",
  import.meta.url,
);
const adapterUrl = new URL(
  "../src/lib/storage/nas-webdav.ts",
  import.meta.url,
);

test("business document upload stores file content on NAS", async () => {
  const source = await readFile(actionUrl, "utf8");

  assert.match(source, /uploadNasFile/);
  assert.match(source, /deleteNasFile/);
  assert.doesNotMatch(source, /supabase\.storage/);
});

test("business document download is authorized before NAS streaming", async () => {
  const source = await readFile(downloadUrl, "utf8");
  const selectPosition = source.indexOf('.from("business_documents")');
  const downloadPosition = source.indexOf("await downloadNasFile");

  assert.ok(selectPosition >= 0);
  assert.ok(downloadPosition > selectPosition);
  assert.match(source, /record_business_document_download/);
  assert.match(source, /Cache-Control": "private, no-store"/);
  assert.doesNotMatch(source, /createSignedUrl/);
});

test("NAS adapter remains server-only and rejects unsafe paths", async () => {
  const source = await readFile(adapterUrl, "utf8");

  assert.match(source, /import "server-only"/);
  assert.match(source, /segment === "\.\."/);
  assert.match(source, /NAS_WEBDAV_PASSWORD/);
  assert.match(source, /rejectUnauthorized/);
});
