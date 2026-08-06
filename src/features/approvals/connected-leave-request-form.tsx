"use client";

import { useActionState, useMemo, useState } from "react";
import { CalendarRange, CircleAlert, Send } from "lucide-react";
import {
  submitLeaveRequestAction,
  type LeaveSubmissionState,
} from "./server-actions";

const initialState: LeaveSubmissionState = { error: "" };

function calculateDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / 86_400_000) + 1;
}

export function ConnectedLeaveRequestForm({
  employeeName,
  departmentLabel,
}: {
  employeeName: string;
  departmentLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(
    submitLeaveRequestAction,
    initialState,
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isEmergency, setIsEmergency] = useState(false);
  const leaveDays = useMemo(
    () => calculateDays(startDate, endDate),
    [startDate, endDate],
  );

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <form
        action={formAction}
        className="rounded-[22px] border border-border/80 bg-white p-5 sm:p-6"
      >
        <div className="flex items-center gap-3 border-b border-border/80 pb-5">
          <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-primary">
            <Send className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-semibold">填写请假申请</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              {employeeName} · {departmentLabel}
            </p>
          </div>
          <span className="ml-auto rounded-full bg-[#eaf3f8] px-2.5 py-1 text-[9px] font-medium text-primary">
            Supabase 已连接
          </span>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium">请假类型 *</span>
            <select
              className="mt-2 h-11 w-full rounded-xl border border-border bg-[#fafcfe] px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              defaultValue="welfare"
              name="leaveType"
            >
              <option value="welfare">福利假</option>
              <option value="sick">病假</option>
              <option value="personal">事假</option>
              <option value="marriage">婚假</option>
              <option value="bereavement">丧假</option>
              <option value="maternity">产假</option>
              <option value="paternity">陪产假</option>
              <option value="work_injury">工伤假</option>
              <option value="other">其他法定假期</option>
            </select>
          </label>
          <div className="rounded-xl border border-[#c8d9d4] bg-[#eef4f8] px-4 py-3">
            <div className="text-[10px] text-primary/75">预计请假天数</div>
            <div className="mt-1 text-xl font-semibold text-primary">
              {leaveDays || "—"}
              {leaveDays > 0 && <span className="ml-1 text-xs">天</span>}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-medium">开始日期 *</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-border bg-[#fafcfe] px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              name="startDate"
              onChange={(event) => setStartDate(event.target.value)}
              required
              type="date"
              value={startDate}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium">结束日期 *</span>
            <input
              className="mt-2 h-11 w-full rounded-xl border border-border bg-[#fafcfe] px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              name="endDate"
              onChange={(event) => setEndDate(event.target.value)}
              required
              type="date"
              value={endDate}
            />
          </label>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-medium">请假事由 *</span>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-xl border border-border bg-[#fafcfe] px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            minLength={5}
            name="reason"
            placeholder="请说明请假原因；敏感诊断材料请通过受控附件提交"
            required
          />
        </label>

        <label className="mt-5 block">
          <span className="text-xs font-medium">工作交接 *</span>
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-xl border border-border bg-[#fafcfe] px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            minLength={2}
            name="handover"
            placeholder="填写工作交接对象和事项"
            required
          />
        </label>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-[#fafcfe] p-4">
          <input
            checked={isEmergency}
            className="mt-0.5 size-4 accent-[#0d6c78]"
            name="isEmergency"
            onChange={(event) => setIsEmergency(event.target.checked)}
            type="checkbox"
          />
          <span>
            <span className="block text-xs font-medium">紧急情况补办</span>
            <span className="mt-1 block text-[10px] leading-5 text-muted-foreground">
              应先通过电话或企业微信通知直属主管，并在返岗后补办手续。
            </span>
          </span>
        </label>

        {isEmergency && (
          <label className="mt-4 block">
            <span className="text-xs font-medium">紧急情况说明 *</span>
            <textarea
              className="mt-2 min-h-20 w-full resize-y rounded-xl border border-border bg-[#fafcfe] px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              minLength={5}
              name="emergencyNote"
              placeholder="说明紧急原因、通知时间和通知方式"
              required
            />
          </label>
        )}

        {state.error && (
          <div className="mt-5 flex items-center gap-2 rounded-xl bg-[#fff8ee] px-3 py-2.5 text-[10px] text-[#8b6d46]">
            <CircleAlert className="size-3.5 shrink-0" />
            {state.error}
          </div>
        )}

        <div className="mt-6 flex justify-end border-t border-border/80 pt-5">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            <Send className="size-3.5" />
            {isPending ? "正在提交…" : "提交审批"}
          </button>
        </div>
      </form>

      <aside className="space-y-5">
        <section className="rounded-[22px] border border-border/80 bg-white p-5">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">审批路线</h2>
          </div>
          <p className="mt-4 text-[10px] leading-6 text-muted-foreground">
            {leaveDays > 1
              ? "员工提交 → 直属上级 → 董事长 → 行政人事备案"
              : "员工提交 → 直属上级 → 行政人事备案"}
          </p>
          <div className="mt-4 rounded-xl bg-[#eef4f8] px-3 py-3 text-[10px] leading-5 text-primary">
            直属上级来自员工档案的负责人关系；董事长与人事节点来自角色分配。
          </div>
        </section>

        <section className="rounded-[22px] bg-[#0a385d] p-5 text-white">
          <div className="text-[10px] font-medium tracking-[0.12em] text-[#79d8d5]">
            SERVER ENFORCED
          </div>
          <h2 className="mt-3 text-sm font-semibold">服务端安全校验</h2>
          <ul className="mt-4 space-y-3 text-[10px] leading-5 text-white/58">
            <li>● 登录身份从服务端会话读取。</li>
            <li>● 员工必须处于在职状态。</li>
            <li>● 审批人和下一节点由数据库决定。</li>
            <li>● 重复审批通过版本号阻止。</li>
          </ul>
        </section>
      </aside>
    </div>
  );
}
