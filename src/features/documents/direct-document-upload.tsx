"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Upload } from "lucide-react";
import { uploadBusinessDocument } from "@/features/documents/server-actions";

const inputId = "direct-business-document-file";

function titleFromFileName(fileName: string) {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "").trim();
  const title =
    withoutExtension.length >= 2
      ? withoutExtension
      : `文件-${withoutExtension || "未命名"}`;
  return title.slice(0, 160);
}

export function DirectDocumentUpload({
  folderId,
}: {
  folderId: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!folderId) {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-muted px-4 text-xs font-medium text-muted-foreground">
        <Upload className="size-3.5" />
        上传
      </span>
    );
  }

  return (
    <form action={uploadBusinessDocument} ref={formRef}>
      <input name="folderId" type="hidden" value={folderId} />
      <input name="category" type="hidden" value="internal" />
      <input name="visibility" type="hidden" value="department" />
      <input name="title" ref={titleRef} type="hidden" />
      <input
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx"
        className="sr-only"
        id={inputId}
        name="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file || !titleRef.current || !formRef.current) return;
          titleRef.current.value = titleFromFileName(file.name);
          setUploading(true);
          formRef.current.requestSubmit();
        }}
        required
        type="file"
      />
      <label
        aria-disabled={uploading}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-white ${uploading ? "pointer-events-none cursor-wait opacity-75" : "cursor-pointer"}`}
        htmlFor={inputId}
      >
        {uploading ? (
          <LoaderCircle className="size-3.5 animate-spin" />
        ) : (
          <Upload className="size-3.5" />
        )}
        {uploading ? "上传中…" : "上传"}
      </label>
      <span aria-live="polite" className="sr-only">
        {uploading ? "文件正在上传" : ""}
      </span>
    </form>
  );
}
