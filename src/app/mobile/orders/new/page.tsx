import { CircleCheckBig, TriangleAlert } from "lucide-react";
import { PageContainer, PageHeader } from "@/components/ui/application";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { SalesOrderBuilder, type SalesCustomerOption, type SalesOpportunityOption, type SalesProductOption } from "@/features/sales/sales-order-builder";
import { createClient } from "@/lib/supabase/server";

type ProductRow = { id: string; code: string; name: string; specification: string | null; product_prices: Array<{ price_type: "procurement" | "retail" | "group" | "dropship"; amount_cny: number | string; status: "active" | "expired" }> | null };

export const dynamic = "force-dynamic";

export default async function MobileNewOrderPage({ searchParams }: { searchParams: Promise<{ created?: string; error?: string }> }) {
  await requireCurrentEmployee();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [customerResult, entityResult, productResult, opportunityResult] = await Promise.all([
    supabase.from("customers").select("id, customer_no, name, level, status").neq("status", "inactive").order("name").limit(240),
    supabase.from("customer_legal_entities").select("id, customer_id, legal_name, is_default, status").eq("status", "active").order("is_default", { ascending: false }),
    supabase.from("products").select("id, code, name, specification, product_prices(price_type, amount_cny, status)").eq("status", "active").order("code").limit(400),
    supabase.from("sales_opportunities").select("id, customer_id, opportunity_no, title, stage").not("stage", "in", '("won","lost")').order("updated_at", { ascending: false }).limit(100),
  ]);
  const entities = entityResult.data ?? [];
  const customers: SalesCustomerOption[] = (customerResult.data ?? []).map((customer) => ({ id: customer.id, customerNo: customer.customer_no, name: customer.name, level: customer.level, legalEntities: entities.filter((entity) => entity.customer_id === customer.id).map((entity) => ({ id: entity.id, legalName: entity.legal_name, isDefault: entity.is_default })) }));
  const products: SalesProductOption[] = ((productResult.data ?? []) as ProductRow[]).map((product) => ({ id: product.id, code: product.code, name: product.name, specification: product.specification, prices: Object.fromEntries((product.product_prices ?? []).filter((price) => price.status === "active" && price.price_type !== "procurement").map((price) => [price.price_type, Number(price.amount_cny)])) }));
  const opportunities: SalesOpportunityOption[] = (opportunityResult.data ?? []).map((item) => ({ id: item.id, customerId: item.customer_id, opportunityNo: item.opportunity_no, title: item.title }));

  return <WorkflowShell activeItem="订单管理" breadcrumb="移动工作台 / 新建销售订单"><PageContainer className="pb-24" size="narrow"><PageHeader description="选择客户、商品、数量、价格和交付信息，保存后自动进入统一审批。" title="新建销售订单" />{feedback.created ? <div className="mb-4 flex items-center gap-2 rounded-md border border-success/25 bg-success-surface p-3 text-sm text-success"><CircleCheckBig className="size-4" />{feedback.created}</div> : null}{feedback.error ? <div className="mb-4 flex items-center gap-2 rounded-md border border-danger/25 bg-danger-surface p-3 text-sm text-danger" role="alert"><TriangleAlert className="size-4" />{feedback.error}</div> : null}<section className="rounded-md border border-border bg-white p-4"><SalesOrderBuilder customers={customers} mobile opportunities={opportunities} products={products} /></section></PageContainer></WorkflowShell>;
}
