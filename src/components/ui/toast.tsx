"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastTone = "success" | "danger" | "warning" | "info";

export type ToastInput = {
  title: string;
  description?: string;
  tone?: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};

type ToastItem = ToastInput & { id: number };

type ToastContextValue = {
  notify: (input: ToastInput) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const toneClasses: Record<ToastTone, string> = {
  success: "border-success/25 bg-success-surface text-success",
  danger: "border-danger/25 bg-danger-surface text-danger",
  warning: "border-attention/25 bg-attention-surface text-attention",
  info: "border-info/25 bg-info-surface text-info",
};

const toneIcons = {
  success: CheckCircle2,
  danger: AlertTriangle,
  warning: AlertTriangle,
  info: Info,
};

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: (id: number) => void;
}) {
  const tone = item.tone ?? "info";
  const Icon = toneIcons[tone];

  useEffect(() => {
    const timeout = window.setTimeout(
      () => onDismiss(item.id),
      item.duration ?? (tone === "danger" ? 8_000 : 4_500),
    );
    return () => window.clearTimeout(timeout);
  }, [item.duration, item.id, onDismiss, tone]);

  return (
    <div
      className={cn(
        "ui-overlay pointer-events-auto flex w-full items-start gap-3 border p-4",
        toneClasses[tone],
      )}
      role={tone === "danger" ? "alert" : "status"}
    >
      <Icon className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{item.title}</div>
        {item.description ? (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {item.description}
          </p>
        ) : null}
        {item.actionLabel && item.onAction ? (
          <button
            className="mt-2 text-xs font-medium underline underline-offset-4"
            onClick={() => {
              item.onAction?.();
              onDismiss(item.id);
            }}
            type="button"
          >
            {item.actionLabel}
          </button>
        ) : null}
      </div>
      <button
        aria-label="关闭提示"
        className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-white/60"
        onClick={() => onDismiss(item.id)}
        type="button"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const id = nextId.current++;
    setItems((current) => [...current.slice(-3), { ...input, id }]);
    return id;
  }, []);

  const value = useMemo(() => ({ dismiss, notify }), [dismiss, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions"
        className="pointer-events-none fixed inset-x-3 top-3 z-[100] ml-auto flex max-w-sm flex-col gap-2 sm:inset-x-auto sm:right-5 sm:top-20 sm:w-[360px]"
      >
        {items.map((item) => (
          <ToastCard item={item} key={item.id} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast 必须在 ToastProvider 内使用");
  }
  return context;
}
