"use client";

import { Printer } from "lucide-react";

export function QuotePrintButton() {
  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-xs font-medium text-foreground  transition  hover:border-border hover:text-foreground print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      <Printer className="size-3.5" />
      打印 / 另存 PDF
    </button>
  );
}
