"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

const journalLineSchema = z.object({
  account_id: z.uuid(),
  summary: z.string().trim().min(1).max(200),
  debit_amount: z.number().nonnegative().max(1_000_000_000),
  credit_amount: z.number().nonnegative().max(1_000_000_000),
}).refine((line) => (line.debit_amount > 0) !== (line.credit_amount > 0));

const journalSchema = z.object({
  bookId: z.uuid(),
  entryDate: z.iso.date(),
  summary: z.string().trim().min(2).max(200),
  attachmentCount: z.coerce.number().int().min(0).max(999),
  lines: z.array(journalLineSchema).min(2).max(100),
});

function journalError(message?: string) {
  if (message?.includes("权限") || message?.includes("财务角色")) return "forbidden";
  if (message?.includes("开放会计期间")) return "period_closed";
  if (message?.includes("借贷")) return "unbalanced";
  if (message?.includes("制单人")) return "self_review";
  if (message?.includes("版本")) return "stale";
  if (message?.includes("状态")) return "invalid_transition";
  return "operation_failed";
}

export async function createAccountingJournalAction(formData: FormData) {
  await requireCurrentEmployee();

  let rawLines: unknown = [];
  try { rawLines = JSON.parse(String(formData.get("lines") ?? "[]")); } catch { rawLines = []; }
  const parsed = journalSchema.safeParse({
    bookId: formData.get("bookId"), entryDate: formData.get("entryDate"),
    summary: formData.get("summary"), attachmentCount: formData.get("attachmentCount"), lines: rawLines,
  });
  if (!parsed.success) redirect("/finance/accounting?error=invalid_entry#new-entry");

  const debit = parsed.data.lines.reduce((sum, line) => sum + line.debit_amount, 0);
  const credit = parsed.data.lines.reduce((sum, line) => sum + line.credit_amount, 0);
  if (Math.abs(debit - credit) > 0.001 || debit <= 0) {
    redirect("/finance/accounting?error=unbalanced#new-entry");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_journal_entry", {
    p_book_id: parsed.data.bookId, p_entry_date: parsed.data.entryDate,
    p_summary: parsed.data.summary, p_attachment_count: parsed.data.attachmentCount,
    p_lines: parsed.data.lines,
  });
  if (error) redirect(`/finance/accounting?error=${journalError(error.message)}#new-entry`);

  const result = data as { entryNo?: string } | null;
  revalidatePath("/finance/accounting"); revalidatePath("/audit");
  redirect(`/finance/accounting?saved=${encodeURIComponent(result?.entryNo ?? "1")}#entries`);
}

export async function transitionAccountingJournalAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({ entryId: z.uuid(), action: z.enum(["review", "post"]), version: z.coerce.number().int().positive(), sourceType: z.string().max(50).optional() }).safeParse({
    entryId: formData.get("entryId"), action: formData.get("action"), version: formData.get("version"), sourceType: formData.get("sourceType") || undefined,
  });
  if (!parsed.success) redirect("/finance/accounting?error=invalid_transition#entries");

  const supabase = await createClient();
  const transition = parsed.data.sourceType === "period_close_reversal"
    ? await supabase.rpc("transition_period_reopening_entry", {
        p_entry_id: parsed.data.entryId, p_action: parsed.data.action, p_expected_version: parsed.data.version,
      })
    : await supabase.rpc("transition_journal_entry", {
        p_entry_id: parsed.data.entryId, p_action: parsed.data.action, p_expected_version: parsed.data.version,
      });
  const { error } = transition;
  if (error) redirect(`/finance/accounting?error=${journalError(error.message)}#entries`);

  revalidatePath("/finance/accounting"); revalidatePath("/audit");
  redirect(`/finance/accounting?transitioned=${parsed.data.action}#entries`);
}

const nullableUuid = z.preprocess(
  (value) => value === "" || value === null ? null : value,
  z.uuid().nullable(),
);

