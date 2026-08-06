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
    <section className="relative overflow-hidden rounded-[26px] border border-white/8 bg-[linear-gradient(118deg,#071d34_0%,#0a385d_50%,#0b2a47_100%)] px-6 py-8 text-white shadow-[0_24px_60px_-34px_rgba(7,29,52,.88),inset_0_1px_0_rgba(255,255,255,.08)] sm:px-8 lg:px-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.16] [background-image:linear-gradient(rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:38px_38px] [mask-image:linear-gradient(90deg,transparent,black)]"
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-[58%] opacity-70">
        <div className="absolute right-[8%] top-1/2 size-56 -translate-y-1/2 rounded-full border border-[#6bd7d4]/20 bg-[radial-gradient(circle,rgba(24,175,179,.28)_0%,rgba(10,56,93,.08)_56%,transparent_70%)] sm:size-72" />
        <svg
          aria-hidden="true"
          className="absolute inset-0 size-full"
          viewBox="0 0 700 190"
        >
          <defs>
            <linearGradient id="flow" x1="0" x2="1">
              <stop offset="0" stopColor="#6bd7d4" stopOpacity="0" />
              <stop offset=".5" stopColor="#6bd7d4" stopOpacity=".62" />
              <stop offset="1" stopColor="#6bd7d4" stopOpacity="0" />
            </linearGradient>
          </defs>
          <ellipse
            cx="430"
            cy="95"
            fill="none"
            rx="190"
            ry="42"
            stroke="url(#flow)"
            strokeWidth="1"
            transform="rotate(-8 430 95)"
          />
          <ellipse
            cx="430"
            cy="95"
            fill="none"
            rx="95"
            ry="78"
            stroke="#6bd7d4"
            strokeDasharray="3 8"
            strokeOpacity=".26"
          />
          <path
            d="M70 125C180 80 250 132 340 96S520 38 660 80"
            fill="none"
            stroke="url(#flow)"
          />
          {[140, 270, 365, 505, 610].map((cx, index) => (
            <circle
              cx={cx}
              cy={[101, 112, 86, 63, 76][index]}
              fill="#79dedb"
              key={cx}
              opacity=".72"
              r="2.5"
            />
          ))}
        </svg>
      </div>

      <div className="relative flex flex-col justify-between gap-7 lg:flex-row lg:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.065] px-3 py-1.5 text-[10px] font-medium text-[#9ee7e4] backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[#6bd7d4] shadow-[0_0_12px_rgba(107,215,212,.82)]" />
            {date.format("YYYY年M月D日 · dddd")}
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-[-0.04em] sm:text-[31px]">
            欢迎回来，{name}
          </h1>
          <p className="mt-3 flex items-center gap-2 text-[13px] text-white/58">
            <DatabaseZap className="size-4 text-[#79deda]" />
            今日经营数据已更新 · 今天是你在德馨的第{" "}
            {daysAtDexin(generatedAt)} 天
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            className="inline-flex h-11 items-center gap-3 rounded-full bg-white px-5 text-xs font-medium text-[#0a385d] shadow-[0_10px_28px_rgba(0,0,0,.16)] transition duration-200 hover:-translate-y-0.5 hover:bg-[#eef8fa] hover:shadow-[0_14px_32px_rgba(0,0,0,.2)]"
            href="/approvals"
          >
            发起申请
            <span className="grid size-6 place-items-center rounded-full bg-[#0d7580] text-white">
              <ArrowRight className="size-3.5" />
            </span>
          </Link>
          <Link
            className="inline-flex h-11 items-center rounded-full border border-white/25 bg-white/[0.065] px-5 text-xs font-medium text-white/82 backdrop-blur-sm transition duration-200 hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/12 hover:text-white"
            href="/finance"
          >
            查看业务数据
          </Link>
        </div>
      </div>
    </section>
  );
}
