import Link from "next/link";
import { AlertTriangle, ArrowRight, Bot, Boxes, CheckSquare2, Clock3, FilePlus2, PackageSearch } from "lucide-react";
import { PageContainer, PageHeader, StatusBadge } from "@/components/ui/application";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { getDashboardData } from "@/lib/api/dashboard";
import { FirstVisitGuide } from "@/components/ui/first-visit-guide";

export const dynamic = "force-dynamic";

export default async function MobileWorkspacePage() {
  const employee = await requireCurrentEmployee();
  const data = await getDashboardData(employee);
  const warnings = data.inventory.filter((item) => item.status !== "normal").slice(0, 3);

  return <WorkflowShell activeItem="驾驶舱" breadcrumb="移动工作台"><PageContainer className="pb-24 lg:pb-8" size="narrow">
    <PageHeader description={`${employee.name}，这里优先展示今天需要处理的事项。`} title="今日工作" />
    <FirstVisitGuide guideKey="mobile-workspace" steps={["先处理待办和预警", "使用底部“新建”发起申请或订单", "遇到问题时直接询问德小馨"]} title="移动工作台使用提示" />
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-md border border-border bg-white"><header className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><CheckSquare2 className="size-4 text-primary" /><h2 className="text-base font-semibold">待我处理</h2></div><StatusBadge tone={data.todos.length ? "warning" : "success"}>{data.todos.length} 项</StatusBadge></header><div className="divide-y divide-border">{data.todos.length ? data.todos.map((item) => <Link className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-muted" href={item.href} key={item.id}><span className="grid size-9 shrink-0 place-items-center rounded-md bg-attention-surface text-attention"><Clock3 className="size-4" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{item.title}</strong><span className="mt-1 block text-xs text-muted-foreground">{item.applicant}</span></span><ArrowRight className="size-4 text-muted-foreground" /></Link>) : <div className="px-4 py-8 text-center text-sm text-muted-foreground">今天没有待审批事项</div>}</div></section>
      <section className="rounded-md border border-border bg-white"><header className="flex items-center justify-between border-b border-border px-4 py-3"><div className="flex items-center gap-2"><AlertTriangle className="size-4 text-attention" /><h2 className="text-base font-semibold">重要预警</h2></div><Link className="min-h-11 py-3 text-xs text-primary" href="/inventory">查看库存</Link></header><div className="divide-y divide-border">{warnings.length ? warnings.map((item) => <Link className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-muted" href={`/inventory?q=${encodeURIComponent(item.sku)}`} key={item.id}><Boxes className="size-4 shrink-0 text-attention" /><span className="min-w-0 flex-1"><strong className="block truncate text-sm font-medium">{item.name}</strong><span className="mt-1 block font-mono text-xs text-muted-foreground">{item.sku}</span></span><StatusBadge tone={item.status === "danger" ? "danger" : "warning"}>{item.quantity} {item.unit}</StatusBadge></Link>) : <div className="px-4 py-8 text-center text-sm text-muted-foreground">暂无重要库存预警</div>}</div></section>
    </div>
    <section className="mt-4 rounded-md border border-border bg-white p-4"><h2 className="text-base font-semibold">快捷处理</h2><div className="mt-3 grid grid-cols-2 gap-2"><Link className="flex min-h-14 items-center gap-3 rounded-md border border-border px-3 text-sm" href="/requests/expense"><FilePlus2 className="size-4 text-info" />费用报销</Link><Link className="flex min-h-14 items-center gap-3 rounded-md border border-border px-3 text-sm" href="/mobile/orders/new"><FilePlus2 className="size-4 text-primary" />销售订单</Link><Link className="flex min-h-14 items-center gap-3 rounded-md border border-border px-3 text-sm" href="/mobile/scan"><PackageSearch className="size-4 text-intelligence" />扫码查商品</Link><Link className="flex min-h-14 items-center gap-3 rounded-md border border-border px-3 text-sm" href="/ai"><Bot className="size-4 text-intelligence" />询问德小馨</Link></div></section>
    <p className="mt-4 text-center text-xs leading-5 text-muted-foreground">移动端保持在线使用。过账、银行对账、权限设置等复杂操作请在桌面端处理。</p>
  </PageContainer></WorkflowShell>;
}
