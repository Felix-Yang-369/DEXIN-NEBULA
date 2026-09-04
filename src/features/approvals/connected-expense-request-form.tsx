"use client";

import { useActionState, useState } from "react";
import {
  CircleAlert,
  CircleDollarSign,
  FileCheck2,
  ReceiptText,
  Send,
} from "lucide-react";
import {
  submitExpenseClaimAction,
  type ExpenseSubmissionState,
} from "./expense-server-actions";
import {
  buildExpenseApprovalRoute,
  EXPENSE_CHAIRMAN_THRESHOLD,
} from "./expense-workflow";

const initialState: ExpenseSubmissionState = { error: "" };

export function ConnectedExpenseRequestForm({
  employeeName,
  departmentLabel,
}: {
  employeeName: string;
  departmentLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitExpenseClaimAction,
    initialState,
  );
  const [amount, setAmount] = useState("");
  const [hasInvoice, setHasInvoice] = useState(false);
  const amountValue = Number(amount);
  const approvalRoute =
    Number.isFinite(amountValue) && amountValue > 0
      ? buildExpenseApprovalRoute(amountValue)
      : [];
  const needsChairman = approvalRoute.some(
    (step) => step.code === "chairman_approval",
  );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <form
        action={formAction}
        className="rounded-md border border-border/80 bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-3 border-b border-border/80 pb-5">
          <span className="grid size-10 place-items-center rounded-md bg-muted text-primary">
            <ReceiptText className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-semibold">填写费用报销</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {employeeName} · {departmentLabel}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-primary">
            通用审批 V1
          </span>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium">费用类别 *</span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              defaultValue="transport"
              name="expenseCategory"
            >
              <option value="travel">差旅费</option>
              <option value="transport">交通费</option>
              <option value="hospitality">业务招待费</option>
              <option value="office">办公费</option>
              <option value="purchase">零星采购</option>
              <option value="other">其他费用</option>
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium">费用发生日期 *</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              name="occurredOn"
              required
              type="date"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium">报销金额（元）*</span>
            <div className="relative mt-2">
              <CircleDollarSign className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                className="h-11 w-full rounded-md border border-border bg-muted pl-9 pr-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
                max="1000000"
                min="0.01"
                name="amount"
                onChange={(event) => setAmount(event.target.value)}
                placeholder="0.00"
                required
                step="0.01"
                type="number"
                value={amount}
              />
            </div>
          </label>

          <label className="block">
            <span className="text-xs font-medium">收款方 / 商户</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              maxLength={100}
              name="vendor"
              placeholder="例如：某某酒店、出租车平台"
            />
          </label>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-medium">费用说明 *</span>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-md border border-border bg-muted px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            maxLength={500}
            minLength={5}
            name="description"
            placeholder="请说明费用用途、对应客户或事项"
            required
          />
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted p-4">
            <input
              checked={hasInvoice}
              className="mt-0.5 size-4 accent-primary"
              name="hasInvoice"
              onChange={(event) => setHasInvoice(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-xs font-medium">已取得发票</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                当前先记录张数，电子附件将在文件服务接入后上传。
              </span>
            </span>
          </label>

          <label className="block rounded-md border border-border bg-muted p-4">
            <span className="text-xs font-medium">发票张数</span>
            <input
              className="mt-2 h-9 w-full rounded-lg border border-border bg-white px-3 text-xs outline-none disabled:opacity-50"
              disabled={!hasInvoice}
              max="100"
              min="0"
              name="invoiceCount"
              required={hasInvoice}
              type="number"
            />
          </label>
        </div>

        {state.error && (
          <div className="mt-5 flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-xs text-foreground">
            <CircleAlert className="size-3.5 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-border/80 pt-5">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            <Send className="size-3.5" />
            {isPending ? "正在提交…" : "提交报销审批"}
          </button>
        </div>
      </form>

      <aside className="space-y-5">
        <section className="rounded-md border border-border/80 bg-white p-5">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">审批路线</h2>
          </div>
          <p className="mt-4 text-xs leading-6 text-muted-foreground">
            {needsChairman
              ? "员工提交 → 直属负责人 → 财务复核 → 董事长审批"
              : "员工提交 → 直属负责人 → 财务复核"}
          </p>
          <div className="mt-4 rounded-md bg-muted px-3 py-3 text-xs leading-5 text-primary">
            超过 {EXPENSE_CHAIRMAN_THRESHOLD.toLocaleString("zh-CN")}{" "}
            元自动增加董事长审批节点；该金额为内部试行阈值，正式上线前需由公司确认。
          </div>
        </section>

        <section className="rounded-md bg-primary p-5 text-white">
          <div className="text-xs font-medium tracking-[0.12em] text-muted-foreground">
            SUBMISSION CHECKLIST
          </div>
          <h2 className="mt-3 text-base font-semibold">提交前检查</h2>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-white/58">
            <li>费用日期、金额和实际凭证一致</li>
            <li>说明中写清对应事项和用途</li>
            <li>纸质或电子发票妥善保存</li>
            <li>不得填写银行卡等敏感信息</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