const accountSchema = z.object({
  bookId: z.uuid(),
  accountId: nullableUuid,
  code: z.string().trim().regex(/^[0-9]{4,12}$/),
  name: z.string().trim().min(2).max(80),
  category: z.enum(["asset", "liability", "equity", "cost", "profit_loss"]),
  normalBalance: z.enum(["debit", "credit"]),
  status: z.enum(["active", "inactive"]),
});

export async function saveAccountingAccountAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = accountSchema.safeParse({
    bookId: formData.get("bookId"), accountId: formData.get("accountId"),
    code: formData.get("code"), name: formData.get("name"),
    category: formData.get("category"), normalBalance: formData.get("normalBalance"),
    status: formData.get("status"),
  });
  if (!parsed.success) redirect("/finance/accounting/settings?error=invalid_account#accounts");

  const supabase = await createClient();
  const { error } = await supabase.rpc("manage_accounting_account", {
    p_book_id: parsed.data.bookId, p_account_id: parsed.data.accountId,
    p_code: parsed.data.code, p_name: parsed.data.name,
    p_category: parsed.data.category, p_normal_balance: parsed.data.normalBalance,
    p_allow_posting: formData.get("allowPosting") === "on",
    p_requires_counterparty: formData.get("requiresCounterparty") === "on",
    p_requires_department: formData.get("requiresDepartment") === "on",
    p_requires_project: formData.get("requiresProject") === "on",
    p_status: parsed.data.status,
  });
  if (error) {
    const code = error.message.includes("已使用科目") ? "account_in_use"
      : error.message.includes("权限") ? "forbidden" : error.code === "23505" ? "duplicate_account" : "account_failed";
    redirect(`/finance/accounting/settings?error=${code}#accounts`);
  }
  revalidatePath("/finance/accounting"); revalidatePath("/finance/accounting/settings"); revalidatePath("/audit");
  redirect("/finance/accounting/settings?saved=account#accounts");
}

export async function transitionFiscalPeriodAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({ periodId: z.uuid(), action: z.enum(["open", "close", "reopen"]), confirmation: z.string().trim().min(2).max(30) }).safeParse({
    periodId: formData.get("periodId"), action: formData.get("action"), confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect("/finance/accounting/settings?error=invalid_period#periods");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transition_fiscal_period", {
    p_period_id: parsed.data.periodId, p_action: parsed.data.action, p_confirmation: parsed.data.confirmation,
  });
  if (error) {
    const code = error.message.includes("未确认的关账警告") ? "closing_warnings_unacknowledged"
      : error.message.includes("关账仍存在阻断项") ? "closing_blockers"
      : error.message.includes("未过账") ? "unposted_entries"
      : error.message.includes("损益结转凭证") ? "closing_required"
      : error.message.includes("不支持直接反结账") ? "closing_reopen_blocked"
      : error.message.includes("按顺序") || error.message.includes("更早") || error.message.includes("更晚") ? "period_order"
        : error.message.includes("确认") ? "period_confirmation"
          : error.message.includes("权限") || error.message.includes("董事长") ? "forbidden" : "period_failed";
    redirect(`/finance/accounting/settings?error=${code}#periods`);
  }
  revalidatePath("/finance/accounting"); revalidatePath("/finance/accounting/settings"); revalidatePath("/audit");
  redirect(`/finance/accounting/settings?saved=period_${parsed.data.action}#periods`);
}

export async function createFiscalYearAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({ bookId: z.uuid(), fiscalYear: z.coerce.number().int().min(2000).max(2200) }).safeParse({
    bookId: formData.get("bookId"), fiscalYear: formData.get("fiscalYear"),
  });
  if (!parsed.success) redirect("/finance/accounting/settings?error=invalid_year#periods");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_fiscal_year", {
    p_book_id: parsed.data.bookId, p_fiscal_year: parsed.data.fiscalYear,
  });
  if (error) {
    const code = error.message.includes("权限") ? "forbidden" : "invalid_year";
    redirect(`/finance/accounting/settings?error=${code}#periods`);
  }
  revalidatePath("/finance/accounting/settings"); revalidatePath("/audit");
  redirect(`/finance/accounting/settings?saved=fiscal_year#periods`);
}

