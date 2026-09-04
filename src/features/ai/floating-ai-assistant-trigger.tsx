"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { DexiaoxinAvatar } from "@/components/brand/dexiaoxin-avatar";

const FloatingAiAssistantPanel = dynamic(
  () =>
    import("@/features/ai/floating-ai-assistant").then(
      (module) => module.FloatingAiAssistantPanel,
    ),
  { ssr: false },
);

function preloadAssistant() {
  void import("@/features/ai/floating-ai-assistant");
}

export function FloatingAiAssistantTrigger({
  configured,
}: {
  configured: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const minimize = useCallback(() => setOpen(false), []);

  if (
    pathname === "/login" ||
    pathname.startsWith("/ai") ||
    pathname.startsWith("/customer-service/widget")
  ) {
    return null;
  }

  if (open) {
    return (
      <FloatingAiAssistantPanel
        configured={configured}
        onMinimize={minimize}
      />
    );
  }

  return (
    <button
      aria-label="打开德小馨 AI 助手"
      className="ui-overlay group fixed bottom-20 right-3 z-[90] grid size-14 place-items-center rounded-full border-border/80 p-1 transition hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-offset-2 sm:right-6 lg:bottom-6"
      onClick={() => setOpen(true)}
      onFocus={preloadAssistant}
      onMouseEnter={preloadAssistant}
      title={configured ? "打开德小馨 AI 助手" : "德小馨等待管理员配置"}
      type="button"
    >
      <DexiaoxinAvatar className="size-12 rounded-full border-0 bg-transparent ring-0" />
      <span
        aria-hidden="true"
        className={`absolute bottom-0.5 right-0.5 size-3 rounded-full border-2 border-white ${
          configured ? "bg-success" : "bg-warning"
        }`}
      />
    </button>
  );
}
