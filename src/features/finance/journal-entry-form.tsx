"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createAccountingJournalAction } from "@/features/finance/accounting-actions";

type AccountOption = { id: string; code: string; name: string };
type Line = { key: number; account_id: string; summary: string; debit_amount: string; credit_amount: string };

export function JournalEntryForm({ accounts, bookId, today }: { accounts: AccountOption[]; bookId: string; today: string }) {
  const [nextKey, setNextKey] = useState(3);
  const [lines, setLines] = useState<Line[]>([
    { key: 1, account_id: accounts[0]?.id ?? "", summary: "", debit_amount: "", credit_amount: "" },
    { key: 2, account_id: accounts[1]?.id ?? accounts[0]?.id ?? "", summary: "", debit_amount: "", credit_amount: "" },
  ]);
  const totals = useMemo(() => lines.reduce((result, line) => ({ debit: result.debit + Number(line.debit_amount || 0), credit: result.credit + Number(line.credit_amount || 0) }), { debit: 0, credit: 0 }), [lines]);
  const payload = JSON.stringify(lines.map(({ account_id, summary, debit_amount, credit_amount }) => ({ account_id, summary, debit_amount: Number(debit_amount || 0), credit_amount: Number(credit_amount || 0) })));
  const balanced = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.001;

  function updateLine(key: number, field: keyof Omit<Line, "key">, value: string) {
    setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line));
  }

  return <form action={createAccountingJournalAction} className="mt-5 space-y-4">
    <input name="bookId" type="hidden" value={bookId} /><input name="lines" type="hidden" value={payload} />
    <div className="grid gap-3 md:grid-cols-[180px_1fr_130px]">
      <label className="text-[10px] text-muted-foreground">凭证日期<input className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-xs text-foreground" defaultValue={today} name="entryDate" required type="date" /></label>
      <label className="text-[10px] text-muted-foreground">凭证摘要<input className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-xs text-foreground" name="summary" placeholder="说明本笔经济业务" required /></label>
      <label className="text-[10px] text-muted-foreground">附件张数<input className="mt-1 h-10 w-full rounded-xl border border-border px-3 text-xs text-foreground" defaultValue="0" min="0" name="attachmentCount" type="number" /></label>
    </div>
    <div className="overflow-x-auto rounded-xl border border-border"><table className="w-full min-w-[780px] text-left text-[10px]"><thead className="bg-[#f5f8fa] text-muted-foreground"><tr><th className="p-3">科目</th><th className="p-3">分录摘要</th><th className="p-3 text-right">借方</th><th className="p-3 text-right">贷方</th><th className="w-12 p-3" /></tr></thead><tbody>
      {lines.map((line) => <tr className="border-t border-border" key={line.key}>
        <td className="p-2"><select className="h-9 w-full rounded-lg border border-border px-2" onChange={(event) => updateLine(line.key, "account_id", event.target.value)} value={line.account_id}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} {account.name}</option>)}</select></td>
        <td className="p-2"><input className="h-9 w-full rounded-lg border border-border px-2" onChange={(event) => updateLine(line.key, "summary", event.target.value)} placeholder="分录摘要" required value={line.summary} /></td>
        <td className="p-2"><input className="h-9 w-full rounded-lg border border-border px-2 text-right tabular-nums" min="0" onChange={(event) => updateLine(line.key, "debit_amount", event.target.value)} step="0.01" type="number" value={line.debit_amount} /></td>
        <td className="p-2"><input className="h-9 w-full rounded-lg border border-border px-2 text-right tabular-nums" min="0" onChange={(event) => updateLine(line.key, "credit_amount", event.target.value)} step="0.01" type="number" value={line.credit_amount} /></td>
        <td className="p-2"><button aria-label="删除分录" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-[#f8eeee] hover:text-[#965151] disabled:opacity-30" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} type="button"><Trash2 className="size-3.5" /></button></td>
      </tr>)}
    </tbody><tfoot><tr className="border-t border-border bg-[#fafcfe] font-medium"><td className="p-3" colSpan={2}>合计 · {balanced ? "借贷平衡" : "借贷未平衡"}</td><td className="p-3 text-right tabular-nums">¥{totals.debit.toFixed(2)}</td><td className="p-3 text-right tabular-nums">¥{totals.credit.toFixed(2)}</td><td /></tr></tfoot></table></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><button className="inline-flex h-9 items-center gap-2 rounded-xl border border-border px-4 text-xs" onClick={() => { setLines((current) => [...current, { key: nextKey, account_id: accounts[0]?.id ?? "", summary: "", debit_amount: "", credit_amount: "" }]); setNextKey((value) => value + 1); }} type="button"><Plus className="size-3.5" />增加分录</button><button className="h-10 rounded-xl bg-primary px-5 text-xs text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40" disabled={!balanced || lines.some((line) => !line.account_id || !line.summary)} type="submit">保存凭证草稿</button></div>
  </form>;
}