export async function reverseAccountingJournalAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({
    entryId: z.uuid(), reversalDate: z.iso.date(), reason: z.string().trim().min(5).max(200), confirmation: z.string().trim().min(4).max(40),
  }).safeParse({
    entryId: formData.get("entryId"), reversalDate: formData.get("reversalDate"),
    reason: formData.get("reason"), confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect(`/finance/accounting/entries/${String(formData.get("entryId") ?? "")}?error=invalid_reversal`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reverse_journal_entry", {
    p_entry_id: parsed.data.entryId, p_reversal_date: parsed.data.reversalDate,
    p_reason: parsed.data.reason, p_confirmation: parsed.data.confirmation,
  });
  if (error) {
    const code = error.message.includes("开放会计期间") ? "period_closed"
      : error.message.includes("权限") ? "forbidden" : "reversal_failed";
    redirect(`/finance/accounting/entries/${parsed.data.entryId}?error=${code}`);
  }
  const result = data as { entryNo?: string } | null;
  revalidatePath("/finance/accounting"); revalidatePath(`/finance/accounting/entries/${parsed.data.entryId}`); revalidatePath("/finance/accounting/ledger"); revalidatePath("/audit");
  redirect(`/finance/accounting/entries/${parsed.data.entryId}?reversed=${encodeURIComponent(result?.entryNo ?? "1")}`);
}

const openingLineSchema = z.object({
  account_id: z.uuid(),
  debit_amount: z.number().nonnegative().max(1_000_000_000),
  credit_amount: z.number().nonnegative().max(1_000_000_000),
}).refine((line) => (line.debit_amount > 0) !== (line.credit_amount > 0));

export async function createOpeningBalanceAction(formData: FormData) {
  await requireCurrentEmployee();
  let rawLines: unknown = [];
  try { rawLines = JSON.parse(String(formData.get("lines") ?? "[]")); } catch { rawLines = []; }
  const parsed = z.object({
    bookId: z.uuid(), fiscalYear: z.coerce.number().int().min(2000).max(2200),
    lines: z.array(openingLineSchema).min(2).max(200),
  }).safeParse({ bookId: formData.get("bookId"), fiscalYear: formData.get("fiscalYear"), lines: rawLines });
  if (!parsed.success) redirect("/finance/accounting/opening?error=invalid_opening");
  const debit = parsed.data.lines.reduce((sum, line) => sum + line.debit_amount, 0);
  const credit = parsed.data.lines.reduce((sum, line) => sum + line.credit_amount, 0);
  if (debit <= 0 || Math.abs(debit - credit) > 0.001) redirect("/finance/accounting/opening?error=unbalanced");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_opening_balance_entry", {
    p_book_id: parsed.data.bookId, p_fiscal_year: parsed.data.fiscalYear, p_lines: parsed.data.lines,
  });
  if (error) {
    const code = error.message.includes("已有会计凭证") ? "year_in_use"
      : error.message.includes("权限") ? "forbidden" : error.message.includes("借贷") ? "unbalanced" : "opening_failed";
    redirect(`/finance/accounting/opening?error=${code}`);
  }
  const result = data as { id?: string; entryNo?: string } | null;
  revalidatePath("/finance/accounting"); revalidatePath("/finance/accounting/opening"); revalidatePath("/audit");
  redirect(result?.id ? `/finance/accounting/entries/${result.id}?created=opening` : "/finance/accounting/opening?saved=1");
}

