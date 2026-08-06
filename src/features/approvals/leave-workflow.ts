export type LeaveType =
  | "welfare"
  | "sick"
  | "personal"
  | "marriage"
  | "bereavement"
  | "maternity"
  | "paternity"
  | "work_injury"
  | "other";

export type LeaveStatus =
  | "draft"
  | "pending_department"
  | "pending_chairman"
  | "pending_hr_filing"
  | "approved"
  | "returned"
  | "rejected"
  | "withdrawn";

export type WorkflowRole =
  | "employee"
  | "department_lead"
  | "chairman"
  | "hr";

export type WorkflowActionType =
  | "draft_saved"
  | "submitted"
  | "department_approved"
  | "chairman_approved"
  | "hr_filed"
  | "returned"
  | "rejected"
  | "resubmitted"
  | "withdrawn";

export type LeaveRequestInput = {
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  handover: string;
  isEmergency: boolean;
  emergencyNote: string;
};

export type WorkflowHistoryItem = {
  id: string;
  action: WorkflowActionType;
  actorRole: WorkflowRole;
  actorName: string;
  opinion: string;
  previousStatus: LeaveStatus;
  nextStatus: LeaveStatus;
  createdAt: string;
};

export type LeaveRequest = LeaveRequestInput & {
  id: string;
  applicantName: string;
  departmentName: string;
  status: LeaveStatus;
  leaveDays: number;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  completedAt?: string;
  history: WorkflowHistoryItem[];
};

export type WorkflowActor = {
  role: WorkflowRole;
  name: string;
};

export type LeaveWorkflowCommand =
  | { type: "submit"; actor: WorkflowActor; opinion?: string }
  | { type: "approve_department"; actor: WorkflowActor; opinion?: string }
  | { type: "approve_chairman"; actor: WorkflowActor; opinion?: string }
  | { type: "file_hr"; actor: WorkflowActor; opinion?: string }
  | { type: "return"; actor: WorkflowActor; opinion: string }
  | { type: "reject"; actor: WorkflowActor; opinion: string }
  | { type: "resubmit"; actor: WorkflowActor; opinion?: string }
  | { type: "withdraw"; actor: WorkflowActor; opinion?: string };

const actionRequirements: Record<
  LeaveWorkflowCommand["type"],
  { roles: WorkflowRole[]; statuses: LeaveStatus[] }
> = {
  submit: { roles: ["employee"], statuses: ["draft"] },
  approve_department: {
    roles: ["department_lead"],
    statuses: ["pending_department"],
  },
  approve_chairman: {
    roles: ["chairman"],
    statuses: ["pending_chairman"],
  },
  file_hr: { roles: ["hr"], statuses: ["pending_hr_filing"] },
  return: {
    roles: ["department_lead", "chairman", "hr"],
    statuses: [
      "pending_department",
      "pending_chairman",
      "pending_hr_filing",
    ],
  },
  reject: {
    roles: ["department_lead", "chairman", "hr"],
    statuses: [
      "pending_department",
      "pending_chairman",
      "pending_hr_filing",
    ],
  },
  resubmit: { roles: ["employee"], statuses: ["returned"] },
  withdraw: { roles: ["employee"], statuses: ["pending_department"] },
};

export class LeaveWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LeaveWorkflowError";
  }
}

export function calculateLeaveDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
    return 0;
  }

  return Math.floor((end - start) / 86_400_000) + 1;
}

export function validateLeaveRequest(input: LeaveRequestInput) {
  const errors: Partial<Record<keyof LeaveRequestInput, string>> = {};

  if (!input.leaveType) {
    errors.leaveType = "请选择请假类型";
  }
  if (!input.startDate) {
    errors.startDate = "请选择开始日期";
  }
  if (!input.endDate) {
    errors.endDate = "请选择结束日期";
  }
  if (
    input.startDate &&
    input.endDate &&
    calculateLeaveDays(input.startDate, input.endDate) === 0
  ) {
    errors.endDate = "结束日期不能早于开始日期";
  }
  if (input.reason.trim().length < 5) {
    errors.reason = "请假事由至少填写 5 个字";
  }
  if (input.handover.trim().length < 2) {
    errors.handover = "请填写工作交接安排";
  }
  if (input.isEmergency && input.emergencyNote.trim().length < 5) {
    errors.emergencyNote = "请说明紧急情况和已通知直属主管的方式";
  }

  return errors;
}

