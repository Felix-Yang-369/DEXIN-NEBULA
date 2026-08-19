"use client";

import { Printer } from "lucide-react";

export function CashDocumentPrintButton() {
  return (
    <button
      className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-[10px] text-white transition hover:bg-white/15 print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      <Printer className="size-3.5" /> 打印当前台账
    </button>
  );
}
