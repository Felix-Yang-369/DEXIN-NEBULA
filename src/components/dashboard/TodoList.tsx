import Link from "next/link";
import dayjs from "dayjs";
import { ClipboardCheck, ReceiptText, Stamp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DashboardTodo } from "@/types/dashboard";

export function TodoList({ items }: { items: DashboardTodo[] }) {
  return (
    <Card className="min-w-0 overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#ffffff_72%,#f8fbfa_100%)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d9e5ed] hover:shadow-[0_16px_42px_rgba(10,69,55,.07)]">
      <CardHeader>
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
            我的待办
          </h2>
          <p className="mt-1 text-[10px] text-[#8293a1]">
            分配给当前账号的真实审批事项
          </p>
        </div>
        <span className="rounded-full bg-[#e8f4ef] px-2.5 py-1 text-[9px] font-medium text-[#15715d]">
          {items.length} 项
        </span>
      </CardHeader>
      <CardContent className="pt-4">
        {items.length > 0 ? (
          <>
            <div className="space-y-3">
              {items.map((item) => {
                const Icon =
                  item.kind === "expense"
                    ? ReceiptText
                    : item.kind === "seal"
                      ? Stamp
                      : ClipboardCheck;
                return (
                  <Link
                    className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-[#e7eef3] hover:bg-white hover:shadow-[0_5px_14px_rgba(16,75,60,.04)]"
                    href={item.href}
                    key={item.id}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-xl ${
                        item.kind === "expense"
                          ? "bg-[#eaf1fb] text-[#4977b9]"
                          : item.kind === "seal"
                            ? "bg-[#f3edfa] text-[#815eab]"
                          : "bg-[#e7f5ef] text-[#0b8169]"
                      }`}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium text-[#263c36]">
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-[9px] text-[#939e9a]">
                        发起人：{item.applicant}
                      </div>
                    </div>
                    <span className="shrink-0 text-[10px] tabular-nums text-[#83908c]">
                      {dayjs(item.time).format("HH:mm")}
                    </span>
                  </Link>
                );
              })}
            </div>
            <Link
              className="mt-5 inline-flex text-[10px] font-medium text-[#0d7580]"
              href="/approvals"
            >
              查看全部待办 →
            </Link>
          </>
        ) : (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#e9f5ef] text-[#19745f]">
                <ClipboardCheck className="size-4" />
              </span>
              <p className="mt-3 text-xs font-medium">当前没有待办</p>
              <p className="mt-1 text-[10px] text-[#8293a1]">
                新审批到达后会显示在这里
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
