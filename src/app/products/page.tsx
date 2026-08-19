import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  BadgeCheck,
  Barcode,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Download,
  Gift,
  ImagePlus,
  ImageOff,
  LayoutGrid,
  PackageSearch,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  TableProperties,
  Wheat,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { ProductMasterForm } from "@/features/products/product-master-form";
import { ProductMasterTable } from "@/features/products/product-master-table";
import { uploadProductImageAction } from "@/features/products/server-actions";
import {
  getProductQualityFlags,
  type ProductQualityFlag,
} from "@/features/products/quality";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "产品中心",
  description: "德馨星云产品主数据、图片、规格与价格策略管理",
};

export const dynamic = "force-dynamic";

type Category = "rice" | "oil" | "gift";
type PriceType = "procurement" | "retail" | "group" | "dropship";

type ProductRow = {
  id: string;
  code: string;
  category: Category;
  source_category: string;
  image_path: string | null;
  barcode: string | null;
  brand: string | null;
  short_name: string;
  name: string;
  name_en: string | null;
  specification: string | null;
  case_specification: string | null;
  shelf_life: string | null;
  tax_rate: number | null;
  minimum_order: string | null;
  stock_status: string | null;
  supports_dropship: boolean;
  is_recommended: boolean;
  applicable_scenarios: string | null;
  description: string | null;
  delivery_notes: string | null;
  invoice_notes: string | null;
  alternative_product_codes: string[];
  keywords: string[];
  customer_query_reply: string | null;
  out_of_stock_reply: string | null;
  order_guide_reply: string | null;
  status: "draft" | "active" | "archived";
};

type PriceRow = {
  product_id: string;
  price_type: PriceType;
  amount_cny: number;
};

const categoryMeta: Record<
  Category,
  { label: string; eyebrow: string; className: string }
> = {
  rice: {
    label: "大米",
    eyebrow: "RICE",
    className: "bg-[#eef7e9] text-[#4c703c]",
  },
  oil: {
    label: "食用油",
    eyebrow: "EDIBLE OIL",
    className: "bg-[#fff5df] text-[#8b671f]",
  },
  gift: {
    label: "礼盒",
    eyebrow: "GIFT SET",
    className: "bg-[#fff0ec] text-[#955241]",
  },
};

const priceLabels: Record<PriceType, string> = {
  procurement: "含税集采自提价",
  retail: "建议零售价",
  group: "团购价",
  dropship: "一件代发价",
};

function roleLabel(roleCodes: string[]) {
  const labels: Record<string, string> = {
    admin: "系统管理员",
    chairman: "董事长",
    hr: "人事行政",
    finance: "财务",
    department_lead: "部门负责人",
    employee: "普通员工",
  };
  return roleCodes.map((code) => labels[code]).filter(Boolean).join(" · ");
}

