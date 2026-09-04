import Link from "next/link";
import { AlertTriangle, PackageOpen } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { InventoryWarningItem } from "@/types/dashboard";

const STATUS_STYLES: Record<InventoryWarningItem["status"], string> = {
  normal: "bg-success-surface text-success",
  warning: "bg-attention-surface text-attention",
  danger: "bg-danger-surface text-danger",
};

export function InventoryWarning({
  items,
}: {
  items: InventoryWarningItem[];
}) {
  return (
    <Card className="min-w-0 overflow-hidden bg-card transition duration-200  hover:border-border ">
      <CardHeader>
        <div>
          <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
            库存预警明细
          </h2>
          <p className="mt-1 text-xs text-foreground">
            来自仓储库存的实时可用数量
          </p>
        </div>
        <Link
          className="text-xs font-medium text-foreground"
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
                className="group flex items-center gap-3 rounded-md border border-transparent px-2 py-1.5 transition hover:border-border hover:bg-white "
                href="/inventory"
                key={item.id}
              >
                <span className={`grid size-9 shrink-0 place-items-center rounded-md ${STATUS_STYLES[item.status]}`}>
                  {item.status === "danger" ? (
                    <AlertTriangle className="size-4" />
                  ) : (
                    <PackageOpen className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-medium text-foreground">
                    {item.name}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.sku}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs tabular-nums text-foreground">
                    库存 {item.quantity} {item.unit}
                  </div>
                  <span
                    className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[item.status]}`}
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
              <span className="mx-auto grid size-10 place-items-center rounded-full bg-muted text-foreground">
                <PackageOpen className="size-4" />
              </span>
              <p className="mt-3 text-xs font-medium">暂无库存预警</p>
              <p className="mt-1 text-xs text-foreground">
                当前权限范围内没有异常库存
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