export async function generatePeriodClosingAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({ periodId: z.uuid(), confirmation: z.string().trim().min(2).max(30) }).safeParse({
    periodId: formData.get("periodId"), confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect("/finance/accounting/closing?error=invalid_confirmation");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_period_closing_entry", {
    p_period_id: parsed.data.periodId, p_confirmation: parsed.data.confirmation,
  });
  if (error) {
    const code = error.message.includes("未过账") ? "unposted_entries"
      : error.message.includes("没有需要结转") ? "nothing_to_close"
        : error.message.includes("已经生成") ? "already_generated"
          : error.message.includes("权限") ? "forbidden" : "closing_failed";
    redirect(`/finance/accounting/closing?error=${code}`);
  }
  const result = data as { id?: string } | null;
  revalidatePath("/finance/accounting"); revalidatePath("/finance/accounting/closing"); revalidatePath("/finance/accounting/settings"); revalidatePath("/audit");
  redirect(result?.id ? `/finance/accounting/entries/${result.id}?created=closing` : "/finance/accounting/closing?saved=1");
}

export async function acknowledgeAccountingCloseWarningsAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({ periodId: z.uuid(), note: z.string().trim().min(5).max(500) }).safeParse({
    periodId: formData.get("periodId"), note: formData.get("note"),
  });
  if (!parsed.success) redirect("/finance/accounting/closing?error=invalid_warning_note");
  const supabase = await createClient();
  const { error } = await supabase.rpc("acknowledge_accounting_close_warnings", {
    p_period_id: parsed.data.periodId, p_note: parsed.data.note,
  });
  if (error) redirect(`/finance/accounting/closing?period=${parsed.data.periodId}&error=${error.message.includes("权限") ? "forbidden" : "warning_ack_failed"}`);
  revalidatePath("/finance/accounting/closing"); revalidatePath("/audit");
  redirect(`/finance/accounting/closing?period=${parsed.data.periodId}&saved=warnings`);
}

export async function requestPeriodReopeningAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({ periodId: z.uuid(), reason: z.string().trim().min(5).max(200), confirmation: z.string().trim().min(2).max(30) }).safeParse({
    periodId: formData.get("periodId"), reason: formData.get("reason"), confirmation: formData.get("confirmation"),
  });
  if (!parsed.success) redirect("/finance/accounting/closing?error=invalid_reopening");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_period_reopening", {
    p_period_id: parsed.data.periodId, p_reason: parsed.data.reason, p_confirmation: parsed.data.confirmation,
  });
  if (error) {
    const code = error.message.includes("更晚") ? "period_order"
      : error.message.includes("权限") ? "forbidden" : "reopening_failed";
    redirect(`/finance/accounting/closing?period=${parsed.data.periodId}&error=${code}`);
  }
  const result = data as { id?: string } | null;
  revalidatePath("/finance/accounting"); revalidatePath("/finance/accounting/closing"); revalidatePath("/finance/accounting/settings"); revalidatePath("/audit");
  redirect(result?.id ? `/finance/accounting/entries/${result.id}?created=reopening` : "/finance/accounting/closing?saved=reopening");
}

export async function configureCashFlowRuleAction(formData: FormData) {
  await requireCurrentEmployee();
  const parsed = z.object({ accountId: z.uuid(), cashFlowItemId: z.uuid() }).safeParse({
    accountId: formData.get("accountId"), cashFlowItemId: formData.get("cashFlowItemId"),
  });
  if (!parsed.success) redirect("/finance/accounting/statements?error=invalid_rule#cashflow-rules");
  const supabase = await createClient();
  const { error } = await supabase.rpc("configure_account_cash_flow_rule", {
    p_account_id: parsed.data.accountId, p_cash_flow_item_id: parsed.data.cashFlowItemId,
  });
  if (error) redirect(`/finance/accounting/statements?error=${error.message.includes("权限") ? "forbidden" : "rule_failed"}#cashflow-rules`);
  revalidatePath("/finance/accounting/statements"); revalidatePath("/audit");
  redirect("/finance/accounting/statements?saved=cashflow_rule#cashflow-rules");
}
