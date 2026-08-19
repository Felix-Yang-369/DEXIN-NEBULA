import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../supabase/migrations/20260815093400_document_folder_access_control.sql",
    import.meta.url,
  ),
  "utf8",
);
const actions = readFileSync(
  new URL("../src/features/documents/server-actions.ts", import.meta.url),
  "utf8",
);
const page = readFileSync(
  new URL("../src/app/documents/page.tsx", import.meta.url),
  "utf8",
);
const directUpload = readFileSync(
  new URL(
    "../src/features/documents/direct-document-upload.tsx",
    import.meta.url,
  ),
  "utf8",
);
const downloadRoute = readFileSync(
  new URL("../src/app/documents/[id]/download/route.ts", import.meta.url),
  "utf8",
);
const wedriveOperations = readFileSync(
  new URL(
    "../supabase/migrations/20260817021340_wedrive_file_operations.sql",
    import.meta.url,
  ),
  "utf8",
);

test("文件中心初始化八个一级目录且不包含公司管理", () => {
  const expectedCodes = [
    "company-public",
    "human-resources",
    "finance",
    "business",
    "supply-chain",
    "product-center",
    "operations-brand",
    "department-spaces",
  ];

  for (const code of expectedCodes) {
    assert.match(migration, new RegExp(`'${code}'`));
  }
  assert.doesNotMatch(migration, /公司管理/);
});

test("系统管理员可查看下载所有目录但不会自动获得管理权限", () => {
  assert.match(
    migration,
    /has_org_role\('admin'\) and p_permission in \('view', 'download'\)/,
  );
  assert.doesNotMatch(
    migration,
    /has_org_role\('admin'\) and p_permission in \('view', 'download', 'manage'/,
  );
});

test("部门成员只获查看下载上传，管理和授权保留给负责人", () => {
  assert.match(
    migration,
    /folder\.owner_department_id,\s+true,\s+true,\s+true,\s+false,\s+false/s,
  );
  assert.match(
    migration,
    /department\.manager_employee_id = public\.current_employee_id\(\)/,
  );
});

test("权限申请默认 24 小时并按 L2、L3、L4 生成审批链", () => {
  assert.match(migration, /duration_hours integer not null default 24/);
  assert.match(migration, /if v_folder\.access_level >= 3 then/);
  assert.match(migration, /'folder_owner_review'/);
  assert.match(migration, /if v_folder\.access_level = 4/);
  assert.match(migration, /make_interval\(hours => v_access\.duration_hours\)/);
  assert.match(page, /24 小时（默认）/);
});

test("文件上传下载均经过目录权限并由 NAS 承载文件内容", () => {
  assert.match(actions, /create_folder_business_document/);
  assert.match(actions, /\$\{employee\.organizationId\}\/\$\{folderId\}/);
  assert.match(actions, /uploadNasFile/);
  assert.match(downloadRoute, /can_download_business_document/);
  assert.match(downloadRoute, /downloadNasFile/);
});

test("文件中心包含锁定目录申请、权限审批和子目录管理入口", () => {
  assert.match(page, /requestDocumentFolderAccess/);
  assert.match(page, /processDocumentFolderAccess/);
  assert.match(page, /createDocumentFolder/);
  assert.match(page, /我的文件权限申请/);
  assert.match(page, /待我审批的文件权限/);
});

test("企业微盘视图包含我的文件、最近文件和回收站", () => {
  assert.match(page, /我的文件/);
  assert.match(page, /最近文件/);
  assert.match(page, /回收站/);
  assert.match(page, /view=mine/);
  assert.match(page, /view=recent/);
  assert.match(page, /view=archived/);
});

test("企业微盘使用共享空间、子文件夹、文件和详情四栏浏览逻辑", () => {
  assert.match(page, /function MicrodriveExplorer/);
  assert.match(page, /共享空间/);
  assert.match(page, /请选择共享空间/);
  assert.match(page, /文件列表/);
  assert.match(page, /文件详情/);
  assert.match(page, /selectedDocument/);
  assert.match(page, /grid-cols-\[230px_270px_410px_minmax\(280px,1fr\)\]/);
});

test("微盘顶部上传按钮直接触发系统文件选择器", () => {
  assert.match(page, /DirectDocumentUpload/);
  assert.match(directUpload, /type="file"/);
  assert.match(directUpload, /requestSubmit\(\)/);
  assert.match(directUpload, /name="category" type="hidden" value="internal"/);
  assert.match(
    directUpload,
    /name="visibility" type="hidden" value="department"/,
  );
  assert.match(
    actions,
    /folder: folderId,\s+created: "文件已安全上传并完成归档"/,
  );
  assert.doesNotMatch(page, /href="#drive-upload"/);
});

test("六个微盘快捷入口显示在文件浏览区下方", () => {
  assert.ok(
    page.indexOf("<DriveNavigation") > page.indexOf("<MicrodriveExplorer"),
  );
});

test("文件上传不再收集文件级生效日期和到期日期", () => {
  assert.doesNotMatch(page, /name="effectiveOn"/);
  assert.doesNotMatch(page, /name="expiresOn"/);
  assert.match(actions, /p_effective_on: null/);
  assert.match(actions, /p_expires_on: null/);
});

test("企业微盘文件操作经过数据库权限并记录审计", () => {
  assert.match(wedriveOperations, /rename_business_document/);
  assert.match(wedriveOperations, /move_business_document/);
  assert.match(wedriveOperations, /restore_business_document/);
  assert.match(wedriveOperations, /can_manage_business_document/);
  assert.match(wedriveOperations, /document_folder_has_permission/);
  assert.match(wedriveOperations, /business_document_renamed/);
  assert.match(wedriveOperations, /business_document_moved/);
  assert.match(wedriveOperations, /business_document_restored/);
});
