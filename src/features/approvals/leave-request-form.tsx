"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarRange,
  CircleAlert,
  FilePenLine,
  Save,
  Send,
} from "lucide-react";
import { useDemoLeaveRequest } from "./demo-leave-store";
import {
  calculateLeaveDays,
  createLeaveDraft,
  transitionLeaveRequest,
  updateLeaveDraft,
  validateLeaveRequest,
  type LeaveRequestInput,
} from "./leave-workflow";

const initialInput: LeaveRequestInput = {
  leaveType: "welfare",
  startDate: "2026-08-03",
  endDate: "2026-08-05",
  reason: "",
  handover: "",
  isEmergency: false,
  emergencyNote: "",
};

const leaveTypeLabels: Record<LeaveRequestInput["leaveType"], string> = {
  welfare: "福利假",
  sick: "病假",
  personal: "事假",
  marriage: "婚假",
  bereavement: "丧假",
  maternity: "产假",
  paternity: "陪产假",
  work_injury: "工伤假",
  other: "其他法定假期",
};

export function LeaveRequestForm() {
  const router = useRouter();
  const { request, isReady, saveRequest, clearRequest } =
    useDemoLeaveRequest();
  const [input, setInput] = useState<LeaveRequestInput>(initialInput);
  const [errors, setErrors] = useState<
    Partial<Record<keyof LeaveRequestInput, string>>
  >({});
  const [feedback, setFeedback] = useState("");

  const canEdit =
    !request || request.status === "draft" || request.status === "returned";

  useEffect(() => {
    if (
      request &&
      (request.status === "draft" || request.status === "returned")
    ) {
      const timer = window.setTimeout(() => {
        setInput({
          leaveType: request.leaveType,
          startDate: request.startDate,
          endDate: request.endDate,
          reason: request.reason,
          handover: request.handover,
          isEmergency: request.isEmergency,
          emergencyNote: request.emergencyNote,
        });
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [request]);

  const leaveDays = useMemo(
    () => calculateLeaveDays(input.startDate, input.endDate),
    [input.endDate, input.startDate],
  );

  function updateField<K extends keyof LeaveRequestInput>(
    field: K,
    value: LeaveRequestInput[K],
  ) {
    setInput((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setFeedback("");
  }

  function buildDraft() {
    const now = new Date().toISOString();

    if (request) {
      return updateLeaveDraft({ request, input, now });
    }

    return createLeaveDraft({
      id: `DX-LV-DEMO-${Date.now().toString().slice(-6)}`,
      input,
      now,
    });
  }

  function handleSaveDraft() {
    try {
      const draft = buildDraft();
      saveRequest(draft);
      setFeedback("草稿已保存在当前浏览器中");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "保存失败");
    }
  }

  function handleSubmit() {
    const nextErrors = validateLeaveRequest(input);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setFeedback("请先完善必填信息");
      return;
    }

    try {
      const draft = buildDraft();
      const submitted = transitionLeaveRequest({
        request: draft,
        command: {
          type: request?.status === "returned" ? "resubmit" : "submit",
          actor: { role: "employee", name: "演示员工" },
          opinion:
            request?.status === "returned" ? "已修改并重新提交" : "提交申请",
        },
        now: new Date().toISOString(),
      });
      saveRequest(submitted);
      router.push("/approvals");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "提交失败");
    }
  }

  if (!isReady) {
    return (
      <div className="rounded-md border border-border/80 bg-white p-8 text-center text-xs text-muted-foreground">
        正在读取本机演示申请…
      </div>
    );
  }

  if (!canEdit && request) {
    return (
      <section className="rounded-md border border-border/80 bg-white p-6 sm:p-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-lg bg-muted text-primary">
            <Send className="size-6" />
          </span>
          <h2 className="mt-5 text-lg font-semibold">已有进行中的请假申请</h2>
          <p className="mt-2 text-xs leading-6 text-muted-foreground">
            申请编号 {request.id}，当前状态为 {request.status}。
            请先在审批中心完成或撤回该演示流程。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link
              className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground"
              href="/approvals"
            >
              前往审批中心
            </Link>
            <button
              className="h-10 rounded-md border border-border bg-white px-4 text-xs font-medium text-muted-foreground"
              onClick={() => {
                clearRequest();
                setInput(initialInput);
              }}
              type="button"
            >
              重置演示数据
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
      <section className="rounded-md border border-border/80 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3 border-b border-border/80 pb-5">
          <span className="grid size-10 place-items-center rounded-md bg-muted text-primary">
            <FilePenLine className="size-[18px]" />
          </span>
          <div>
            <h2 className="text-base font-semibold">
              {request?.status === "returned" ? "修改请假申请" : "填写请假申请"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              演示员工 · 演示部门
            </p>
          </div>
          {request && (
            <span className="ml-auto rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground">
              {request.status === "returned" ? "已退回" : "草稿"}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-medium">请假类型 *</span>
            <select
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              onChange={(event) =>
                updateField(
                  "leaveType",
                  event.target.value as LeaveRequestInput["leaveType"],
                )
              }
              value={input.leaveType}
            >
              {Object.entries(leaveTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="rounded-md border border-border bg-muted px-4 py-3">
            <div className="text-xs text-primary/75">预计请假天数</div>
            <div className="mt-1 text-xl font-semibold text-primary">
              {leaveDays || "—"}
              {leaveDays > 0 && <span className="ml-1 text-xs">天</span>}
            </div>
          </div>
          <label className="block">
            <span className="text-xs font-medium">开始日期 *</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              onChange={(event) => updateField("startDate", event.target.value)}
              type="date"
              value={input.startDate}
            />
            {errors.startDate && (
              <span className="mt-1 block text-xs text-foreground">
                {errors.startDate}
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-xs font-medium">结束日期 *</span>
            <input
              className="mt-2 h-11 w-full rounded-md border border-border bg-muted px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              onChange={(event) => updateField("endDate", event.target.value)}
              type="date"
              value={input.endDate}
            />
            {errors.endDate && (
              <span className="mt-1 block text-xs text-foreground">
                {errors.endDate}
              </span>
            )}
          </label>
        </div>

        <label className="mt-5 block">
          <span className="text-xs font-medium">请假事由 *</span>
          <textarea
            className="mt-2 min-h-28 w-full resize-y rounded-md border border-border bg-muted px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            onChange={(event) => updateField("reason", event.target.value)}
            placeholder="请说明请假原因，演示环境请勿填写真实隐私信息"
            value={input.reason}
          />
          {errors.reason && (
            <span className="mt-1 block text-xs text-foreground">
              {errors.reason}
            </span>
          )}
        </label>

        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-md border border-border bg-muted p-4">
          <input
            checked={input.isEmergency}
            className="mt-0.5 size-4 accent-primary"
            onChange={(event) =>
              updateField("isEmergency", event.target.checked)
            }
            type="checkbox"
          />
          <span>
            <span className="block text-xs font-medium">紧急情况补办</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">
              仅用于突发情况。应先通过电话或企业微信通知直属主管，并在返岗后补办手续。
            </span>
          </span>
        </label>

        {input.isEmergency && (
          <label className="mt-4 block">
            <span className="text-xs font-medium">紧急情况说明 *</span>
            <textarea
              className="mt-2 min-h-20 w-full resize-y rounded-md border border-border bg-muted px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
              onChange={(event) =>
                updateField("emergencyNote", event.target.value)
              }
              placeholder="说明紧急原因、通知时间和通知方式"
              value={input.emergencyNote}
            />
            {errors.emergencyNote && (
              <span className="mt-1 block text-xs text-foreground">
                {errors.emergencyNote}
              </span>
            )}
          </label>
        )}

        <label className="mt-5 block">
          <span className="text-xs font-medium">工作交接 *</span>
          <textarea
            className="mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-muted px-3 py-3 text-xs leading-6 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            onChange={(event) => updateField("handover", event.target.value)}
            placeholder="填写工作交接对象和事项"
            value={input.handover}
          />
          {errors.handover && (
            <span className="mt-1 block text-xs text-foreground">
              {errors.handover}
            </span>
          )}
        </label>

        {feedback && (
          <div className="mt-5 flex items-center gap-2 rounded-md bg-muted px-3 py-2.5 text-xs text-foreground">
            <CircleAlert className="size-3.5 shrink-0" />
            {feedback}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-border/80 pt-5">
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
            onClick={handleSaveDraft}
            type="button"
          >
            <Save className="size-3.5" />
            保存草稿
          </button>
          <button
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground "
            onClick={handleSubmit}
            type="button"
          >
            <Send className="size-3.5" />
            {request?.status === "returned" ? "重新提交" : "提交审批"}
          </button>
        </div>
      </section>

      <aside className="space-y-5">
        <section className="rounded-md border border-border/80 bg-white p-5">
          <div className="flex items-center gap-2">
            <CalendarRange className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">审批路线</h2>
          </div>
          <div className="mt-5 space-y-0">
            {(
              leaveDays > 1
                ? [
                    ["01", "员工提交", "填写类型、时间、事由和工作交接"],
                    ["02", "直属上级", "审核工作安排"],
                    ["03", "董事长", "审批一天以上请假"],
                    ["04", "行政人事备案", "登记考勤与假期台账"],
                  ]
                : [
                    ["01", "员工提交", "填写类型、时间、事由和工作交接"],
                    ["02", "直属上级", "审批一天及以下请假"],
                    ["03", "行政人事备案", "登记考勤与假期台账"],
                  ]
            ).map(([number, title, copy], index, list) => (
              <div className="flex gap-3" key={title}>
                <div className="flex flex-col items-center">
                  <span className="grid size-7 place-items-center rounded-lg bg-muted text-xs font-semibold text-primary">
                    {number}
                  </span>
                  {index < list.length - 1 && (
                    <span className="h-9 w-px bg-border" />
                  )}
                </div>
                <div className="pb-4">
                  <div className="text-xs font-semibold">{title}</div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {copy}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-md bg-primary p-5 text-white">
          <div className="text-xs font-medium tracking-[0.12em] text-muted-foreground">
            POLICY SOURCE
          </div>
          <h2 className="mt-3 text-sm font-semibold">《考勤管理制度》摘要</h2>
          <ul className="mt-4 space-y-3 text-xs leading-5 text-white/58">
            <li>● 福利假转正后为 4 天/年，逐年增加，最高 10 天。</li>
            <li>● 福利假当年有效，不累计至下一年度。</li>
            <li>● 请假应提前申请，紧急情况先通知主管后补办。</li>
            <li>● 需要续假的，应在原批准期限届满前完成审批。</li>
          </ul>
          <div className="mt-4 text-xs text-white/35">
            规则来源：考勤管理制度 · 第九至十二条
          </div>
        </section>

        <section className="rounded-md border border-border bg-muted p-5">
          <div className="text-xs font-semibold text-foreground">
            演示数据提醒
          </div>
          <p className="mt-2 text-xs leading-5 text-foreground">
            申请仅保存在当前浏览器，不会发送给真实负责人。请勿填写身份证、疾病诊断或其他真实敏感信息。
          </p>
        </section>
      </aside>
    </div>
  );
}
