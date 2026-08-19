"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  deleteNasFile,
  NasWebDavError,
  uploadNasFile,
} from "@/lib/storage/nas-webdav";
import { createClient } from "@/lib/supabase/server";

const allowedFiles = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
} as const;

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function isUuid(input: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    input,
  );
}

function documentRedirect(params: Record<string, string>): never {
  redirect(`/documents?${new URLSearchParams(params).toString()}`);
}

export async function uploadBusinessDocument(formData: FormData) {
  const employee = await requireCurrentEmployee();
  const category = value(formData, "category");
  const folderId = value(formData, "folderId");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const visibility = value(formData, "visibility");
  const customerId = value(formData, "customerId");
  const relatedPartyName = value(formData, "relatedPartyName");
  const referenceNo = value(formData, "referenceNo");
  const viewerRoleCodes = formData
    .getAll("viewerRoleCodes")
    .map(String)
    .filter(Boolean);
  const file = formData.get("file");

  if (
    !isUuid(folderId) ||
    !["contract", "customer", "supplier", "internal"].includes(category) ||
    !["organization", "department", "restricted"].includes(visibility) ||
    title.length < 2 ||
    title.length > 160
  ) {
    documentRedirect({
      ...(isUuid(folderId) ? { folder: folderId } : {}),
      error: "请完整填写文件标题、分类和可见范围",
    });
  }

  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 20 * 1024 * 1024 ||
    !(file.type in allowedFiles)
  ) {
    documentRedirect({
      ...(isUuid(folderId) ? { folder: folderId } : {}),
      error: "仅支持 20MB 以内的 PDF、图片、Word 或 Excel 文件",
    });
  }

  const extension = allowedFiles[file.type as keyof typeof allowedFiles];
  const storagePath = `${employee.organizationId}/${folderId}/${new Date()
    .toISOString()
    .slice(0, 7)}/${randomUUID()}.${extension}`;
  const supabase = await createClient();
  try {
    await uploadNasFile(
      storagePath,
      Buffer.from(await file.arrayBuffer()),
      file.type,
    );
  } catch (error) {
    console.error(
      "uploadBusinessDocument NAS upload failed",
      error instanceof NasWebDavError ? error.code : "UNKNOWN_ERROR",
    );
    documentRedirect({
      folder: folderId,
      error: "NAS 文件服务暂时不可用，请稍后重试或联系管理员",
    });
  }

  const { error: metadataError } = await supabase.rpc(
    "create_folder_business_document",
    {
      p_folder_id: folderId,
      p_category: category,
      p_title: title,
      p_description: description || null,
      p_original_file_name: file.name.slice(0, 240),
      p_storage_path: storagePath,
      p_mime_type: file.type,
      p_file_size: file.size,
      p_customer_id: customerId || null,
      p_related_party_name: relatedPartyName || null,
      p_reference_no: referenceNo || null,
      // File-level effective and expiry dates are intentionally not used.
      // Keep the legacy database parameters null for backward compatibility.
      p_effective_on: null,
      p_expires_on: null,
      p_visibility: visibility,
      p_viewer_role_codes: viewerRoleCodes,
    },
  );

  if (metadataError) {
    console.error("uploadBusinessDocument metadata failed", metadataError.code);
    try {
      await deleteNasFile(storagePath);
    } catch (error) {
      console.error(
        "uploadBusinessDocument NAS rollback failed",
        error instanceof NasWebDavError ? error.code : "UNKNOWN_ERROR",
      );
    }
    documentRedirect({
      folder: folderId,
      error: "文件资料保存失败，请确认当前账号具有该分类的上传权限",
    });
  }

  revalidatePath("/documents");
  revalidatePath("/search");
  documentRedirect({
    folder: folderId,
    created: "文件已安全上传并完成归档",
  });
}

export async function requestDocumentFolderAccess(formData: FormData) {
  await requireCurrentEmployee();
  const folderId = value(formData, "folderId");
  const reason = value(formData, "reason");
  const relatedContext = value(formData, "relatedContext");
  const durationHours = Number(value(formData, "durationHours") || "24");
  const urgency = value(formData, "urgency") || "normal";
  const requestedCanDownload = formData.get("requestedCanDownload") === "on";

  if (
    !isUuid(folderId) ||
    reason.length < 10 ||
    reason.length > 1000 ||
    relatedContext.length > 500 ||
    ![0, 24, 168, 720, 2160].includes(durationHours) ||
    !["normal", "urgent"].includes(urgency)
  ) {
    documentRedirect({
      folder: folderId,
      error: "请填写至少 10 个字的申请原因，并确认申请时长",
    });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "submit_document_folder_access_request",
    {
      p_folder_id: folderId,
      p_reason: reason,
      p_related_context: relatedContext || null,
      p_duration_hours: durationHours,
      p_requested_can_download: requestedCanDownload,
      p_urgency: urgency,
    },
  );

  if (error) {
    console.error("requestDocumentFolderAccess failed", error.code);
    const message =
      error.code === "23505"
        ? "该文件夹已有审批中的权限申请"
        : error.code === "23514"
          ? "审批负责人尚未配置完整，请联系系统管理员"
          : "权限申请提交失败，请确认填写内容或稍后重试";
    documentRedirect({ folder: folderId, error: message });
  }

  revalidatePath("/documents");
  revalidatePath("/approvals");
  revalidatePath("/notifications");
  documentRedirect({
    folder: folderId,
    created: "权限申请已提交，默认授权时长为 24 小时",
  });
}

