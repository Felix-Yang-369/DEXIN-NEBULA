"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function UnsavedChangesGuard({
  dirty,
  message = "当前页面还有未保存的修改，离开后这些内容将丢失。",
  onDiscard,
}: {
  dirty: boolean;
  message?: string;
  onDiscard?: () => void;
}) {
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const interceptNavigation = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const link = target?.closest<HTMLAnchorElement>("a[href]");
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.href === window.location.href) return;
      event.preventDefault();
      setPendingHref(`${destination.pathname}${destination.search}${destination.hash}`);
    };
    document.addEventListener("click", interceptNavigation, true);
    return () => document.removeEventListener("click", interceptNavigation, true);
  }, [dirty]);

  const discard = useCallback(() => {
    if (!pendingHref) return;
    onDiscard?.();
    const href = pendingHref;
    setPendingHref(null);
    router.push(href);
  }, [onDiscard, pendingHref, router]);

  return (
    <ConfirmDialog
      confirmLabel="放弃修改并离开"
      description={message}
      impact="未保存的数据无法恢复"
      onCancel={() => setPendingHref(null)}
      onConfirm={discard}
      open={Boolean(pendingHref)}
      title="确认离开当前页面？"
    />
  );
}
