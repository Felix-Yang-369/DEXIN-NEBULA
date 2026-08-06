"use client";

import { Printer } from "lucide-react";

export function QuotePrintButton() {
  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#dce6e2] bg-white px-4 text-[11px] font-medium text-[#36554c] shadow-[0_5px_16px_rgba(22,70,58,.04)] transition hover:-translate-y-0.5 hover:border-[#187966]/25 hover:text-[#0b6d5c] print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      <Printer className="size-3.5" />
      打印 / 另存 PDF
    </button>
  );
}