export async function processDocumentFolderAccess(formData: FormData) {
  await requireCurrentEmployee();
  const requestId = value(formData, "requestId");
  const action = value(formData, "action");
  const opinion = value(formData, "opinion");
  const expectedVersion = Number(value(formData, "expectedVersion"));
  const durationHours = Number(value(formData, "durationHours") || "24");
  const canDownload = formData.get("canDownload") === "on";

  if (
    !isUuid(requestId) ||
    !["approve", "reject", "withdraw"].includes(action) ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 1 ||
    ![0, 24, 168, 720, 2160].includes(durationHours) ||
    ((action === "reject" || action === "withdraw") && opinion.length < 2)
  ) {
    documentRedirect({ error: "审批参数无效；拒绝或撤回时请填写说明" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc(
    "process_document_folder_access_request",
    {
      p_request_id: requestId,
      p_action: action,
      p_opinion:
        opinion || (action === "approve" ? "同意开放文件夹权限" : null),
      p_expected_version: expectedVersion,
      p_duration_hours: durationHours,
      p_can_download: canDownload,
    },
  );

  if (error) {
    console.error("processDocumentFolderAccess failed", error.code);
    documentRedirect({
      error:
        error.code === "40001"
          ? "申请已被其他人处理，请刷新页面后重试"
          : "操作失败，请确认申请状态和当前审批人",
    });
  }

  revalidatePath("/documents");
  revalidatePath("/approvals");
  revalidatePath("/notifications");
  documentRedirect({
    updated:
      action === "approve"
        ? "审批已通过"
        : action === "reject"
          ? "申请已拒绝"
          : "申请已撤回",
  });
}

export async function createDocumentFolder(formData: FormData) {
  await requireCurrentEmployee();
  const parentId = value(formData, "parentId");
  const name = value(formData, "name");
  const description = value(formData, "description");
  const accessLevel = Number(value(formData, "accessLevel"));

  if (
    !isUuid(parentId) ||
    name.length < 2 ||
    name.length > 80 ||
    description.length > 500 ||
    ![1, 2, 3, 4].includes(accessLevel)
  ) {
    documentRedirect({ folder: parentId, error: "文件夹名称或权限级别无效" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_document_folder", {
    p_parent_id: parentId,
    p_name: name,
    p_description: description || null,
    p_access_level: accessLevel,
  });

  if (error) {
    console.error("createDocumentFolder failed", error.code);
    documentRedirect({
      folder: parentId,
      error: "创建失败，请确认管理权限和文件夹名称",
    });
  }

  revalidatePath("/documents");
  documentRedirect({ folder: parentId, created: "子文件夹已创建" });
}

export async function archiveBusinessDocument(formData: FormData) {
  await requireCurrentEmployee();
  const documentId = value(formData, "documentId");

  if (!/^[0-9a-f-]{36}$/i.test(documentId)) {
    documentRedirect({ error: "文件不存在或无权操作" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("archive_business_document", {
    p_document_id: documentId,
  });

  if (error) {
    console.error("archiveBusinessDocument failed", error.code);
    documentRedirect({ error: "文件归档失败，请确认管理权限" });
  }

  revalidatePath("/documents");
  revalidatePath("/search");
  documentRedirect({ updated: "文件已移入回收站，文件正文仍安全保留" });
}

export async function renameBusinessDocument(formData: FormData) {
  await requireCurrentEmployee();
  const documentId = value(formData, "documentId");
  const title = value(formData, "title");

  if (!isUuid(documentId) || title.length < 2 || title.length > 160) {
    documentRedirect({ error: "文件名称需为 2–160 个字符" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("rename_business_document", {
    p_document_id: documentId,
    p_title: title,
  });

  if (error) {
    console.error("renameBusinessDocument failed", error.code);
    documentRedirect({ error: "重命名失败，请确认文件管理权限" });
  }

  revalidatePath("/documents");
  revalidatePath("/search");
  documentRedirect({ updated: "文件名称已更新" });
}

export async function moveBusinessDocument(formData: FormData) {
  await requireCurrentEmployee();
  const documentId = value(formData, "documentId");
  const targetFolderId = value(formData, "targetFolderId");

  if (!isUuid(documentId) || !isUuid(targetFolderId)) {
    documentRedirect({ error: "文件或目标目录无效" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("move_business_document", {
    p_document_id: documentId,
    p_target_folder_id: targetFolderId,
  });

  if (error) {
    console.error("moveBusinessDocument failed", error.code);
    documentRedirect({ error: "移动失败，请确认源文件和目标目录权限" });
  }

  revalidatePath("/documents");
  revalidatePath("/search");
  documentRedirect({ folder: targetFolderId, updated: "文件已移动到目标目录" });
}

export async function restoreBusinessDocument(formData: FormData) {
  await requireCurrentEmployee();
  const documentId = value(formData, "documentId");

  if (!isUuid(documentId)) {
    documentRedirect({ view: "archived", error: "文件不存在或无权恢复" });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_business_document", {
    p_document_id: documentId,
  });

  if (error) {
    console.error("restoreBusinessDocument failed", error.code);
    documentRedirect({
      view: "archived",
      error: "恢复失败，请确认文件管理权限",
    });
  }

  revalidatePath("/documents");
  revalidatePath("/search");
  documentRedirect({ view: "archived", updated: "文件已恢复到原目录" });
}
