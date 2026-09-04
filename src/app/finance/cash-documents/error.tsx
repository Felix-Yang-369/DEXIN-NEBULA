"use client";

import { useEffect, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { PlatformRouteStateShell } from "@/components/business/platform-route-state-shell";

export default function CashDocumentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retrying, beginRetry] = useTransition();

  useEffect(() => {
    console.error("cash documents route failed", error.digest ?? error.name);
  }, [error]);

  function retry() {
    beginRetry(() => {
      reset();
    });
  }

  return (
    <PlatformRouteStateShell>
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
        <section className="grid min-h-[620px] place-items-center rounded-md border border-border bg-white px-6 py-14 text-center">
          <div className="max-w-md">
            <span className="mx-auto grid size-14 place-items-center rounded-lg bg-muted text-foreground">
              <AlertTriangle className="size-6" />
            </span>
            <div className="mt-5 text-xs font-semibold tracking-[0.16em] text-foreground">
              DATA REQUEST FAILED
            </div>
            <h1 className="mt-3 text-xl font-semibold text-foreground">
              收付款单暂时无法加载
            </h1>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              数据请求没有成功。你可以立即重试；如果问题持续，请稍后再试或联系系统管理员。
            </p>
            {error.digest ? (
              <p className="mt-3 font-mono text-xs text-muted-foreground/70">
                错误编号：{error.digest}
              </p>
            ) : null}
            <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
              <button
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-xs font-medium text-white disabled:cursor-wait disabled:opacity-70"
                disabled={retrying}
                onClick={retry}
                type="button"
              >
                <RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} />
                {retrying ? "正在重试" : "重新加载"}
              </button>
              <Link
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-white px-5 text-xs text-foreground"
                href="/finance"
              >
                <ArrowLeft className="size-4" /> 返回财务中心
              </Link>
            </div>
          </div>
        </section>
      </main>
    </PlatformRouteStateShell>
  );
}
