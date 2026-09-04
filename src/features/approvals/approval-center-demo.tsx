"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CircleCheck,
  Clock3,
  FileText,
  History,
  RotateCcw,
  Send,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useDemoLeaveRequest } from "./demo-leave-store";
import {
  transitionLeaveRequest,
  type LeaveRequest,
  type LeaveStatus,
  type WorkflowActionType,
} from "./leave-workflow";

type ApprovalView = "pending" | "mine" | "history";
type ReviewAction = "approve" | "return" | "reject" | "withdraw";

const statusLabels: Record<
  LeaveStatus,
  { label: string; tone: string; description: string }
> = {
  draft: {
    label: "草稿",
    tone: "bg-muted text-muted-foreground",
    description: "尚未提交",
  },
  pending_department: {
    label: "部门负责人审批中",
    tone: "bg-muted text-foreground",
    description: "等待部门负责人处理",
  },
  pending_chairman: {
    label: "董事长审批中",
    tone: "bg-muted text-foreground",
    description: "请假超过一天，等待董事长审批",
  },
  pending_hr_filing: {
    label: "行政人事备案中",
    tone: "bg-muted text-foreground",
    description: "审批已同意，等待考勤与假期台账备案",
  },
  approved: {
    label: "已通过",
    tone: "bg-muted text-foreground",
    description: "审批流程已完成",
  },
  returned: {
    label: "已退回",
    tone: "bg-muted text-foreground",
    description: "请修改后重新提交",
  },
  rejected: {
    label: "已驳回",
    tone: "bg-muted text-foreground",
    description: "流程已结束",
  },
  withdrawn: {
    label: "已撤回",
    tone: "bg-muted text-muted-foreground",
    description: "申请人已撤回",
  },
};

const actionLabels: Record<WorkflowActionType, string> = {
  draft_saved: "保存草稿",
  submitted: "提交申请",
  department_approved: "部门负责人同意",
  chairman_approved: "董事长同意",
  hr_filed: "行政人事完成备案",
  returned: "退回修改",
  rejected: "驳回申请",
  resubmitted: "重新提交",
  withdrawn: "撤回申请",
};

const leaveTypeLabels: Record<LeaveRequest["leaveType"], string> = {
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

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function RequestDetails({ request }: { request: LeaveRequest }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["申请人", request.applicantName],
        ["所属部门", request.departmentName],
        ["请假类型", leaveTypeLabels[request.leaveType]],
        ["请假天数", `${request.leaveDays} 天`],
        ["开始日期", request.startDate],
        ["结束日期", request.endDate],
        ["申请编号", request.id],
        ["提交时间", request.submittedAt ? formatDateTime(request.submittedAt) : "—"],
      ].map(([label, value]) => (
        <div className="rounded-md bg-muted px-4 py-3" key={label}>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="mt-1.5 break-all text-xs font-medium">{value}</div>
        </div>
      ))}
    </div>
  );
}

function WorkflowTimeline({ request }: { request: LeaveRequest }) {
  return (
    <div className="space-y-0">
      {request.history
        .slice()
        .reverse()
        .map((item, index, history) => (
          <div className="flex gap-3" key={item.id}>
            <div className="flex flex-col items-center">
              <span
                className={`grid size-8 place-items-center rounded-md ${
                  index === 0
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-primary"
                }`}
              >
                {index === 0 ? (
                  <Check className="size-3.5" />
                ) : (
                  <History className="size-3.5" />
                )}
              </span>
              {index < history.length - 1 && (
                <span className="h-12 w-px bg-border" />
              )}
            </div>
            <div className="min-w-0 flex-1 pb-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold">
                  {actionLabels[item.action]}
                </div>
                <time className="text-xs text-muted-foreground">
                  {formatDateTime(item.createdAt)}
                </time>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {item.actorName} · {item.opinion}
              </div>
            </div>
          </div>
        ))}
    </div>
  );
}

