import { notFound } from "next/navigation";
import Image from "next/image";
import { PrintButton } from "@/features/experience/print-button";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCurrentEmployee();
  const { id } = await params;
  const s = await createClient();
  const { data: t } = await s
    .from("print_templates")
    .select(
      "name,document_type,paper_size,orientation,header_text,footer_text,show_logo,show_watermark",
    )
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  return (
    <main className="min-h-screen bg-slate-100 p-6 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-[900px] justify-end">
        <PrintButton />
      </div>
      <article
        className={`relative mx-auto min-h-[1120px] overflow-hidden bg-white p-12 shadow-xl print:shadow-none ${t.orientation === "landscape" ? "max-w-[1120px]" : "max-w-[794px]"}`}
      >
        {t.show_watermark && (
          <div className="pointer-events-none absolute inset-0 grid rotate-[-25deg] place-items-center text-6xl font-bold text-slate-100">
            德馨星云
          </div>
        )}
        <header className="relative flex items-center justify-between border-b pb-5">
          {t.show_logo && (
            <Image
              alt="德馨星云"
              height={52}
              src="/dexin-nebula-horizontal.png"
              width={180}
            />
          )}
          <div className="text-right">
            <h1 className="text-2xl font-semibold">{t.name}</h1>
            <div className="mt-1 text-xs text-slate-500">
              {t.header_text ?? "德馨淼盛企业标准业务单据"}
            </div>
          </div>
        </header>
        <section className="relative mt-8">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>单据编号：DX-SAMPLE-0001</div>
            <div>单据日期：2026-08-27</div>
            <div>往来单位：示例客户 / 供应商</div>
            <div>制单人员：系统管理员</div>
          </div>
          <table className="mt-8 w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-100">
                <th className="border p-3 text-left">项目</th>
                <th className="border p-3 text-right">数量</th>
                <th className="border p-3 text-right">单价</th>
                <th className="border p-3 text-right">金额</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border p-3">业务单据模板预览</td>
                <td className="border p-3 text-right">1</td>
                <td className="border p-3 text-right">1,000.00</td>
                <td className="border p-3 text-right">1,000.00</td>
              </tr>
            </tbody>
          </table>
        </section>
        <footer className="absolute inset-x-12 bottom-10 border-t pt-4 text-center text-xs text-slate-500">
          {t.footer_text ?? "本单据由德馨星云生成"} · {t.paper_size}
        </footer>
      </article>
    </main>
  );
}
