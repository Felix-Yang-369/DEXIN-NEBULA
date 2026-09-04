import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ProductRankingItem } from "@/types/dashboard";

export function ProductRanking({ items }: { items: ProductRankingItem[] }) {
  return (
    <Card className="min-w-0 overflow-hidden bg-card transition duration-200  hover:border-border ">
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
              产品销售 TOP5
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
              实时
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground">
            近 30 天销售订单商品金额汇总
          </p>
        </div>
        <span className="text-xs text-foreground">本月</span>
      </CardHeader>
      <CardContent className="pt-5">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                className="group grid grid-cols-[26px_minmax(0,1fr)_44px] items-center gap-3 rounded-md px-1 py-1 transition-colors hover:bg-muted"
                key={item.rank}
              >
                <span
                  className={`grid size-6 place-items-center rounded-lg text-xs font-semibold tabular-nums ${
                    item.rank === 1
                      ? "bg-muted text-foreground "
                      : "bg-muted text-foreground"
                  }`}
                >
                  {item.rank}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-xs font-medium text-foreground">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-xs text-foreground">
                      ¥{Math.round(item.salesAmount / 10000)}万
                    </span>
                  </div>
                  <Progress className="mt-2" value={item.share} />
                </div>
                <span className="text-right text-xs font-medium tabular-nums text-foreground">
                  {item.share}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center text-xs text-foreground">
            暂无产品销售数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
