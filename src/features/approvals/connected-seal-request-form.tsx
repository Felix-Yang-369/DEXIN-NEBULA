"use client";

import { useActionState, useMemo, useState } from "react";
import {
  CircleAlert,
  FileCheck2,
  Send,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import {
  submitSealRequestAction,
  type SealSubmissionState,
} from "./seal-server-actions";
import {
  buildSealApprovalRoute,
  type SealType,
} from "./seal-workflow";

const initialState: SealSubmissionState = { error: "" };

const SEAL_OPTIONS: Array<{ value: SealType; label: string }> = [
  { value: "company", label: "公司公章" },
  { value: "contract", label: "合同专用章" },
  { value: "finance", label: "财务专用章" },
  { value: "legal_representative", label: "法人章" },
  { value: "other", label: "其他印章" },
];

export function ConnectedSealRequestForm({
  employeeName,
  departmentLabel,
}: {
  employeeName: string;
  departmentLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitSealRequestAction,
    initialState,
  );
  const [sealType, setSealType] = useState<SealType>("company");
  const [isExternal, setIsExternal] = useState(false);
  const route = useMemo(
    () => buildSealApprovalRoute(sealType, isExternal),
    [sealType, isExternal],
  );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <form
        action={formAction}
        className="rounded-md border border-border/80 bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-3 border-b border-border/80 pb-5">
          <span className="grid size-10 place-items-center rounded-md bg-muted text-foreground">
            <Stamp className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-semibold">填写用印申请</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {employeeName} · {departmentLabel}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-primary">
            统一审批
          </span>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium">印章类型 *</span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              name="sealType"
              onChange={(event) => setSealType(event.target.value as SealType)}
              value={sealType}
            >
              {SEAL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium">计划用印日期 *</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              name="useDate"
              required
              type="date"
            />
          </label>

          <label className="block sm:col-span-2">
            <span className="text-xs font-medium">文件 / 事项名称 *</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              maxLength={150}
              minLength={2}
              name="documentTitle"
              placeholder="例如：某某客户年度供货合同"
              required
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium">对方单位</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              maxLength={150}
              name="counterparty"
              placeholder="没有对方单位可不填"
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium">用印份数 *</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              defaultValue={1}
              max={100}
              min={1}
              name="copies"
              required
              type="number"
            />
          </label>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-medium">用印事由 *</span>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-md border border-border bg-muted px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            maxLength={500}
            minLength={5}
            name="purpose"
            placeholder="请说明业务背景、用途及文件主要内容"
            required
          />
        </label>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted p-4">
            <input
              checked={isExternal}
              className="mt-0.5 size-4 accent-primary"
              name="isExternal"
              onChange={(event) => setIsExternal(event.target.checked)}
              type="checkbox"
            />
            <span>
              <span className="block text-xs font-medium">印章需要外带</span>
              <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                外带属于重要用印，自动增加董事长审批。
              </span>
            </span>
          </label>

          <label className="block rounded-md border border-border bg-muted p-4">
            <span className="text-xs font-medium">预计归还日期</span>
            <input
              className="mt-2 h-9 w-full rounded-lg border border-border bg-white px-3 text-xs outline-none disabled:opacity-50"
              disabled={!isExternal}
              name="expectedReturnOn"
              required={isExternal}
              type="date"
            />
          </label>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-medium">备注</span>
          <textarea
            className="mt-2 min-h-20 w-full resize-y rounded-md border border-border bg-muted px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            maxLength={500}
            name="note"
            placeholder="可填写盖章位置、经办人联系方式等补充说明；请勿填写敏感信息"
          />
        </label>

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
            {isPending ? "正在提交…" : "提交用印审批"}
          </button>
        </div>
      </form>

      <aside className="space-y-5">
        <section className="rounded-md border border-border/80 bg-white p-5">
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">审批路线</h2>
          </div>
          <ol className="mt-4 space-y-3">
            {route.map((step, index) => (
              <li className="flex items-center gap-3" key={step.code}>
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <span className="text-xs text-muted-foreground">
                  {step.label}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 rounded-md bg-muted px-3 py-3 text-xs leading-5 text-primary">
            公章、合同章、财务章、法人章或印章外带，均自动增加董事长审批。
          </div>
        </section>

        <section className="rounded-md bg-primary p-5 text-white">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ShieldCheck className="size-3.5" />
            <span className="text-xs font-medium tracking-[0.12em]">
              SEAL CONTROL
            </span>
          </div>
          <h2 className="mt-3 text-base font-semibold">用印规范</h2>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-white/58">
            <li>文件内容确认无误后再提交审批</li>
            <li>不得在空白文件或空白纸张上用印</li>
            <li>实际用印份数须与申请一致</li>
            <li>外带印章按约定日期归还并完成登记</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