export function createLeaveDraft({
  id,
  input,
  now,
  applicantName = "演示员工",
  departmentName = "演示部门",
}: {
  id: string;
  input: LeaveRequestInput;
  now: string;
  applicantName?: string;
  departmentName?: string;
}): LeaveRequest {
  return {
    ...input,
    id,
    applicantName,
    departmentName,
    status: "draft",
    leaveDays: calculateLeaveDays(input.startDate, input.endDate),
    createdAt: now,
    updatedAt: now,
    history: [
      {
        id: `${id}-history-1`,
        action: "draft_saved",
        actorRole: "employee",
        actorName: applicantName,
        opinion: "保存请假草稿",
        previousStatus: "draft",
        nextStatus: "draft",
        createdAt: now,
      },
    ],
  };
}

export function updateLeaveDraft({
  request,
  input,
  now,
}: {
  request: LeaveRequest;
  input: LeaveRequestInput;
  now: string;
}): LeaveRequest {
  if (!["draft", "returned"].includes(request.status)) {
    throw new LeaveWorkflowError("当前状态不允许修改申请内容");
  }

  return {
    ...request,
    ...input,
    leaveDays: calculateLeaveDays(input.startDate, input.endDate),
    updatedAt: now,
  };
}

function getNextStatus(
  request: LeaveRequest,
  command: LeaveWorkflowCommand,
): LeaveStatus {
  switch (command.type) {
    case "submit":
    case "resubmit":
      return "pending_department";
    case "approve_department":
      return request.leaveDays > 1
        ? "pending_chairman"
        : "pending_hr_filing";
    case "approve_chairman":
      return "pending_hr_filing";
    case "file_hr":
      return "approved";
    case "return":
      return "returned";
    case "reject":
      return "rejected";
    case "withdraw":
      return "withdrawn";
    default:
      return request.status;
  }
}

function getHistoryAction(
  command: LeaveWorkflowCommand,
): WorkflowActionType {
  switch (command.type) {
    case "submit":
      return "submitted";
    case "approve_department":
      return "department_approved";
    case "approve_chairman":
      return "chairman_approved";
    case "file_hr":
      return "hr_filed";
    case "return":
      return "returned";
    case "reject":
      return "rejected";
    case "resubmit":
      return "resubmitted";
    case "withdraw":
      return "withdrawn";
  }
}

export function transitionLeaveRequest({
  request,
  command,
  now,
}: {
  request: LeaveRequest;
  command: LeaveWorkflowCommand;
  now: string;
}): LeaveRequest {
  const requirement = actionRequirements[command.type];
  const expectedReviewRole =
    request.status === "pending_hr_filing"
      ? "hr"
      : request.status === "pending_chairman"
        ? "chairman"
        : "department_lead";

  if (!requirement.roles.includes(command.actor.role)) {
    throw new LeaveWorkflowError("当前角色无权执行此审批动作");
  }
  if (
    ["return", "reject"].includes(command.type) &&
    command.actor.role !== expectedReviewRole
  ) {
    throw new LeaveWorkflowError("当前审批节点不属于该角色");
  }
  if (!requirement.statuses.includes(request.status)) {
    throw new LeaveWorkflowError("当前申请状态不允许执行此操作");
  }
  if (
    ["submit", "resubmit"].includes(command.type) &&
    Object.keys(validateLeaveRequest(request)).length > 0
  ) {
    throw new LeaveWorkflowError("申请信息不完整，无法提交");
  }
  if (
    (command.type === "return" || command.type === "reject") &&
    !command.opinion.trim()
  ) {
    throw new LeaveWorkflowError("退回或驳回时必须填写审批意见");
  }

  const nextStatus = getNextStatus(request, command);
  const isComplete = ["approved", "rejected", "withdrawn"].includes(nextStatus);
  const historyItem: WorkflowHistoryItem = {
    id: `${request.id}-history-${request.history.length + 1}`,
    action: getHistoryAction(command),
    actorRole: command.actor.role,
    actorName: command.actor.name,
    opinion: command.opinion?.trim() || "同意",
    previousStatus: request.status,
    nextStatus,
    createdAt: now,
  };

  return {
    ...request,
    status: nextStatus,
    updatedAt: now,
    submittedAt:
      ["submit", "resubmit"].includes(command.type) &&
      !request.submittedAt
        ? now
        : request.submittedAt,
    completedAt: isComplete ? now : undefined,
    history: [...request.history, historyItem],
  };
}

export function canPerformLeaveAction(
  request: LeaveRequest,
  commandType: LeaveWorkflowCommand["type"],
  role: WorkflowRole,
) {
  const requirement = actionRequirements[commandType];
  const matchesReviewNode =
    !["return", "reject"].includes(commandType) ||
    (request.status === "pending_department" && role === "department_lead") ||
    (request.status === "pending_chairman" && role === "chairman") ||
    (request.status === "pending_hr_filing" && role === "hr");

  return (
    requirement.roles.includes(role) &&
    requirement.statuses.includes(request.status) &&
    matchesReviewNode
  );
}
