import type {Metadata} from "next";
import {FileCheck2,FilePlus2,ReceiptText} from "lucide-react";
import {WorkflowShell} from "@/features/approvals/workflow-shell";
import {requireCurrentEmployee} from "@/features/auth/current-employee";
import {createInvoiceAction,updateInvoiceStatusAction} from "@/features/finance/invoice-actions";
import {createClient} from "@/lib/supabase/server";

export const metadata:Metadata={title:"发票管理",description:"销项、进项发票与应收应付关联管理"};
export const dynamic="force-dynamic";
const control="mt-1.5 h-10 w-full rounded-xl border border-[#d8e3e9] bg-white px-3 text-xs outline-none focus:border-[#168d9a]";
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Shanghai"}).format(new Date());
function money(value:unknown){return new Intl.NumberFormat("zh-CN",{style:"currency",currency:"CNY"}).format(Number(value));}
function label(value:string){return ({issued:"销项",received:"进项",recorded:"已登记",verified:"已核验",void:"已作废",vat_general:"增值税普通发票",vat_special:"增值税专用发票",electronic:"电子发票",other:"其他发票"} as Record<string,string>)[value]??value;}

export default async function InvoicePage({searchParams}:{searchParams:Promise<{created?:string;error?:string}>}){
  const employee=await requireCurrentEmployee();const feedback=await searchParams;const supabase=await createClient();
  const canWrite = employee.roleCodes.includes("finance");
  const [invoiceResult,documentResult]=await Promise.all([
    supabase.from("finance_invoices").select("id,invoice_record_no,direction,invoice_type,counterparty_name,invoice_code,invoice_no,issued_on,amount_excluding_tax,tax_amount,total_amount,status,verification_note,created_at").order("issued_on",{ascending:false}).limit(120),
    supabase.from("finance_documents").select("id,document_no,document_type,counterparty_name,total_amount,status,invoice_no").neq("status","void").order("issue_date",{ascending:false}).limit(240),
  ]);
  const invoices=invoiceResult.data??[];const documents=documentResult.data??[];const missing=Boolean(invoiceResult.error);
  const issued=invoices.filter(x=>x.direction==="issued").reduce((s,x)=>s+Number(x.total_amount),0);
  const received=invoices.filter(x=>x.direction==="received").reduce((s,x)=>s+Number(x.total_amount),0);
  return <WorkflowShell activeItem="财务管理" breadcrumb="财务管理 / 发票管理" currentUser={{name:employee.name,roleLabel:employee.roleCodes.join(" · ")}}>
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
      <section className="relative overflow-hidden rounded-[26px] bg-[radial-gradient(circle_at_80%_18%,rgba(56,199,194,.25),transparent_27%),linear-gradient(135deg,#071d34,#0a385d_58%,#0b626d)] px-7 py-8 text-white shadow-[0_26px_70px_-40px_rgba(6,28,49,.9)]">
        <ReceiptText className="absolute right-12 top-1/2 hidden size-36 -translate-y-1/2 text-white/[.07] sm:block"/><div className="relative"><div className="text-xs tracking-[.16em] text-[#70dcda]">FMS · INVOICE MANAGEMENT</div><h1 className="mt-3 text-3xl font-semibold">发票管理</h1><p className="mt-3 text-sm text-white/65">销项关联销售应收，进项关联采购应付，保留号码、税额、核验与作废历史。</p></div>
      </section>
      {(feedback.created||feedback.error||missing)&&<div className={`mt-5 rounded-2xl border px-4 py-3 text-xs ${feedback.error||missing?"border-red-200 bg-red-50 text-red-700":"border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{feedback.error??(missing?"发票数据库升级尚未完成。":feedback.created)}</div>}
      <section className="mt-5 grid gap-4 sm:grid-cols-3">
        {[["发票总数",`${invoices.length} 张`],["销项含税金额",money(issued)],["进项含税金额",money(received)]].map(([a,b])=><article className="rounded-[20px] border border-white bg-white/85 p-5 shadow-[0_16px_42px_-34px_rgba(9,57,91,.5)]" key={a}><div className="text-[10px] text-muted-foreground">{a}</div><div className="mt-2 text-2xl font-semibold">{b}</div></article>)}
      </section>
      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_420px]">
        <section className="overflow-hidden rounded-[22px] border border-border/80 bg-white">
          <div className="flex items-center justify-between border-b p-5"><div><h2 className="font-semibold">发票台账</h2><p className="mt-1 text-[10px] text-muted-foreground">按开票日期倒序展示</p></div><FileCheck2 className="size-5 text-primary"/></div>
          <div className="divide-y">{invoices.length===0?<div className="p-14 text-center text-xs text-muted-foreground">暂无发票记录</div>:invoices.map(invoice=><article className="grid gap-3 p-5 lg:grid-cols-[1fr_150px_110px] lg:items-center" key={invoice.id}>
            <div><div className="flex gap-2"><span className="rounded-full bg-cyan-50 px-2 py-1 text-[9px] text-cyan-700">{label(invoice.direction)}</span><span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] text-slate-600">{label(invoice.status)}</span></div><div className="mt-2 text-sm font-semibold">{invoice.counterparty_name}</div><div className="mt-1 font-mono text-[9px] text-muted-foreground">{invoice.invoice_no} · {label(invoice.invoice_type)} · {invoice.issued_on}</div></div>
            <div><div className="text-[9px] text-muted-foreground">价税合计</div><div className="mt-1 text-sm font-semibold">{money(invoice.total_amount)}</div><div className="text-[9px] text-muted-foreground">税额 {money(invoice.tax_amount)}</div></div>
            {canWrite&&invoice.status==="recorded"?<div className="space-y-2"><form action={updateInvoiceStatusAction}><input type="hidden" name="invoiceId" value={invoice.id}/><input type="hidden" name="status" value="verified"/><button className="w-full rounded-lg bg-emerald-50 px-3 py-2 text-[9px] text-emerald-700">核验</button></form><form action={updateInvoiceStatusAction}><input type="hidden" name="invoiceId" value={invoice.id}/><input type="hidden" name="status" value="void"/><input className="h-7 w-full rounded-md border px-2 text-[9px]" name="note" placeholder="作废原因" required/><button className="mt-1 w-full rounded-lg bg-red-50 px-3 py-2 text-[9px] text-red-600">作废</button></form></div>:<div className="text-right font-mono text-[9px] text-muted-foreground">{invoice.invoice_record_no}</div>}
          </article>)}</div>
        </section>
        {canWrite?<section className="rounded-[22px] border border-border/80 bg-white p-5"><div className="flex items-center gap-2"><FilePlus2 className="size-4 text-primary"/><h2 className="font-semibold">登记发票</h2></div>
          <form action={createInvoiceAction} className="mt-5 space-y-3">
            <div className="grid grid-cols-2 gap-3"><label className="text-[10px] text-muted-foreground">方向<select className={control} name="direction"><option value="issued">销项发票</option><option value="received">进项发票</option></select></label><label className="text-[10px] text-muted-foreground">类型<select className={control} name="invoiceType"><option value="vat_general">增值税普通发票</option><option value="vat_special">增值税专用发票</option><option value="electronic">电子发票</option><option value="other">其他</option></select></label></div>
            <label className="text-[10px] text-muted-foreground">关联应收应付<select className={control} name="financeDocumentId"><option value="">暂不关联</option>{documents.map(doc=><option key={doc.id} value={doc.id}>{doc.document_type==="receivable"?"应收":"应付"} · {doc.document_no} · {doc.counterparty_name} · {money(doc.total_amount)}</option>)}</select></label>
            <label className="text-[10px] text-muted-foreground">往来单位<input className={control} name="counterpartyName" placeholder="未关联单据时填写"/></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-[10px] text-muted-foreground">发票代码<input className={control} name="invoiceCode"/></label><label className="text-[10px] text-muted-foreground">发票号码<input className={control} name="invoiceNo" required/></label></div>
            <label className="text-[10px] text-muted-foreground">开票日期<input className={control} name="issuedOn" type="date" defaultValue={today} required/></label>
            <div className="grid grid-cols-2 gap-3"><label className="text-[10px] text-muted-foreground">不含税金额<input className={control} name="amountExcludingTax" type="number" min="0" step=".01" required/></label><label className="text-[10px] text-muted-foreground">税额<input className={control} name="taxAmount" type="number" min="0" step=".01" defaultValue="0"/></label></div>
            <label className="text-[10px] text-muted-foreground">备注<textarea className="mt-1.5 min-h-20 w-full rounded-xl border p-3 text-xs" name="note"/></label><button className="h-10 w-full rounded-xl bg-[#0b6678] text-xs font-medium text-white">保存发票</button>
          </form>
        </section>:<section className="rounded-[22px] border border-border bg-white p-8 text-center text-xs text-muted-foreground">财务或管理员可以登记、核验和作废发票。</section>}
      </div>
    </main>
  </WorkflowShell>
}
