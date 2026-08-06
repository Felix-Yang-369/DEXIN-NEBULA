"use client";

import { useActionState } from "react";
import { CheckCircle2, Save, Send } from "lucide-react";
import {
  saveWeeklyReportAction,
  type WeeklyReportActionState,
} from "@/features/reports/server-actions";

type EditableReport = {
  completed_work: string;
  ongoing_work: string;
  blockers: string;
  next_week_plan: string;
  status: "draft" | "submitted";
} | null;

const initialState: WeeklyReportActionState = { error: "" };

const fields = [
  {
    name: "completedWork",
    label: "本周完成工作",
    description: "写明已经完成的事项和可验证结果。",
    placeholder: "例如：完成 7 月重点客户报价复核，已向 3 家客户发送正式报价单……",
    valueKey: "completed_work",
  },
  {
    name: "ongoingWork",
    label: "当前推进事项",
    description: "说明进度、计划节点和下一步动作。",
    placeholder: "例如：中秋礼盒方案正在打样，预计周三完成第一轮确认……",
    valueKey: "ongoing_work",
  },
  {
    name: "blockers",
    label: "存在的问题",
    description: "说明阻碍、风险以及需要的协助；如无请填写“暂无”。",
    placeholder: "例如：两款产品采购价格尚未确认，需要采购部在周二前反馈……",
    valueKey: "blockers",
  },
  {
    name: "nextWeekPlan",
    label: "下周工作计划",
    description: "列出重点任务、目标结果和预计完成时间。",
    placeholder: "例如：完成 5 家餐饮客户回访，并形成客户需求清单……",
    valueKey: "next_week_plan",
  },
] as const;

export function WeeklyReportForm({
  weekStart,
  report,
}: {
  weekStart: string;
  report: EditableReport;
}) {
  const [state, formAction, pending] = useActionState(
    saveWeeklyReportAction,
    initialState,
  );
  const locked = report?.status === "submitted";

  if (locked) {
    return (
      <div className="rounded-[22px] border border-[#d9e8ee] bg-[#eef4f8] p-6 text-center">
        <CheckCircle2 className="mx-auto size-7 text-primary" />
        <h2 className="mt-3 text-sm font-semibold text-[#234b42]">
          本周期周报已经提交
        </h2>
        <p className="mt-2 text-xs text-[#5c7587]">
          提交后的内容已锁定，可在下方“我的周报”中查看完整内容。
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <input name="weekStart" type="hidden" value={weekStart} />
      <div className="grid gap-5 xl:grid-cols-2">
        {fields.map((field, index) => (
          <label
            className="block rounded-[18px] border border-border/80 bg-[#fbfcfc] p-4 transition-colors focus-within:border-primary/25 focus-within:bg-white"
            key={field.name}
          >
            <span className="flex items-start gap-3">
              <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#e8f3ef] text-[10px] font-semibold text-primary">
                {index + 1}
              </span>
              <span>
                <span className="block text-xs font-semibold text-[#294b65]">
                  {field.label}
                </span>
                <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">
                  {field.description}
                </span>
              </span>
            </span>
            <textarea
              className="mt-4 min-h-36 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-xs leading-6 outline-none transition focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              defaultValue={report?.[field.valueKey] ?? ""}
              disabled={pending}
              maxLength={5000}
              name={field.name}
              placeholder={field.placeholder}
              required
            />
          </label>
        ))}
      </div>

      {state.error && (
        <div
          className="mt-5 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-4 py-3 text-xs text-[#965151]"
          role="alert"
        >
          {state.error}
        </div>
      )}

      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-border/75 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[10px] leading-5 text-muted-foreground">
          草稿仅本人可见；提交后直属负责人将收到站内通知，内容不可再次修改。
        </p>
        <div className="flex gap-2">
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            disabled={pending}
            name="intent"
            type="submit"
            value="draft"
          >
            <Save className="size-3.5" />
            {pending ? "保存中" : "保存草稿"}
          </button>
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-xs font-medium text-primary-foreground transition-colors hover:bg-[#184c41] disabled:opacity-50"
            disabled={pending}
            name="intent"
            type="submit"
            value="submit"
          >
            <Send className="size-3.5" />
            {pending ? "提交中" : "提交周报"}
          </button>
        </div>
      </div>
    </form>
  );
}
