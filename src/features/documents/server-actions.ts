"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
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

function optionalDate(input: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(input) ? input : null;
}

function documentRedirect(params: Record<string, string>): never {
  redirect(`/documents?${new URLSearchParams(params).toString()}`);
}

export async function uploadBusinessDocument(formData: FormData) {
  const employee = await requireCurrentEmployee();
  const category = value(formData, "category");
  const title = value(formData, "title");
  const description = value(formData, "description");
  const visibility = value(formData, "visibility");
  const customerId = value(formData, "customerId");
  const relatedPartyName = value(formData, "relatedPartyName");
  const referenceNo = value(formData, "referenceNo");
  const effectiveOn = optionalDate(value(formData, "effectiveOn"));
  const expiresOn = optionalDate(value(formData, "expiresOn"));
  const viewerRoleCodes = formData
    .getAll("viewerRoleCodes")
    .map(String)
    .filter(Boolean);
  const file = formData.get("file");

  if (
    !["contract", "customer", "supplier", "internal"].includes(category) ||
    !["organization", "department", "restricted"].includes(visibility) ||
    title.length < 2 ||
    title.length > 160
  ) {
    documentRedirect({ error: "请完整填写文件标题、分类和可见范围" });
  }

  if (
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 20 * 1024 * 1024 ||
    !(file.type in allowedFiles)
  ) {
    documentRedirect({
      error: "仅支持 20MB 以内的 PDF、图片、Word 或 Excel 文件",
    });
  }

  const extension = allowedFiles[file.type as keyof typeof allowedFiles];
  const storagePath = `${employee.organizationId}/${new Date()
    .toISOString()
    .slice(0, 7)}/${randomUUID()}.${extension}`;
  const supabase = await createClient();
  const { error: uploadError } = await supabase.storage
    .from("business-documents")
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("uploadBusinessDocument storage failed", uploadError.message);
    documentRedirect({ error: "文件上传失败，请确认文件格式和上传权限" });
  }

  const { error: metadataError } = await supabase.rpc(
    "create_business_document",
    {
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
      p_effective_on: effectiveOn,
      p_expires_on: expiresOn,
      p_visibility: visibility,
      p_viewer_role_codes: viewerRoleCodes,
    },
  );

  if (metadataError) {
    console.error("uploadBusinessDocument metadata failed", metadataError.code);
    await supabase.storage.from("business-documents").remove([storagePath]);
    documentRedirect({
      error: "文件资料保存失败，请确认当前账号具有该分类的上传权限",
    });
  }

  revalidatePath("/documents");
  revalidatePath("/search");
  documentRedirect({ created: "文件已安全上传并完成归档" });
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
  documentRedirect({ updated: "文件已归档，原文件仍安全保留" });
}
