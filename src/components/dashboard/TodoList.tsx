import Link from "next/link";
import dayjs from "dayjs";
import { ClipboardCheck, ReceiptText, Stamp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DashboardTodo } from "@/types/dashboard";

export function TodoList({ items }: { items: DashboardTodo[] }) {
  return (
    <Card className="min-w-0 overflow-hidden bg-card transition duration-200  hover:border-border ">
      <CardHeader>
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
            我的待办
          </h2>
          <p className="mt-1 text-xs text-foreground">
            分配给当前账号的真实审批事项
          </p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
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
                    className="group flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-white "
                    href={item.href}
                    key={item.id}
                  >
                    <span
                      className={`grid size-8 shrink-0 place-items-center rounded-md ${
                        item.kind === "expense"
                          ? "bg-info-surface text-info"
                          : item.kind === "seal"
                            ? "bg-intelligence-surface text-intelligence"
                            : item.kind === "sales_order"
                              ? "bg-primary/8 text-primary"
                              : "bg-attention-surface text-attention"
                      }`}
                    >
                      <Icon className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-foreground">
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        发起人：{item.applicant}
                      </div>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-foreground">
                      {dayjs(item.time).format("HH:mm")}
                    </span>
                  </Link>
                );
              })}
            </div>
            <Link
              className="mt-5 inline-flex text-xs font-medium text-foreground"
              href="/approvals"
            >
              查看全部待办 →
            </Link>
          </>
        ) : (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-foreground">
                <ClipboardCheck className="size-4" />
              </span>
              <p className="mt-3 text-xs font-medium">当前没有待办</p>
              <p className="mt-1 text-xs text-foreground">
                新审批到达后会显示在这里
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
