import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { downloadNasFile, NasWebDavError } from "@/lib/storage/nas-webdav";
import { createClient } from "@/lib/supabase/server";

function attachmentDisposition(fileName: string) {
  const safeFileName = fileName.replace(/[\0\r\n]/g, "_");
  const asciiName =
    safeFileName
      .normalize("NFKD")
      .replace(/[^\x20-\x7E]/g, "_")
      .replace(/["\\\r\n]/g, "_")
      .slice(0, 160) || "download";
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.redirect(
      new URL("/documents?error=文件不存在", request.url),
    );
  }

  const supabase = await createClient();
  const { data: document } = await supabase
    .from("business_documents")
    .select("storage_path, original_file_name, mime_type")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.redirect(
      new URL("/documents?error=文件不存在或无权下载", request.url),
    );
  }

  const { data: canDownload, error: permissionError } = await supabase.rpc(
    "can_download_business_document",
    { p_document_id: id },
  );
  if (permissionError || !canDownload) {
    return NextResponse.redirect(
      new URL("/documents?error=当前账号没有该文件的下载权限", request.url),
    );
  }

  let nasResponse;
  try {
    nasResponse = await downloadNasFile(
      document.storage_path,
      request.headers.get("range") ?? undefined,
    );
  } catch (error) {
    console.error(
      "business document NAS download failed",
      error instanceof NasWebDavError ? error.code : "UNKNOWN_ERROR",
    );
    return NextResponse.redirect(
      new URL(
        error instanceof NasWebDavError && error.code === "FILE_NOT_FOUND"
          ? "/documents?error=NAS中未找到该文件，请联系管理员"
          : "/documents?error=NAS文件服务暂时不可用，请稍后重试",
        request.url,
      ),
    );
  }

  const { error: auditError } = await supabase.rpc(
    "record_business_document_download",
    {
      p_document_id: id,
    },
  );
  if (auditError) {
    console.error("business document download audit failed", auditError.code);
  }

  const headers = new Headers({
    "Cache-Control": "private, no-store",
    "Content-Disposition": attachmentDisposition(document.original_file_name),
    "Content-Type":
      nasResponse.headers["content-type"] ??
      document.mime_type ??
      "application/octet-stream",
    "X-Content-Type-Options": "nosniff",
  });
  for (const header of ["content-length", "content-range", "accept-ranges"]) {
    const value = nasResponse.headers[header];
    if (typeof value === "string") headers.set(header, value);
  }

  return new Response(
    Readable.toWeb(nasResponse) as ReadableStream<Uint8Array>,
    {
      status: nasResponse.statusCode,
      headers,
    },
  );
}
