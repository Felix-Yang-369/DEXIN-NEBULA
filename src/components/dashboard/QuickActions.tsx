import Link from "next/link";
import {
  BadgeCheck,
  BookUser,
  CalendarDays,
  FilePenLine,
  NotebookPen,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";

const QUICK_ACTIONS: Array<{
  label: string;
  href: string;
  icon: LucideIcon;
  enabled: boolean;
}> = [
  {
    label: "请假申请",
    href: "/requests/leave",
    icon: CalendarDays,
    enabled: true,
  },
  {
    label: "报销申请",
    href: "/requests/expense",
    icon: BadgeCheck,
    enabled: true,
  },
  {
    label: "采购申请",
    href: "/approvals",
    icon: ShoppingCart,
    enabled: false,
  },
  {
    label: "用印申请",
    href: "/requests/seal",
    icon: FilePenLine,
    enabled: true,
  },
  {
    label: "提交周报",
    href: "/reports/weekly",
    icon: NotebookPen,
    enabled: true,
  },
  {
    label: "查看通讯录",
    href: "/organization",
    icon: BookUser,
    enabled: true,
  },
];

export function QuickActions() {
  return (
    <Card className="overflow-hidden bg-card p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
            快捷入口
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            常用办公流程与业务应用
          </p>
        </div>
        <Link className="text-xs font-medium text-primary" href="/help">
          使用指南
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              aria-disabled={!action.enabled}
              className={`flex h-12 items-center gap-3 border-t border-border px-3 text-sm font-medium transition-colors first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 ${
                action.enabled
                  ? "hover:bg-muted"
                  : "cursor-not-allowed opacity-55"
              }`}
              href={action.enabled ? action.href : "#"}
              key={action.label}
            >
              <Icon className="size-4 shrink-0 text-primary" />
              {action.label}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
