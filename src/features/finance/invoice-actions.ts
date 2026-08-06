"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

function invoiceRedirect(params:Record<string,string>):never{
  redirect(`/finance/invoices?${new URLSearchParams(params)}`);
}

const invoiceSchema=z.object({
  direction:z.enum(["issued","received"]),
  invoiceType:z.enum(["vat_general","vat_special","electronic","other"]),
  financeDocumentId:z.union([z.uuid(),z.literal("")]),
  counterpartyName:z.string().trim().max(160),
  invoiceCode:z.string().trim().max(60),
  invoiceNo:z.string().trim().min(3).max(100),
  issuedOn:z.iso.date(),
  amountExcludingTax:z.coerce.number().min(0).max(100_000_000),
  taxAmount:z.coerce.number().min(0).max(100_000_000),
  note:z.string().trim().max(500),
});

export async function createInvoiceAction(formData:FormData){
  await requireCurrentEmployee();
  const parsed=invoiceSchema.safeParse({
    direction:formData.get("direction"),
    invoiceType:formData.get("invoiceType"),
    financeDocumentId:formData.get("financeDocumentId")??"",
    counterpartyName:formData.get("counterpartyName")??"",
    invoiceCode:formData.get("invoiceCode")??"",
    invoiceNo:formData.get("invoiceNo"),
    issuedOn:formData.get("issuedOn"),
    amountExcludingTax:formData.get("amountExcludingTax"),
    taxAmount:formData.get("taxAmount")??0,
    note:formData.get("note")??"",
  });
  if(!parsed.success||(!parsed.data.financeDocumentId&&parsed.data.counterpartyName.length<2)){
    invoiceRedirect({error:"请检查发票号码、日期、金额和往来单位"});
  }
  const supabase=await createClient();
  const {data,error}=await supabase.rpc("create_finance_invoice",{
    p_direction:parsed.data.direction,p_invoice_type:parsed.data.invoiceType,
    p_finance_document_id:parsed.data.financeDocumentId||null,
    p_counterparty_name:parsed.data.counterpartyName||null,p_invoice_code:parsed.data.invoiceCode||null,
    p_invoice_no:parsed.data.invoiceNo,p_issued_on:parsed.data.issuedOn,
    p_amount_excluding_tax:parsed.data.amountExcludingTax,p_tax_amount:parsed.data.taxAmount,
    p_note:parsed.data.note||null,
  });
  if(error||!data){
    console.error("createInvoiceAction failed",error?.code);
    invoiceRedirect({error:error?.message.includes("不匹配")?"发票方向与所选应收应付单据不匹配":"发票登记失败，请检查权限或发票号码是否重复"});
  }
  const result=data as {recordNo?:string};
  revalidatePath("/finance");revalidatePath("/finance/invoices");
  invoiceRedirect({created:`发票记录 ${result.recordNo??""} 已登记`});
}

export async function updateInvoiceStatusAction(formData:FormData){
  await requireCurrentEmployee();
  const invoiceId=String(formData.get("invoiceId")??"");
  const status=String(formData.get("status")??"");
  const note=String(formData.get("note")??"").trim();
  if(!z.uuid().safeParse(invoiceId).success||!["verified","void"].includes(status)||(status==="void"&&note.length<2)){
    invoiceRedirect({error:"发票状态操作无效，作废时必须填写原因"});
  }
  const supabase=await createClient();
  const {error}=await supabase.rpc("update_finance_invoice_status",{p_invoice_id:invoiceId,p_status:status,p_note:note||null});
  if(error) invoiceRedirect({error:"发票状态更新失败"});
  revalidatePath("/finance/invoices");
  invoiceRedirect({created:status==="verified"?"发票已完成核验":"发票已作废"});
}