function currency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function ProductArtwork({
  name,
  src,
  priority = false,
}: {
  name: string;
  src?: string;
  priority?: boolean;
}) {
  return (
    <div className="relative flex h-full min-h-[220px] items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_46%,rgba(255,255,255,1),rgba(238,244,240,.76)_56%,rgba(219,231,225,.72))] p-7">
      <div className="absolute inset-x-8 bottom-5 h-6 rounded-[50%] bg-[#0a385d]/8 blur-xl" />
      {src ? (
        <Image
          alt={name}
          className="relative h-full max-h-[250px] w-full object-contain drop-shadow-[0_18px_16px_rgba(22,58,49,.16)] transition-transform duration-500 group-hover:scale-[1.035]"
          height={420}
          priority={priority}
          src={src}
          unoptimized
          width={420}
        />
      ) : (
        <div className="relative grid place-items-center text-center text-[#779087]">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/70">
            <ImageOff className="size-5" />
          </span>
          <span className="mt-3 text-[11px]">产品图待补充</span>
        </div>
      )}
    </div>
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    category?: string;
    q?: string;
    product?: string;
    view?: string;
    brand?: string;
    status?: string;
    quality?: string;
    updated?: string;
    error?: string;
  }>;
}) {
  const configured = isSupabaseConfigured();
  const employee = configured ? await requireCurrentEmployee() : null;
  const params = await searchParams;
  const category: Category | "all" = ["rice", "oil", "gift"].includes(
    params.category ?? "",
  )
    ? (params.category as Category)
    : "all";
  const query = params.q?.trim().toLocaleLowerCase("zh-CN") ?? "";
  const view = params.view === "cards" ? "cards" : "table";
  const brand = params.brand?.trim() ?? "";
  const status = ["active", "draft", "archived"].includes(params.status ?? "")
    ? params.status!
    : "";
  const quality = [
    "missing_image",
    "missing_barcode",
    "missing_price",
    "incomplete_reply",
  ].includes(params.quality ?? "")
    ? (params.quality as ProductQualityFlag)
    : "";

  let products: ProductRow[] = [];
  let prices: PriceRow[] = [];
  let departmentCode: string | null = null;
  let dataAvailable = !configured;
  const imageUrls = new Map<string, string>();

  if (employee) {
    const supabase = await createClient();
    const [productResult, departmentResult] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, code, category, source_category, image_path, barcode, brand, short_name, name, name_en, specification, case_specification, shelf_life, tax_rate, minimum_order, stock_status, supports_dropship, is_recommended, applicable_scenarios, description, delivery_notes, invoice_notes, alternative_product_codes, keywords, customer_query_reply, out_of_stock_reply, order_guide_reply, status",
        )
        .order("code")
        .limit(200),
      employee.departmentId
        ? supabase
            .from("departments")
            .select("code")
            .eq("id", employee.departmentId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    dataAvailable = !productResult.error;
    products = (productResult.data ?? []) as ProductRow[];
    departmentCode = departmentResult.data?.code ?? null;

    if (products.length) {
      const [priceResult, imageResult] = await Promise.all([
        supabase
          .from("product_prices")
          .select("product_id, price_type, amount_cny")
          .in(
            "product_id",
            products.map((product) => product.id),
          )
          .eq("status", "active"),
        supabase.storage
          .from("product-images")
          .createSignedUrls(
            products
              .map((product) => product.image_path)
              .filter((path): path is string => Boolean(path)),
            60 * 60,
          ),
      ]);

      prices = (priceResult.data ?? []) as PriceRow[];
      for (const signed of imageResult.data ?? []) {
        if (signed.path && signed.signedUrl) {
          imageUrls.set(signed.path, signed.signedUrl);
        }
      }
    }
  }

  const priceMap = new Map<string, Map<PriceType, number>>();
  for (const price of prices) {
    const productPrices =
      priceMap.get(price.product_id) ?? new Map<PriceType, number>();
    productPrices.set(price.price_type, Number(price.amount_cny));
    priceMap.set(price.product_id, productPrices);
  }

  const filteredProducts = products.filter((product) => {
    const matchesCategory =
      category === "all" || product.category === category;
    const matchesBrand = !brand || product.brand === brand;
    const matchesStatus = !status || product.status === status;
    const matchesQuality =
      !quality ||
      getProductQualityFlags(
        product,
        (priceMap.get(product.id)?.size ?? 0) > 0,
      ).includes(quality);
    const matchesQuery =
      !query ||
      [
      product.code,
      product.barcode,
      product.brand,
      product.short_name,
      product.name,
      product.name_en,
      product.specification,
      ...product.keywords,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase("zh-CN").includes(query),
        );
    return (
      matchesCategory &&
      matchesBrand &&
      matchesStatus &&
      matchesQuality &&
      matchesQuery
    );
  });

  const selectedProduct =
    products.find((product) => product.id === params.product) ?? null;
  const selectedPrices = selectedProduct
    ? priceMap.get(selectedProduct.id)
    : undefined;
  const canManage =
    !employee ||
    departmentCode === "DX-PROC";
  const hasChannelPricing = prices.some((price) =>
    ["group", "dropship", "procurement"].includes(price.price_type),
  );
  const imageCount = products.filter((product) => product.image_path).length;
  const activeProducts = products.filter(
    (product) => product.status === "active",
  );
  const brands = Array.from(
    new Set(products.map((product) => product.brand).filter(Boolean)),
  ).sort((a, b) => String(a).localeCompare(String(b), "zh-CN")) as string[];
  const tablePrices = Object.fromEntries(
    Array.from(priceMap.entries()).map(([productId, productPrices]) => [
      productId,
      Object.fromEntries(productPrices),
    ]),
  );
  const tableImages = Object.fromEntries(imageUrls);

  const makeHref = (next: Record<string, string | undefined>) => {
    const search = new URLSearchParams();
    const values = {
      category: category === "all" ? undefined : category,
      q: params.q,
      view,
      brand: brand || undefined,
      status: status || undefined,
      quality: quality || undefined,
      ...next,
    };
    Object.entries(values).forEach(([key, value]) => {
      if (value) search.set(key, value);
    });
    const suffix = search.toString();
    return suffix ? `/products?${suffix}` : "/products";
  };

  return (
    <WorkflowShell
      activeItem="产品管理"
      breadcrumb="供应链 / 产品管理 / PIM"
      currentUser={
        employee
          ? {
              name: employee.name,
              roleLabel: roleLabel(employee.roleCodes) || "德馨淼盛员工",
            }
          : undefined
      }
    >
      <main className="px-4 py-6 sm:px-6 xl:px-8">
        <section className="relative overflow-hidden rounded-[28px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_24px_70px_-46px_rgba(15,57,47,.9)] sm:px-8 lg:px-10 lg:py-9">
          <div className="absolute -right-20 -top-32 size-[360px] rounded-full border border-white/10" />
          <div className="absolute -right-6 -top-10 size-[190px] rounded-full bg-[#6bd7d4]/10 blur-2xl" />
          <div className="relative grid gap-8 xl:grid-cols-[1fr_auto] xl:items-end">
            <div>
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[#a9d8c7]">
                <Sparkles className="size-3.5" />
                Product Information Management
              </div>
              <h1 className="mt-4 text-[30px] font-semibold tracking-[-0.045em] sm:text-[36px]">
                产品中心
              </h1>
              <p className="mt-3 max-w-2xl text-[13px] leading-6 text-white/58">
                一个产品编号，一份权威主档。统一连接德小馨、客户报价、库存与后续销售订单。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["产品主档", String(activeProducts.length)],
                ["大米", String(products.filter((p) => p.category === "rice").length)],
                ["食用油", String(products.filter((p) => p.category === "oil").length)],
                ["礼盒", String(products.filter((p) => p.category === "gift").length)],
              ].map(([label, value]) => (
                <div
                  className="min-w-[92px] rounded-2xl border border-white/10 bg-white/[0.065] px-4 py-3 backdrop-blur-sm"
                  key={label}
                >
                  <div className="text-[10px] text-white/42">{label}</div>
                  <div className="mt-1 text-xl font-semibold">{value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {(params.updated || params.error) && (
          <div
            className={`mt-5 rounded-2xl border px-4 py-3 text-xs ${
              params.error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {params.error ?? params.updated}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <a
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#cfe0d9] bg-white px-4 text-[11px] font-medium text-[#1a5a69] shadow-[0_8px_24px_-20px_rgba(23,57,50,.45)] transition hover:-translate-y-0.5 hover:border-[#82aa99]"
            href="/products/export"
          >
            <Download className="size-4" />
            导出德馨产品库总表
          </a>
        </div>

        {canManage && (
          <details className="mt-5 rounded-[22px] border border-[#d7e6df] bg-white p-5 shadow-[0_10px_36px_-30px_rgba(23,57,50,.36)]">
            <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-[#1a5a69]">
              <span className="grid size-8 place-items-center rounded-xl bg-[#edf6f2]">
                <Plus className="size-4" />
              </span>
              新建产品主档
            </summary>
            <ProductMasterForm />
          </details>
        )}

        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          {([
            ["rice", Wheat, "米类主食与团购福利", "#eef7e9", "#557742"],
            ["oil", ShoppingBasket, "家庭用油与餐饮采购", "#fff6e4", "#8a671e"],
            ["gift", Gift, "节庆福利与商务赠礼", "#fff0ec", "#975343"],
          ] as const).map(([value, Icon, note, background, foreground]) => {
            const count = products.filter(
              (product) => product.category === value,
            ).length;
            const active = category === value;
            return (
              <Link
                className={`group flex items-center gap-4 rounded-[20px] border bg-white p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-30px_rgba(22,59,49,.5)] ${
                  active
                    ? "border-[#61917d] ring-2 ring-[#cde8dc]"
                    : "border-border/75"
                }`}
                href={makeHref({ category: value, product: undefined })}
                key={value}
              >
                <span
                  className="grid size-12 shrink-0 place-items-center rounded-2xl"
                  style={{ background, color: foreground }}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">
                    {categoryMeta[value].label}
                  </span>
                  <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                    {note}
                  </span>
                </span>
                <span className="text-right">
                  <span className="block text-lg font-semibold">{count}</span>
                  <span className="text-[9px] text-muted-foreground">款产品</span>
                </span>
              </Link>
            );
          })}
        </section>

        <section className="mt-5 rounded-[22px] border border-border/75 bg-white p-4 shadow-[0_10px_36px_-30px_rgba(23,57,50,.36)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <form className="relative flex-1" method="get">
              {category !== "all" && (
                <input name="category" type="hidden" value={category} />
              )}
              <input name="view" type="hidden" value={view} />
              {brand && <input name="brand" type="hidden" value={brand} />}
              {status && <input name="status" type="hidden" value={status} />}
              {quality && (
                <input name="quality" type="hidden" value={quality} />
              )}
              <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-xl border border-input bg-[#f8fafc] pl-11 pr-24 text-xs outline-none transition focus:border-[#6ba18b] focus:ring-2 focus:ring-[#d8eee5]"
                defaultValue={params.q}
                name="q"
                placeholder="搜索产品编号、条码、品牌、名称或规格"
              />
              <button
                className="absolute right-1.5 top-1.5 h-8 rounded-lg bg-[#0a385d] px-4 text-[11px] text-white"
                type="submit"
              >
                搜索
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "全部"],
                ["rice", "大米"],
                ["oil", "食用油"],
                ["gift", "礼盒"],
              ].map(([value, label]) => (
                <Link
                  className={`rounded-xl px-3.5 py-2 text-[11px] transition-colors ${
                    category === value
                      ? "bg-[#0a385d] text-white"
                      : "bg-[#f2f6f4] text-muted-foreground hover:text-foreground"
                  }`}
                  href={makeHref({
                    category: value === "all" ? undefined : value,
                    product: undefined,
                  })}
                  key={value}
                >
                  {label}
                </Link>
              ))}
            </div>
            <div className="flex rounded-xl bg-[#f2f6f4] p-1">
              <Link
                aria-label="表格视图"
                className={`grid size-8 place-items-center rounded-lg ${
                  view === "table"
                    ? "bg-white text-[#235d4e] shadow-sm"
                    : "text-muted-foreground"
                }`}
                href={makeHref({ view: "table", product: undefined })}
              >
                <TableProperties className="size-4" />
              </Link>
              <Link
                aria-label="卡片视图"
                className={`grid size-8 place-items-center rounded-lg ${
                  view === "cards"
                    ? "bg-white text-[#235d4e] shadow-sm"
                    : "text-muted-foreground"
                }`}
                href={makeHref({ view: "cards", product: undefined })}
              >
                <LayoutGrid className="size-4" />
              </Link>
            </div>
          </div>
          <div className="mt-3 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-3">
            <form className="text-[9px] text-muted-foreground" method="get">
              <span>品牌</span>
              {category !== "all" && (
                <input name="category" type="hidden" value={category} />
              )}
              {params.q && <input name="q" type="hidden" value={params.q} />}
              <input name="view" type="hidden" value={view} />
              {status && <input name="status" type="hidden" value={status} />}
              {quality && (
                <input name="quality" type="hidden" value={quality} />
              )}
              <div className="mt-1 flex gap-1">
              <select
                className="h-9 min-w-0 flex-1 rounded-xl border border-input bg-white px-3 text-[11px] text-foreground"
                defaultValue={brand}
                name="brand"
              >
                <option value="">全部品牌</option>
                {brands.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
                <button
                  className="h-9 rounded-xl bg-[#eaf3ef] px-3 text-[10px] font-medium text-[#1a5a69]"
                  type="submit"
                >
                  筛选
                </button>
              </div>
            </form>
            <label className="text-[9px] text-muted-foreground">
              上架状态
              <div className="mt-1 flex h-9 overflow-hidden rounded-xl border border-input bg-white">
                {[
                  ["", "全部"],
                  ["active", "上架"],
                  ["draft", "草稿"],
                  ["archived", "归档"],
                ].map(([value, label]) => (
                  <Link
                    className={`grid flex-1 place-items-center text-[10px] ${
                      status === value
                        ? "bg-[#0a385d] text-white"
                        : "text-muted-foreground"
                    }`}
                    href={makeHref({
                      status: value || undefined,
                      product: undefined,
                    })}
                    key={value}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </label>
            <label className="text-[9px] text-muted-foreground">
              数据质量
              <div className="mt-1 flex h-9 overflow-x-auto rounded-xl border border-input bg-white">
                {[
                  ["", "全部"],
                  ["missing_image", "缺图"],
                  ["missing_barcode", "缺条码"],
                  ["missing_price", "缺价格"],
                  ["incomplete_reply", "缺话术"],
                ].map(([value, label]) => (
                  <Link
                    className={`grid min-w-[54px] flex-1 place-items-center px-2 text-[10px] ${
                      quality === value
                        ? "bg-[#0a385d] text-white"
                        : "text-muted-foreground"
                    }`}
                    href={makeHref({
                      quality: value || undefined,
                      product: undefined,
                    })}
                    key={value}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/60 pt-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <PackageSearch className="size-3.5" />
              当前结果 {filteredProducts.length} 款
            </span>
            <span className="flex items-center gap-1.5">
              <BadgeCheck className="size-3.5" />
              推荐产品 {products.filter((product) => product.is_recommended).length} 款
            </span>
            <span className="flex items-center gap-1.5">
              <Boxes className="size-3.5" />
              已匹配图片 {imageCount}/{products.length}
            </span>
            <span className="ml-auto flex items-center gap-1.5">
              <ShieldCheck className="size-3.5" />
              {hasChannelPricing ? "已按岗位显示内部价格" : "仅显示通用产品资料与零售价"}
            </span>
          </div>
        </section>

        {!dataAvailable ? (
          <section className="mt-5 rounded-[24px] border border-amber-200 bg-amber-50 px-6 py-12 text-center">
            <PackageSearch className="mx-auto size-7 text-amber-700" />
            <h2 className="mt-4 text-sm font-semibold text-amber-900">
              暂时无法读取产品数据
            </h2>
            <p className="mt-2 text-xs text-amber-700">
              请确认产品中心数据库迁移已经执行。
            </p>
          </section>
        ) : filteredProducts.length === 0 ? (
          <section className="mt-5 rounded-[24px] border border-border/75 bg-white px-6 py-16 text-center">
            <PackageSearch className="mx-auto size-7 text-muted-foreground" />
            <h2 className="mt-4 text-sm font-semibold">没有找到匹配产品</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              可以尝试产品编号、品牌、产品名称或规格。
            </p>
          </section>
        ) : view === "table" ? (
          <ProductMasterTable
            imageUrls={tableImages}
            prices={tablePrices}
            products={filteredProducts}
            query={{
              category: category === "all" ? undefined : category,
              q: params.q,
              brand: brand || undefined,
              status: status || undefined,
              quality: quality || undefined,
            }}
          />
        ) : (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filteredProducts.map((product, index) => {
              const meta = categoryMeta[product.category];
              const retail = priceMap.get(product.id)?.get("retail");
              return (
                <Link
                  className="group overflow-hidden rounded-[22px] border border-border/75 bg-white shadow-[0_10px_32px_-28px_rgba(19,57,48,.42)] transition-all hover:-translate-y-1 hover:border-[#a8cdbd] hover:shadow-[0_24px_52px_-34px_rgba(19,57,48,.5)]"
                  href={makeHref({ product: product.id })}
                  key={product.id}
                >
                  <div className="relative h-[270px]">
                    <ProductArtwork
                      name={product.name}
                      priority={index < 4}
                      src={
                        product.image_path
                          ? imageUrls.get(product.image_path)
                          : undefined
                      }
                    />
                    <span
                      className={`absolute left-4 top-4 rounded-full px-2.5 py-1 text-[9px] font-medium ${meta.className}`}
                    >
                      {meta.label}
                    </span>
                    {product.is_recommended && (
                      <span className="absolute right-4 top-4 flex items-center gap-1 rounded-full bg-[#0a385d] px-2.5 py-1 text-[9px] text-white">
                        <Sparkles className="size-2.5" />
                        推荐
                      </span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-center justify-between text-[9px] uppercase tracking-[0.16em] text-muted-foreground">
                      <span>{product.code}</span>
                      <span>{product.brand ?? "德馨精选"}</span>
                    </div>
                    <h2 className="mt-3 line-clamp-2 min-h-[42px] text-[15px] font-semibold leading-[1.45]">
                      {product.name}
                    </h2>
                    <div className="mt-4 flex items-end justify-between gap-3 border-t border-border/60 pt-4">
                      <div>
                        <div className="text-[9px] text-muted-foreground">
                          {retail === undefined ? "产品规格" : "建议零售价"}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-[#0a385d]">
                          {retail === undefined
                            ? product.specification || "待完善"
                            : currency(retail)}
                        </div>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors group-hover:text-[#176d78]">
                        查看主档
                        <ChevronRight className="size-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        {selectedProduct && (
          <section className="mt-5 overflow-hidden rounded-[26px] border border-border/75 bg-white shadow-[0_22px_60px_-44px_rgba(17,56,47,.55)]">
            <div className="grid lg:grid-cols-[390px_1fr]">
              <div className="border-b border-border/70 lg:border-b-0 lg:border-r">
                <div className="h-[390px]">
                  <ProductArtwork
                    name={selectedProduct.name}
                    src={
                      selectedProduct.image_path
                        ? imageUrls.get(selectedProduct.image_path)
                        : undefined
                    }
                  />
                </div>
                {canManage && (
                  <form
                    action={uploadProductImageAction}
                    className="border-t border-border/60 bg-[#f7faf9] p-4"
                  >
                    <input
                      name="productId"
                      type="hidden"
                      value={selectedProduct.id}
                    />
                    <label className="block text-[10px] font-medium text-[#176d78]">
                      上传或更换产品图
                      <input
                        accept="image/png,image/jpeg,image/webp"
                        className="mt-2 block w-full rounded-xl border border-input bg-white p-2 text-[10px] file:mr-3 file:rounded-lg file:border-0 file:bg-[#eaf3ef] file:px-3 file:py-2 file:text-[10px] file:text-[#1a5a69]"
                        name="image"
                        required
                        type="file"
                      />
                    </label>
                    <button
                      className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-[#0a385d] text-[10px] font-medium text-white"
                      type="submit"
                    >
                      <ImagePlus className="size-3.5" />
                      保存产品图片
                    </button>
                    <p className="mt-2 text-[9px] leading-4 text-muted-foreground">
                      支持 PNG、JPG、WebP，最大 5MB；透明背景图片展示效果最佳。
                    </p>
                  </form>
                )}
              </div>
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[9px] font-medium ${categoryMeta[selectedProduct.category].className}`}
                  >
                    {categoryMeta[selectedProduct.category].label}
                  </span>
                  <span className="rounded-full bg-[#f2f6f4] px-2.5 py-1 text-[9px] text-muted-foreground">
                    {selectedProduct.code}
                  </span>
                  {selectedProduct.supports_dropship && (
                    <span className="rounded-full bg-[#edf6ff] px-2.5 py-1 text-[9px] text-[#38678f]">
                      支持一件代发
                    </span>
                  )}
                  <Link
                    className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
                    href={makeHref({ product: undefined })}
                  >
                    关闭详情
                  </Link>
                </div>
                <h2 className="mt-4 text-[24px] font-semibold tracking-[-0.035em]">
                  {selectedProduct.name}
                </h2>
                {selectedProduct.name_en && (
                  <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                    {selectedProduct.name_en}
                  </p>
                )}

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {([
                    ["规格", selectedProduct.specification ?? "待完善"],
                    ["箱规", selectedProduct.case_specification ?? "待完善"],
                    ["保质期", selectedProduct.shelf_life ?? "待完善"],
                    ["起订量", selectedProduct.minimum_order ?? "待确认"],
                  ] as const).map(([label, value]) => (
                    <div
                      className="rounded-2xl bg-[#f5f8f7] px-4 py-3"
                      key={label}
                    >
                      <div className="text-[9px] text-muted-foreground">{label}</div>
                      <div className="mt-1.5 text-xs font-medium">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {(["retail", "group", "dropship", "procurement"] as const).map(
                    (type) => {
                      const amount = selectedPrices?.get(type);
                      if (amount === undefined) return null;
                      return (
                        <div
                          className="rounded-2xl border border-[#e0eae6] px-4 py-3"
                          key={type}
                        >
                          <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                            <CircleDollarSign className="size-3" />
                            {priceLabels[type]}
                          </div>
                          <div className="mt-1.5 text-base font-semibold text-[#0a385d]">
                            {currency(amount)}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>

                <div className="mt-6 grid gap-6 xl:grid-cols-2">
                  <div>
                    <h3 className="text-xs font-semibold">产品介绍</h3>
                    <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                      {selectedProduct.description || "产品介绍待完善。"}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold">配送与库存</h3>
                    <p className="mt-2 text-[11px] leading-6 text-muted-foreground">
                      {selectedProduct.delivery_notes || "配送政策下单前确认。"}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-2 border-t border-border/60 pt-5">
                  <span className="flex items-center gap-1.5 rounded-xl bg-[#f5f8f7] px-3 py-2 text-[10px] text-muted-foreground">
                    <Barcode className="size-3.5" />
                    {selectedProduct.barcode || "条码待确认"}
                  </span>
                  <span className="rounded-xl bg-[#f5f8f7] px-3 py-2 text-[10px] text-muted-foreground">
                    库存：{selectedProduct.stock_status || "下单前确认"}
                  </span>
                  {selectedProduct.alternative_product_codes.length > 0 && (
                    <span className="rounded-xl bg-[#f5f8f7] px-3 py-2 text-[10px] text-muted-foreground">
                      替代：{selectedProduct.alternative_product_codes.join("、")}
                    </span>
                  )}
                </div>

                <details className="mt-6 rounded-2xl border border-border/70 px-4 py-3">
                  <summary className="cursor-pointer text-xs font-semibold">
                    客户沟通标准话术
                  </summary>
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {[
                      ["客户查询回复", selectedProduct.customer_query_reply],
                      ["缺货回复", selectedProduct.out_of_stock_reply],
                      ["下单引导", selectedProduct.order_guide_reply],
                    ].map(([label, content]) => (
                      <div className="rounded-xl bg-[#f5f8f7] p-4" key={label}>
                        <div className="text-[9px] font-medium text-[#176d78]">
                          {label}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-[10px] leading-5 text-muted-foreground">
                          {content || "待完善"}
                        </p>
                      </div>
                    ))}
                  </div>
                </details>

                {canManage && (
                  <details className="mt-6 rounded-2xl border border-[#dce9e3] bg-[#f7faf9] p-4">
                    <summary className="cursor-pointer text-xs font-semibold text-[#1a5a69]">
                      编辑完整产品主档
                    </summary>
                    <ProductMasterForm
                      prices={
                        selectedPrices
                          ? Object.fromEntries(selectedPrices)
                          : undefined
                      }
                      product={selectedProduct}
                    />
                  </details>
                )}
              </div>
            </div>
          </section>
        )}
      </main>
    </WorkflowShell>
  );
}
