"use client";
import { Printer } from "lucide-react";
export function PrintButton() {
  return (
    <button
      className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs text-white print:hidden"
      onClick={() => window.print()}
    >
      <Printer className="size-4" />
      打印预览
    </button>
  );
}
