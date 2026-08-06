import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";

type TableProduct = {
  id: string;
  code: string;
  image_path: string | null;
  barcode: string | null;
  category: "rice" | "oil" | "gift";
  brand: string | null;
  name: string;
  specification: string | null;
  case_specification: string | null;
  shelf_life: string | null;
  tax_rate: number | null;
  minimum_order: string | null;
  stock_status: string | null;
  supports_dropship: boolean;
  is_recommended: boolean;
  status: "draft" | "active" | "archived";
};

type PriceType = "procurement" | "retail" | "group" | "dropship";

const categoryLabels = { rice: "大米", oil: "食用油", gift: "礼盒" };
const statusLabels = { draft: "草稿", active: "上架", archived: "归档" };

function money(value?: number) {
  return value === undefined
    ? "—"
    : `¥${new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: 2,
      }).format(value)}`;
}

export function ProductMasterTable({
  products,
  prices,
  imageUrls,
  query,
}: {
  products: TableProduct[];
  prices: Record<string, Partial<Record<PriceType, number>>>;
  imageUrls: Record<string, string>;
  query: Record<string, string | undefined>;
}) {
  const hrefFor = (productId: string) => {
    const search = new URLSearchParams();
    Object.entries({ ...query, product: productId, view: "table" }).forEach(
      ([key, value]) => {
        if (value) search.set(key, value);
      },
    );
    return `/products?${search.toString()}`;
  };

  const header =
    "whitespace-nowrap border-b border-r border-[#e4ebe8] bg-[#f5f8fb] px-3 py-3 text-left text-[10px] font-medium text-[#61766e]";
  const cell =
    "whitespace-nowrap border-b border-r border-[#eaf0f4] px-3 py-2.5 text-[11px] text-[#40564f]";

  return (
    <section className="mt-5 overflow-hidden rounded-[22px] border border-border/75 bg-white shadow-[0_12px_38px_-30px_rgba(19,57,48,.42)]">
      <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">产品主数据表</h2>
          <p className="mt-1 text-[10px] text-muted-foreground">
            横向浏览产品、价格和供货信息，点击任意行查看或编辑完整主档
          </p>
        </div>
        <span className="rounded-full bg-[#eef6f2] px-3 py-1.5 text-[10px] text-[#176d78]">
          {products.length} 条
        </span>
      </div>
      <div className="max-h-[680px] overflow-auto">
        <table className="min-w-[1900px] border-separate border-spacing-0">
          <thead className="sticky top-0 z-20">
            <tr>
              <th className={`${header} sticky left-0 z-30 w-20`}>产品图</th>
              <th className={`${header} sticky left-20 z-30`}>德馨产品编号</th>
              <th className={header}>国际条形码</th>
              <th className={header}>类别</th>
              <th className={header}>品牌</th>
              <th className={header}>标准产品名称</th>
              <th className={header}>规格</th>
              <th className={header}>箱规</th>
              <th className={header}>保质期</th>
              <th className={header}>税率</th>
              <th className={header}>含税集采价</th>
              <th className={header}>建议零售价</th>
              <th className={header}>团购价</th>
              <th className={header}>一件代发价</th>
              <th className={header}>起订量</th>
              <th className={header}>库存状态</th>
              <th className={header}>一件代发</th>
              <th className={header}>推荐</th>
              <th className={header}>状态</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product, index) => {
              const productPrices = prices[product.id] ?? {};
              const imageUrl = product.image_path
                ? imageUrls[product.image_path]
                : undefined;
              return (
                <tr
                  className={`transition-colors hover:bg-[#eff7f3] ${
                    index % 2 ? "bg-[#fbfcfc]" : "bg-white"
                  }`}
                  key={product.id}
                >
                  <td className={`${cell} sticky left-0 z-10 bg-inherit`}>
                    <Link
                      className="grid size-10 place-items-center overflow-hidden rounded-xl bg-[#f1f5f3]"
                      href={hrefFor(product.id)}
                    >
                      {imageUrl ? (
                        <Image
                          alt={product.name}
                          className="size-full object-contain p-0.5"
                          height={56}
                          src={imageUrl}
                          unoptimized
                          width={56}
                        />
                      ) : (
                        <ImageOff className="size-4 text-muted-foreground" />
                      )}
                    </Link>
                  </td>
                  <td className={`${cell} sticky left-20 z-10 bg-inherit`}>
                    <Link
                      className="font-semibold text-[#235d4e] hover:underline"
                      href={hrefFor(product.id)}
                    >
                      {product.code}
                    </Link>
                  </td>
                  <td className={cell}>{product.barcode || "待确认"}</td>
                  <td className={cell}>{categoryLabels[product.category]}</td>
                  <td className={cell}>{product.brand || "—"}</td>
                  <td className={`${cell} max-w-[320px] truncate font-medium`}>
                    {product.name}
                  </td>
                  <td className={cell}>{product.specification || "—"}</td>
                  <td className={cell}>{product.case_specification || "—"}</td>
                  <td className={cell}>{product.shelf_life || "—"}</td>
                  <td className={cell}>
                    {product.tax_rate === null
                      ? "—"
                      : `${Number(product.tax_rate) * 100}%`}
                  </td>
                  <td className={cell}>{money(productPrices.procurement)}</td>
                  <td className={cell}>{money(productPrices.retail)}</td>
                  <td className={cell}>{money(productPrices.group)}</td>
                  <td className={cell}>{money(productPrices.dropship)}</td>
                  <td className={cell}>{product.minimum_order || "—"}</td>
                  <td className={cell}>{product.stock_status || "待确认"}</td>
                  <td className={cell}>
                    {product.supports_dropship ? "支持" : "不支持"}
                  </td>
                  <td className={cell}>{product.is_recommended ? "是" : "否"}</td>
                  <td className={cell}>
                    <span
                      className={`rounded-full px-2 py-1 text-[9px] ${
                        product.status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : product.status === "draft"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {statusLabels[product.status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
