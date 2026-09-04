"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export function ApplicationErrorState({
  error,
  reset,
  title = "页面暂时无法加载",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  const [retrying, beginRetry] = useTransition();

  useEffect(() => {
    console.error("application route failed", error.digest ?? error.name);
  }, [error]);

  return (
    <main className="grid min-h-svh place-items-center bg-muted p-5" role="alert">
      <section className="w-full max-w-lg rounded-md border border-border bg-white px-7 py-12 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-lg bg-danger-surface text-danger">
          <AlertTriangle className="size-6" />
        </span>
        <h1 className="mt-5 text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          数据请求没有成功。你可以重新加载；如果问题持续，请保留错误编号并联系管理员。
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            错误编号：{error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-xs font-medium text-white disabled:cursor-wait disabled:opacity-70"
            disabled={retrying}
            onClick={() => beginRetry(reset)}
            type="button"
          >
            <RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "正在重试" : "重新加载"}
          </button>
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-5 text-xs text-foreground"
            href="/dashboard"
          >
            <Home className="size-4" /> 返回工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
