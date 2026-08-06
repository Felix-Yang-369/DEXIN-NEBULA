import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ProductRankingItem } from "@/types/dashboard";

export function ProductRanking({ items }: { items: ProductRankingItem[] }) {
  return (
    <Card className="min-w-0 overflow-hidden bg-[linear-gradient(145deg,#ffffff_0%,#ffffff_72%,#f8fbfa_100%)] transition duration-200 hover:-translate-y-0.5 hover:border-[#d9e5ed] hover:shadow-[0_16px_42px_rgba(10,69,55,.07)]">
      <CardHeader>
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]">
              产品销售 TOP5
            </h2>
            <span className="rounded-full bg-[#fff4e3] px-2 py-0.5 text-[8px] font-medium text-[#a8752c]">
              演示
            </span>
          </div>
          <p className="mt-1 text-[10px] text-[#8293a1]">
            销售明细接入后按真实商品统计
          </p>
        </div>
        <span className="text-[10px] text-[#7d8b86]">本月</span>
      </CardHeader>
      <CardContent className="pt-5">
        {items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                className="group grid grid-cols-[26px_minmax(0,1fr)_44px] items-center gap-3 rounded-xl px-1 py-1 transition-colors hover:bg-[#f7faf8]"
                key={item.rank}
              >
                <span
                  className={`grid size-6 place-items-center rounded-lg text-[10px] font-semibold tabular-nums ${
                    item.rank === 1
                      ? "bg-[#e8f5ef] text-[#0c8068] shadow-[inset_0_0_0_1px_rgba(12,128,104,.08)]"
                      : "bg-[#f1f5f3] text-[#71807b]"
                  }`}
                >
                  {item.rank}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-[11px] font-medium text-[#263c36]">
                      {item.name}
                    </span>
                    <span className="shrink-0 text-[9px] text-[#899590]">
                      ¥{Math.round(item.salesAmount / 10000)}万
                    </span>
                  </div>
                  <Progress className="mt-2" value={item.share} />
                </div>
                <span className="text-right text-[10px] font-medium tabular-nums text-[#52635d]">
                  {item.share}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid min-h-48 place-items-center text-xs text-[#8293a1]">
            暂无产品销售数据
          </div>
        )}
      </CardContent>
    </Card>
  );
}
