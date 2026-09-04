"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createOpeningBalanceAction } from "@/features/finance/accounting-actions";

type Account = { id: string; code: string; name: string };
type Line = { key: number; account_id: string; debit_amount: string; credit_amount: string };

export function OpeningBalanceForm({ accounts, bookId, fiscalYear }: { accounts: Account[]; bookId: string; fiscalYear: number }) {
  const [nextKey, setNextKey] = useState(3);
  const [lines, setLines] = useState<Line[]>([
    { key: 1, account_id: accounts[0]?.id ?? "", debit_amount: "", credit_amount: "" },
    { key: 2, account_id: accounts[1]?.id ?? accounts[0]?.id ?? "", debit_amount: "", credit_amount: "" },
  ]);
  const totals = useMemo(() => lines.reduce((sum, line) => ({ debit: sum.debit + Number(line.debit_amount || 0), credit: sum.credit + Number(line.credit_amount || 0) }), { debit: 0, credit: 0 }), [lines]);
  const balanced = totals.debit > 0 && Math.abs(totals.debit - totals.credit) < 0.001;
  const payload = JSON.stringify(lines.map(({ account_id, debit_amount, credit_amount }) => ({ account_id, debit_amount: Number(debit_amount || 0), credit_amount: Number(credit_amount || 0) })));
  function update(key: number, field: keyof Omit<Line, "key">, value: string) { setLines((current) => current.map((line) => line.key === key ? { ...line, [field]: value } : line)); }

  return <form action={createOpeningBalanceAction} className="mt-5">
    <input name="bookId" type="hidden" value={bookId} /><input name="fiscalYear" type="hidden" value={fiscalYear} /><input name="lines" type="hidden" value={payload} />
    <div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-muted text-muted-foreground"><tr><th className="p-3">科目</th><th className="p-3 text-right">期初借方</th><th className="p-3 text-right">期初贷方</th><th className="w-12 p-3" /></tr></thead><tbody>
      {lines.map((line) => <tr className="border-t border-border" key={line.key}><td className="p-2"><select className="h-9 w-full rounded-lg border border-border px-2" onChange={(event) => update(line.key, "account_id", event.target.value)} value={line.account_id}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.code} {account.name}</option>)}</select></td><td className="p-2"><input className="h-9 w-full rounded-lg border border-border px-2 text-right tabular-nums" min="0" onChange={(event) => update(line.key, "debit_amount", event.target.value)} step="0.01" type="number" value={line.debit_amount} /></td><td className="p-2"><input className="h-9 w-full rounded-lg border border-border px-2 text-right tabular-nums" min="0" onChange={(event) => update(line.key, "credit_amount", event.target.value)} step="0.01" type="number" value={line.credit_amount} /></td><td className="p-2"><button aria-label="删除期初余额行" className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30" disabled={lines.length <= 2} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} type="button"><Trash2 className="size-3.5" /></button></td></tr>)}
    </tbody><tfoot><tr className="border-t border-border bg-muted font-medium"><td className="p-3">合计 · {balanced ? "借贷平衡" : "借贷未平衡"}</td><td className="p-3 text-right tabular-nums">¥{totals.debit.toFixed(2)}</td><td className="p-3 text-right tabular-nums">¥{totals.credit.toFixed(2)}</td><td /></tr></tfoot></table></div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><button className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-4 text-xs" onClick={() => { setLines((current) => [...current, { key: nextKey, account_id: accounts[0]?.id ?? "", debit_amount: "", credit_amount: "" }]); setNextKey((value) => value + 1); }} type="button"><Plus className="size-3.5" />增加科目</button><button className="h-10 rounded-md bg-primary px-5 text-xs text-primary-foreground disabled:opacity-40" disabled={!balanced || lines.some((line) => !line.account_id || (Number(line.debit_amount || 0) > 0) === (Number(line.credit_amount || 0) > 0))} type="submit">生成期初凭证草稿</button></div>
  </form>;
}