export function ApprovalCenterDemo() {
  const { request, isReady, saveRequest, clearRequest } =
    useDemoLeaveRequest();
  const [view, setView] = useState<ApprovalView>("pending");
  const [opinion, setOpinion] = useState("");
  const [feedback, setFeedback] = useState("");

  function performAction(action: ReviewAction) {
    if (!request) {
      return;
    }

    try {
      const currentNode =
        request.status === "pending_hr_filing"
          ? "hr"
          : request.status === "pending_chairman"
            ? "chairman"
            : "department_lead";
      const actor =
        currentNode === "hr"
          ? { role: "hr" as const, name: "人事行政（演示）" }
          : currentNode === "chairman"
            ? { role: "chairman" as const, name: "董事长（演示）" }
            : {
              role: "department_lead" as const,
              name: "部门负责人（演示）",
            };
      const command =
        action === "approve"
          ? request.status === "pending_hr_filing"
            ? { type: "file_hr" as const, actor, opinion: opinion || "完成行政备案" }
            : request.status === "pending_chairman"
              ? { type: "approve_chairman" as const, actor, opinion }
              : { type: "approve_department" as const, actor, opinion }
          : action === "return"
            ? { type: "return" as const, actor, opinion }
            : action === "reject"
              ? { type: "reject" as const, actor, opinion }
              : {
                  type: "withdraw" as const,
                  actor: { role: "employee" as const, name: "演示员工" },
                  opinion: opinion || "申请人主动撤回",
                };

      const nextRequest = transitionLeaveRequest({
        request,
        command,
        now: new Date().toISOString(),
      });
      saveRequest(nextRequest);
      setOpinion("");
      setFeedback(
        action === "approve"
          ? "审批已处理，流程已进入下一节点"
          : action === "withdraw"
            ? "申请已撤回"
            : "审批动作已记录",
      );
      if (["approved", "rejected", "withdrawn"].includes(nextRequest.status)) {
        setView("history");
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "操作失败");
    }
  }

  if (!isReady) {
    return (
      <div className="rounded-md border border-border/80 bg-white p-8 text-center text-xs text-muted-foreground">
        正在读取本机演示流程…
      </div>
    );
  }

  if (!request) {
    return (
      <section className="rounded-md border border-border/80 bg-white p-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-lg bg-muted text-primary">
          <FileText className="size-6" />
        </span>
        <h2 className="mt-5 text-lg font-semibold">暂时没有请假申请</h2>
        <p className="mt-2 text-xs text-muted-foreground">
          先创建一条演示请假申请，再体验制度驱动的完整审批流程。
        </p>
        <Link
          className="mt-6 inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground"
          href="/requests/leave"
        >
          <Send className="size-3.5" />
          发起请假申请
        </Link>
      </section>
    );
  }

  const status = statusLabels[request.status];
  const isPending = [
    "pending_department",
    "pending_chairman",
    "pending_hr_filing",
  ].includes(request.status);
  const isTerminal = ["approved", "rejected", "withdrawn"].includes(
    request.status,
  );

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "当前待审批",
            value: isPending ? 1 : 0,
            note: isPending ? status.description : "当前无待处理节点",
            icon: Clock3,
            tone: "bg-muted text-foreground",
          },
          {
            label: "我的申请",
            value: 1,
            note: `演示申请 ${request.id}`,
            icon: FileText,
            tone: "bg-muted text-foreground",
          },
          {
            label: "已完成",
            value: isTerminal ? 1 : 0,
            note: isTerminal ? status.label : "流程尚未结束",
            icon: CircleCheck,
            tone: "bg-muted text-foreground",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article
              className="rounded-md border border-border/80 bg-white p-5"
              key={item.label}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs text-muted-foreground">
                    {item.label}
                  </div>
                  <div className="mt-3 text-[28px] font-semibold">
                    {item.value}
                  </div>
                </div>
                <span
                  className={`grid size-10 place-items-center rounded-md ${item.tone}`}
                >
                  <Icon className="size-[17px]" />
                </span>
              </div>
              <div className="mt-4 border-t border-border/80 pt-3 text-xs text-muted-foreground">
                {item.note}
              </div>
            </article>
          );
        })}
      </section>

      <section className="mt-5 overflow-hidden rounded-md border border-border/80 bg-white">
        <div className="flex gap-2 overflow-x-auto border-b border-border px-5 pt-4 sm:px-6">
          {[
            ["pending", "我的待审批"],
            ["mine", "我的申请"],
            ["history", "审批历史"],
          ].map(([value, label]) => (
            <button
              className={`shrink-0 border-b-2 px-3 pb-3 text-xs font-medium ${
                view === value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
              key={value}
              onClick={() => setView(value as ApprovalView)}
              type="button"
            >
              {label}
            </button>
          ))}
        </div>

        {view === "pending" && (
          <div className="p-5 sm:p-6">
            {!isPending ? (
              <div className="py-10 text-center">
                <CircleCheck className="mx-auto size-8 text-primary" />
                <h2 className="mt-3 text-sm font-semibold">当前没有待审批</h2>
                <p className="mt-2 text-xs text-muted-foreground">
                  查看“审批历史”了解该流程的处理记录。
                </p>
              </div>
            ) : (
              <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-medium text-primary">
                        {request.status === "pending_hr_filing"
                          ? "模拟角色：行政人事备案"
                          : request.status === "pending_chairman"
                            ? "模拟角色：董事长"
                            : "模拟角色：直属上级"}
                      </div>
                      <h2 className="mt-2 text-base font-semibold">
                        {leaveTypeLabels[request.leaveType]}申请 ·{" "}
                        {request.applicantName}
                      </h2>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1.5 text-xs font-medium ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-5">
                    <RequestDetails request={request} />
                  </div>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-md border border-border p-4">
                      <div className="text-xs text-muted-foreground">
                        请假事由
                      </div>
                      <p className="mt-2 text-xs leading-6">{request.reason}</p>
                    </div>
                    <div className="rounded-md border border-border p-4">
                      <div className="text-xs text-muted-foreground">
                        工作交接
                      </div>
                      <p className="mt-2 text-xs leading-6">
                        {request.handover}
                      </p>
                    </div>
                  </div>
                </div>

                <aside className="rounded-md border border-border bg-muted p-5">
                  <div className="flex items-center gap-2">
                    <UserRoundCheck className="size-4 text-primary" />
                    <h3 className="text-sm font-semibold">处理审批</h3>
                  </div>
                  <label className="mt-4 block">
                    <span className="text-xs text-muted-foreground">
                      审批意见
                    </span>
                    <textarea
                      className="mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-white px-3 py-2.5 text-xs leading-5 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
                      onChange={(event) => {
                        setOpinion(event.target.value);
                        setFeedback("");
                      }}
                      placeholder="同意时可选，退回或驳回时必填"
                      value={opinion}
                    />
                  </label>
                  {feedback && (
                    <div className="mt-3 rounded-md bg-muted px-3 py-2 text-xs text-foreground">
                      {feedback}
                    </div>
                  )}
                  <button
                    className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-xs font-medium text-primary-foreground"
                    onClick={() => performAction("approve")}
                    type="button"
                  >
                    <Check className="size-3.5" />
                    {request.status === "pending_hr_filing"
                      ? "完成备案"
                      : "同意并进入下一节点"}
                  </button>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="h-9 rounded-md border border-border bg-muted text-xs font-medium text-foreground"
                      onClick={() => performAction("return")}
                      type="button"
                    >
                      退回修改
                    </button>
                    <button
                      className="h-9 rounded-md border border-border bg-muted text-xs font-medium text-foreground"
                      onClick={() => performAction("reject")}
                      type="button"
                    >
                      驳回
                    </button>
                  </div>
                </aside>
              </div>
            )}
          </div>
        )}

        {view === "mine" && (
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs text-muted-foreground">
                  {request.id}
                </div>
                <h2 className="mt-2 text-base font-semibold">
                  {leaveTypeLabels[request.leaveType]}申请
                </h2>
              </div>
              <span
                className={`rounded-full px-3 py-1.5 text-xs font-medium ${status.tone}`}
              >
                {status.label}
              </span>
            </div>
            <div className="mt-5">
              <RequestDetails request={request} />
            </div>
            <div className="mt-5 flex flex-wrap justify-end gap-3">
              {request.status === "returned" && (
                <Link
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground"
                  href="/requests/leave"
                >
                  <RotateCcw className="size-3.5" />
                  修改并重新提交
                </Link>
              )}
              {request.status === "pending_department" && (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-muted px-4 text-xs font-medium text-foreground"
                  onClick={() => performAction("withdraw")}
                  type="button"
                >
                  <ArrowLeft className="size-3.5" />
                  撤回申请
                </button>
              )}
              {isTerminal && (
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-white px-4 text-xs font-medium text-muted-foreground"
                  onClick={() => {
                    clearRequest();
                    setFeedback("");
                  }}
                  type="button"
                >
                  <RotateCcw className="size-3.5" />
                  重置演示流程
                </button>
              )}
            </div>
          </div>
        )}

        {view === "history" && (
          <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold">审批历史</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    历史记录按最新动作倒序展示
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1.5 text-xs font-medium ${status.tone}`}
                >
                  {status.label}
                </span>
              </div>
              <div className="mt-6">
                <WorkflowTimeline request={request} />
              </div>
            </div>
            <aside className="rounded-md bg-primary p-5 text-white">
              <div className="text-xs font-medium tracking-[0.12em] text-muted-foreground">
                AUDIT TRAIL
              </div>
              <h3 className="mt-3 text-sm font-semibold">流程审计说明</h3>
              <ul className="mt-4 space-y-3 text-xs leading-5 text-white/58">
                <li>● 每次动作记录人员、角色、时间和意见。</li>
                <li>● 审批节点顺序由状态机决定。</li>
                <li>● 已完成历史不能由普通用户修改。</li>
                <li>● 正式版本将在服务端校验待办归属。</li>
              </ul>
              {isTerminal && (
                <button
                  className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-white/12 bg-white/8 px-3 text-xs text-white/70"
                  onClick={() => {
                    clearRequest();
                    setView("pending");
                  }}
                  type="button"
                >
                  <X className="size-3" />
                  清除本机演示数据
                </button>
              )}
            </aside>
          </div>
        )}
      </section>
    </>
  );
}
