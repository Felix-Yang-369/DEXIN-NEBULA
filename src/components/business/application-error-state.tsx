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
    <main className="grid min-h-svh place-items-center bg-[#f5f8fb] p-5">
      <section className="w-full max-w-lg rounded-[26px] border border-[#ead3d3] bg-white px-7 py-12 text-center shadow-[0_24px_70px_-54px_rgba(6,24,44,.7)]">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#fff2ef] text-[#a35e4f]">
          <AlertTriangle className="size-6" />
        </span>
        <div className="mt-5 text-[10px] font-semibold tracking-[0.16em] text-[#a35e4f]">
          REQUEST FAILED
        </div>
        <h1 className="mt-3 text-xl font-semibold text-[#12324a]">{title}</h1>
        <p className="mt-3 text-xs leading-6 text-[#687b8d]">
          数据请求没有成功。你可以重新加载；如果问题持续，请保留错误编号并联系管理员。
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-[9px] text-[#687b8d]/75">
            错误编号：{error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0a385d] px-5 text-xs font-medium text-white disabled:cursor-wait disabled:opacity-70"
            disabled={retrying}
            onClick={() => beginRetry(reset)}
            type="button"
          >
            <RefreshCw className={`size-4 ${retrying ? "animate-spin" : ""}`} />
            {retrying ? "正在重试" : "重新加载"}
          </button>
          <Link
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#dce6ed] bg-white px-5 text-xs text-[#526a78]"
            href="/dashboard"
          >
            <Home className="size-4" /> 返回工作台
          </Link>
        </div>
      </section>
    </main>
  );
}
