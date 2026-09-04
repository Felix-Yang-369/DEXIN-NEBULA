"use client";

import Link from "next/link";
import dayjs from "dayjs";
import "dayjs/locale/zh-cn";
import { ArrowRight, DatabaseZap } from "lucide-react";

function daysAtDexin(generatedAt: string) {
  const start = dayjs("2026-06-13").startOf("day");
  return Math.max(1, dayjs(generatedAt).startOf("day").diff(start, "day") + 1);
}

export function WelcomeBanner({
  name,
  generatedAt,
}: {
  name: string;
  generatedAt: string;
}) {
  const date = dayjs(generatedAt).locale("zh-cn");

  return (
    <section className="flex flex-col justify-between gap-5 border-b border-border py-5 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            {date.format("YYYY年M月D日 · dddd")}
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            欢迎回来，{name}
          </h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <DatabaseZap className="size-4" />
            今日经营数据已更新 · 今天是你在德馨的第{" "}
            {daysAtDexin(generatedAt)} 天
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/85"
            href="/approvals"
          >
            发起申请
            <ArrowRight className="size-4" />
          </Link>
          <Link
            className="inline-flex h-9 items-center rounded-md border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            href="/finance"
          >
            查看业务数据
          </Link>
        </div>
    </section>
  );
}
