import type { Metadata } from "next";
import Link from "next/link";
import { Printer } from "lucide-react";
import { BusinessDataTable } from "@/components/business/business-data-table";
import { CapabilityHero } from "@/components/business/capability-hero";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { savePrintTemplateAction } from "@/features/experience/actions";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "打印模板中心" };
export const dynamic = "force-dynamic";
const input = "h-9 rounded-xl border border-border bg-white px-3 text-[10px]";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const [e, p] = await Promise.all([requireCurrentEmployee(), searchParams]);
  const s = await createClient();
  const { data } = await s
    .from("print_templates")
    .select(
      "id,code,name,document_type,paper_size,orientation,show_logo,show_watermark,status,version",
    )
    .order("document_type");
  return (
    <WorkflowShell
      activeItem="系统管理"
      breadcrumb="系统 / 打印模板"
      currentUser={{ name: e.name, roleLabel: e.title ?? "内部员工" }}
    >
      <main className="mx-auto max-w-[1300px] p-4 sm:p-6 xl:p-8">
        <CapabilityHero
          eyebrow="PRINT · PDF · WATERMARK"
          title="打印模板中心"
          description="统一维护报价单、销售单、采购单、出库单、对账单和凭证的纸张、页眉、Logo与水印策略。"
          icon={Printer}
        />
        {(p.created || p.error) && (
          <div className="mt-4 rounded-xl border p-3 text-[10px]">
            {p.error ? "保存失败，请检查模板资料和权限。" : "打印模板已保存。"}
          </div>
        )}
        <div className="mt-5 grid gap-5 xl:grid-cols-[380px_1fr]">
          <form
            action={savePrintTemplateAction}
            className="grid gap-3 rounded-[20px] border border-border bg-white p-5"
          >
            <h2 className="text-sm font-semibold">新增模板</h2>
            <input
              className={input}
              name="code"
              placeholder="template_code"
              required
            />
            <input
              className={input}
              name="name"
              placeholder="模板名称"
              required
            />
            <select className={input} name="documentType">
              <option value="quote">报价单</option>
              <option value="sales_order">销售订单</option>
              <option value="purchase_order">采购订单</option>
              <option value="outbound">出库单</option>
              <option value="statement">对账单</option>
              <option value="voucher">凭证</option>
            </select>
            <select className={input} name="paperSize">
              <option>A4</option>
              <option>A5</option>
              <option value="label">标签纸</option>
            </select>
            <select className={input} name="orientation">
              <option value="portrait">纵向</option>
              <option value="landscape">横向</option>
            </select>
            <input className={input} name="header" placeholder="页眉" />
            <input className={input} name="footer" placeholder="页脚" />
            <label className="text-[10px]">
              <input defaultChecked name="showLogo" type="checkbox" /> 显示企业
              Logo
            </label>
            <label className="text-[10px]">
              <input name="showWatermark" type="checkbox" /> 显示水印
            </label>
            <button className="h-9 rounded-xl bg-primary text-[10px] text-white">
              保存模板
            </button>
          </form>
          <BusinessDataTable
            columns={[
              { key: "name", label: "模板" },
              { key: "type", label: "单据类型" },
              { key: "paper", label: "版式" },
              { key: "features", label: "视觉元素" },
              { key: "status", label: "状态" },
              { key: "preview", label: "预览" },
            ]}
            rows={(data ?? []).map((x) => ({
              name: (
                <div>
                  <b>{x.name}</b>
                  <div className="font-mono text-[9px]">
                    {x.code} · V{x.version}
                  </div>
                </div>
              ),
              type: x.document_type,
              paper: `${x.paper_size} · ${x.orientation === "portrait" ? "纵向" : "横向"}`,
              features:
                [x.show_logo && "Logo", x.show_watermark && "水印"]
                  .filter(Boolean)
                  .join(" · ") || "基础",
              status: x.status,
              preview: (
                <Link
                  className="text-primary hover:underline"
                  href={`/system/print-templates/${x.id}/preview`}
                >
                  查看打印效果
                </Link>
              ),
            }))}
            rowKeys={(data ?? []).map((x) => x.id)}
            total={(data ?? []).length}
            page={1}
            pageSize={100}
            pathname="/system/print-templates"
          />
        </div>
      </main>
    </WorkflowShell>
  );
}
