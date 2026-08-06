import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.redirect(new URL("/documents?error=文件不存在", request.url));
  }

  const supabase = await createClient();
  const { data: document } = await supabase
    .from("business_documents")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!document) {
    return NextResponse.redirect(
      new URL("/documents?error=文件不存在或无权下载", request.url),
    );
  }

  const { data, error } = await supabase.storage
    .from("business-documents")
    .createSignedUrl(document.storage_path, 60, { download: true });

  if (error || !data.signedUrl) {
    return NextResponse.redirect(
      new URL("/documents?error=下载链接生成失败", request.url),
    );
  }

  await supabase.rpc("record_business_document_download", {
    p_document_id: id,
  });

  return NextResponse.redirect(data.signedUrl);
}
