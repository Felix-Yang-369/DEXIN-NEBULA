import Link from "next/link";
import { AlertTriangle, PackageOpen } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { InventoryWarningItem } from "@/types/dashboard";

const STATUS_STYLES: Record<InventoryWarningItem["status"], string> = {
  normal: "bg-[#e8f6ef] text-[#14745e]",
  warning: "bg-[#fff4e4] text-[#b37725]",
  danger: "bg-[#fff0f1] text-[#c95560]",
};

export function InventoryWarning({
  items,
}: {
  items: InventoryWarningItem[];
}) {
  return (
    <Card className="min-w-0 overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#ffffff_72%,#f8fbfa_100%)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d9e5ed] hover:shadow-[0_16px_42px_rgba(10,69,55,.07)]">
      <CardHeader>
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
            库存预警明细
          </h2>
          <p className="mt-1 text-[10px] text-[#8293a1]">
            来自仓储库存的实时可用数量
          </p>
        </div>
        <Link
          className="text-[10px] font-medium text-[#0d7580]"
          href="/inventory"
        >
          全部预警 →
        </Link>
      </CardHeader>
      <CardContent className="pt-4">
        {items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                className="group flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5 transition hover:border-[#e7eef3] hover:bg-white hover:shadow-[0_5px_14px_rgba(16,75,60,.04)]"
                href="/inventory"
                key={item.id}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf4f1] text-[#28725f]">
                  {item.status === "danger" ? (
                    <AlertTriangle className="size-4" />
                  ) : (
                    <PackageOpen className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-medium text-[#263c36]">
                    {item.name}
                  </div>
                  <div className="mt-0.5 truncate text-[9px] text-[#919d99]">
                    {item.sku}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-[10px] tabular-nums text-[#6e7c77]">
                    库存 {item.quantity} {item.unit}
                  </div>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[8px] font-medium ${STATUS_STYLES[item.status]}`}
                  >
                    {item.statusLabel}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-[#e9f5ef] text-[#19745f]">
                <PackageOpen className="size-4" />
              </span>
              <p className="mt-3 text-xs font-medium">暂无库存预警</p>
              <p className="mt-1 text-[10px] text-[#8293a1]">
                当前权限范围内没有异常库存
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
