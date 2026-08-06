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
  tone: string;
  enabled: boolean;
}> = [
  {
    label: "请假申请",
    href: "/requests/leave",
    icon: CalendarDays,
    tone: "bg-[#e7f5ef] text-[#0b8069]",
    enabled: true,
  },
  {
    label: "报销申请",
    href: "/requests/expense",
    icon: BadgeCheck,
    tone: "bg-[#eaf1fb] text-[#4c78bb]",
    enabled: true,
  },
  {
    label: "采购申请",
    href: "/approvals",
    icon: ShoppingCart,
    tone: "bg-[#fff3e1] text-[#c1812c]",
    enabled: false,
  },
  {
    label: "用印申请",
    href: "/requests/seal",
    icon: FilePenLine,
    tone: "bg-[#f3edfa] text-[#815eab]",
    enabled: true,
  },
  {
    label: "提交周报",
    href: "/reports/weekly",
    icon: NotebookPen,
    tone: "bg-[#eaf4f4] text-[#397479]",
    enabled: true,
  },
  {
    label: "查看通讯录",
    href: "/organization",
    icon: BookUser,
    tone: "bg-[#fff0f1] text-[#c65c65]",
    enabled: true,
  },
];

export function QuickActions() {
  return (
    <Card className="overflow-hidden bg-[linear-gradient(135deg,#ffffff_0%,#fbfcfe_58%,#f4faf7_100%)] p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
            快捷入口
          </h2>
          <p className="mt-1 text-[10px] text-[#8293a1]">
            常用办公流程与业务应用
          </p>
        </div>
        <Link className="text-[10px] font-medium text-[#0d7580]" href="/help">
          使用指南
        </Link>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              aria-disabled={!action.enabled}
              className={`group relative flex h-[68px] items-center justify-center gap-3 overflow-hidden rounded-2xl border border-[#e4ece8] bg-white/78 px-3 text-[11px] font-medium shadow-[0_5px_16px_rgba(21,70,58,.025)] transition duration-200 ${
                action.enabled
                  ? "hover:-translate-y-1 hover:border-[#0d7e69]/18 hover:bg-white hover:shadow-[0_12px_26px_rgba(16,82,65,.08)]"
                  : "cursor-not-allowed opacity-55"
              }`}
              href={action.enabled ? action.href : "#"}
              key={action.label}
            >
              <span
                className={`grid size-9 place-items-center rounded-xl shadow-[inset_0_0_0_1px_rgba(255,255,255,.45)] transition-transform duration-200 group-hover:scale-110 ${action.tone}`}
              >
                <Icon className="size-4" />
              </span>
              {action.label}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
