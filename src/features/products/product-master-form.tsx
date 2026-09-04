import { saveProductFullAction } from "@/features/products/server-actions";

type ProductFormValue = {
  id?: string;
  code?: string;
  category?: "rice" | "oil" | "gift";
  source_category?: string;
  barcode?: string | null;
  brand?: string | null;
  short_name?: string;
  name?: string;
  name_en?: string | null;
  specification?: string | null;
  case_specification?: string | null;
  shelf_life?: string | null;
  tax_rate?: number | null;
  minimum_order?: string | null;
  stock_status?: string | null;
  supports_dropship?: boolean;
  is_recommended?: boolean;
  applicable_scenarios?: string | null;
  description?: string | null;
  delivery_notes?: string | null;
  invoice_notes?: string | null;
  alternative_product_codes?: string[];
  keywords?: string[];
  customer_query_reply?: string | null;
  out_of_stock_reply?: string | null;
  order_guide_reply?: string | null;
  status?: "draft" | "active" | "archived";
};

export function ProductMasterForm({
  product,
  prices,
}: {
  product?: ProductFormValue;
  prices?: Partial<Record<"procurement" | "retail" | "group" | "dropship", number>>;
}) {
  const input =
    "mt-1.5 h-10 w-full rounded-md border border-input bg-white px-3 text-xs text-foreground outline-none focus:border-primary/40";
  const textarea =
    "mt-1.5 min-h-24 w-full rounded-md border border-input bg-white p-3 text-xs leading-5 text-foreground outline-none focus:border-primary/40";
  return (
    <form action={saveProductFullAction} className="mt-5 space-y-5">
      {product?.id && <input name="productId" type="hidden" value={product.id} />}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          德馨产品编号 *
          <input className={input} defaultValue={product?.code} name="code" required />
        </label>
        <label className="text-xs text-muted-foreground">
          一级类别 *
          <select className={input} defaultValue={product?.category ?? "rice"} name="category">
            <option value="rice">大米</option>
            <option value="oil">食用油</option>
            <option value="gift">礼盒 / 组合</option>
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          原始类别
          <input className={input} defaultValue={product?.source_category} name="sourceCategory" />
        </label>
        <label className="text-xs text-muted-foreground">
          国际条形码
          <input className={input} defaultValue={product?.barcode ?? ""} name="barcode" />
        </label>
        <label className="text-xs text-muted-foreground">
          品牌
          <input className={input} defaultValue={product?.brand ?? ""} name="brand" />
        </label>
        <label className="text-xs text-muted-foreground">
          产品简称 *
          <input className={input} defaultValue={product?.short_name} name="shortName" required />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2">
          标准产品名称 *
          <input className={input} defaultValue={product?.name} name="name" required />
        </label>
        <label className="text-xs text-muted-foreground sm:col-span-2 xl:col-span-4">
          产品英文名称
          <input className={input} defaultValue={product?.name_en ?? ""} name="nameEn" />
        </label>
      </section>

      <section className="grid gap-3 rounded-lg bg-muted p-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs text-muted-foreground">
          规格
          <input className={input} defaultValue={product?.specification ?? ""} name="specification" />
        </label>
        <label className="text-xs text-muted-foreground">
          箱规
          <input className={input} defaultValue={product?.case_specification ?? ""} name="caseSpecification" />
        </label>
        <label className="text-xs text-muted-foreground">
          保质期
          <input className={input} defaultValue={product?.shelf_life ?? ""} name="shelfLife" />
        </label>
        <label className="text-xs text-muted-foreground">
          税率（%）
          <input className={input} defaultValue={Number(product?.tax_rate ?? 0) * 100} max="100" min="0" name="taxRatePercent" step="0.01" type="number" />
        </label>
        <label className="text-xs text-muted-foreground">
          含税集采自提价
          <input className={input} defaultValue={prices?.procurement} min="0" name="procurementPrice" step="0.01" type="number" />
        </label>
        <label className="text-xs text-muted-foreground">
          建议零售价
          <input className={input} defaultValue={prices?.retail} min="0" name="retailPrice" step="0.01" type="number" />
        </label>
        <label className="text-xs text-muted-foreground">
          团购价
          <input className={input} defaultValue={prices?.group} min="0" name="groupPrice" step="0.01" type="number" />
        </label>
        <label className="text-xs text-muted-foreground">
          一件代发价
          <input className={input} defaultValue={prices?.dropship} min="0" name="dropshipPrice" step="0.01" type="number" />
        </label>
        <label className="text-xs text-muted-foreground">
          起订量
          <input className={input} defaultValue={product?.minimum_order ?? ""} name="minimumOrder" />
        </label>
        <label className="text-xs text-muted-foreground">
          库存状态
          <input className={input} defaultValue={product?.stock_status ?? ""} name="stockStatus" />
        </label>
        <label className="text-xs text-muted-foreground">
          产品状态
          <select className={input} defaultValue={product?.status ?? "draft"} name="status">
            <option value="active">正式上架</option>
            <option value="draft">草稿</option>
            <option value="archived">归档</option>
          </select>
        </label>
        <div className="flex items-end gap-4 pb-2 text-xs text-muted-foreground">
          <label className="flex items-center gap-2">
            <input defaultChecked={product?.supports_dropship} name="supportsDropship" type="checkbox" />
            支持一件代发
          </label>
          <label className="flex items-center gap-2">
            <input defaultChecked={product?.is_recommended} name="isRecommended" type="checkbox" />
            推荐产品
          </label>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-muted-foreground">
          适用场景
          <textarea className={textarea} defaultValue={product?.applicable_scenarios ?? ""} name="applicableScenarios" />
        </label>
        <label className="text-xs text-muted-foreground">
          产品介绍
          <textarea className={textarea} defaultValue={product?.description ?? ""} name="description" />
        </label>
        <label className="text-xs text-muted-foreground">
          配送说明
          <textarea className={textarea} defaultValue={product?.delivery_notes ?? ""} name="deliveryNotes" />
        </label>
        <label className="text-xs text-muted-foreground">
          开票说明
          <textarea className={textarea} defaultValue={product?.invoice_notes ?? ""} name="invoiceNotes" />
        </label>
        <label className="text-xs text-muted-foreground">
          替代推荐产品编号（逗号分隔）
          <textarea className={textarea} defaultValue={product?.alternative_product_codes?.join("、")} name="alternativeProductCodes" />
        </label>
        <label className="text-xs text-muted-foreground">
          关键词（逗号分隔）
          <textarea className={textarea} defaultValue={product?.keywords?.join("、")} name="keywords" />
        </label>
      </section>

      <section className="grid gap-3 rounded-lg border border-border bg-muted p-4 lg:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          客户查询回复话术
          <textarea className={textarea} defaultValue={product?.customer_query_reply ?? ""} name="customerQueryReply" />
        </label>
        <label className="text-xs text-muted-foreground">
          缺货回复话术
          <textarea className={textarea} defaultValue={product?.out_of_stock_reply ?? ""} name="outOfStockReply" />
        </label>
        <label className="text-xs text-muted-foreground">
          下单引导话术
          <textarea className={textarea} defaultValue={product?.order_guide_reply ?? ""} name="orderGuideReply" />
        </label>
      </section>

      <div className="flex justify-end">
        <button className="h-10 rounded-md bg-primary px-5 text-xs font-medium text-white" type="submit">
          {product?.id ? "保存完整主档" : "创建产品"}
        </button>
      </div>
    </form>
  );
}
