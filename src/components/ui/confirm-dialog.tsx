"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, X } from "lucide-react";

export function ConfirmDialog({
  confirmLabel = "确认",
  description,
  impact,
  objectName,
  onCancel,
  onConfirm,
  open,
  pending = false,
  title,
  tone = "danger",
}: {
  confirmLabel?: string;
  description: string;
  impact?: string;
  objectName?: string;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  pending?: boolean;
  title: string;
  tone?: "danger" | "primary";
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, open, pending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center p-4">
      <button
        aria-label="关闭确认窗口"
        className="absolute inset-0 bg-foreground/40"
        disabled={pending}
        onClick={onCancel}
        type="button"
      />
      <section
        aria-describedby="confirm-dialog-description"
        aria-labelledby="confirm-dialog-title"
        aria-modal="true"
        className="ui-overlay relative w-full max-w-md p-5 sm:p-6"
        role="alertdialog"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-danger-surface text-danger">
            <AlertTriangle className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold" id="confirm-dialog-title">
              {title}
            </h2>
            <p
              className="mt-2 text-sm leading-6 text-muted-foreground"
              id="confirm-dialog-description"
            >
              {description}
            </p>
          </div>
          <button
            aria-label="关闭"
            className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
            disabled={pending}
            onClick={onCancel}
            type="button"
          >
            <X className="size-4" />
          </button>
        </div>
        {objectName ? (
          <div className="mt-4 border-l-2 border-primary bg-muted px-3 py-2 text-sm">
            {objectName}
          </div>
        ) : null}
        {impact ? (
          <p className="mt-3 text-xs leading-5 text-danger">影响：{impact}</p>
        ) : null}
        <div className="mt-6 flex justify-end gap-2">
          <button
            className="h-9 rounded-md border border-border bg-white px-4 text-sm"
            disabled={pending}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            取消
          </button>
          <button
            className={
              tone === "danger"
                ? "h-9 rounded-md bg-danger px-4 text-sm text-white disabled:opacity-60"
                : "h-9 rounded-md bg-primary px-4 text-sm text-white disabled:opacity-60"
            }
            disabled={pending}
            onClick={onConfirm}
            type="button"
          >
            {pending ? "处理中…" : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
