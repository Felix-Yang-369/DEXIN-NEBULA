import assert from "node:assert/strict";
import test from "node:test";
import {
  createLeaveDraft,
  transitionLeaveRequest,
  updateLeaveDraft,
} from "../src/features/approvals/leave-workflow.ts";

const input = {
  leaveType: "welfare",
  startDate: "2026-08-03",
  endDate: "2026-08-05",
  reason: "处理个人家庭事务",
  handover: "已将客户跟进事项交接给同事",
  isEmergency: false,
  emergencyNote: "",
};

const employee = { role: "employee", name: "演示员工" };
const lead = { role: "department_lead", name: "部门负责人" };
const chairman = { role: "chairman", name: "董事长" };
const hr = { role: "hr", name: "人事行政" };

function createDraft() {
  return createLeaveDraft({
    id: "DX-LV-TEST-001",
    input,
    now: "2026-07-28T09:00:00.000Z",
  });
}

test("超过一天的请假完成直属上级、董事长和行政备案流程", () => {
  const submitted = transitionLeaveRequest({
    request: createDraft(),
    command: { type: "submit", actor: employee },
    now: "2026-07-28T09:05:00.000Z",
  });
  const departmentApproved = transitionLeaveRequest({
    request: submitted,
    command: { type: "approve_department", actor: lead, opinion: "工作已交接" },
    now: "2026-07-28T09:10:00.000Z",
  });
  assert.equal(departmentApproved.status, "pending_chairman");
  const chairmanApproved = transitionLeaveRequest({
    request: departmentApproved,
    command: {
      type: "approve_chairman",
      actor: chairman,
      opinion: "同意请假",
    },
    now: "2026-07-28T09:15:00.000Z",
  });
  const approved = transitionLeaveRequest({
    request: chairmanApproved,
    command: { type: "file_hr", actor: hr, opinion: "已登记假期台账" },
    now: "2026-07-28T09:20:00.000Z",
  });

  assert.equal(approved.status, "approved");
  assert.equal(approved.leaveDays, 3);
  assert.equal(approved.history.length, 5);
  assert.equal(approved.completedAt, "2026-07-28T09:20:00.000Z");
});

test("一天及以下的请假跳过董事长并进入行政备案", () => {
  const oneDayDraft = createLeaveDraft({
    id: "DX-LV-TEST-002",
    input: { ...input, endDate: input.startDate },
    now: "2026-07-28T09:00:00.000Z",
  });
  const submitted = transitionLeaveRequest({
    request: oneDayDraft,
    command: { type: "submit", actor: employee },
    now: "2026-07-28T09:05:00.000Z",
  });
  const departmentApproved = transitionLeaveRequest({
    request: submitted,
    command: { type: "approve_department", actor: lead },
    now: "2026-07-28T09:10:00.000Z",
  });

  assert.equal(departmentApproved.status, "pending_hr_filing");
});

test("行政人事不能跳过审批节点直接备案", () => {
  const submitted = transitionLeaveRequest({
    request: createDraft(),
    command: { type: "submit", actor: employee },
    now: "2026-07-28T09:05:00.000Z",
  });

  assert.throws(
    () =>
      transitionLeaveRequest({
        request: submitted,
        command: { type: "file_hr", actor: hr },
        now: "2026-07-28T09:10:00.000Z",
      }),
    /当前申请状态不允许执行此操作/,
  );
});

test("退回后员工可以修改并重新提交", () => {
  const submitted = transitionLeaveRequest({
    request: createDraft(),
    command: { type: "submit", actor: employee },
    now: "2026-07-28T09:05:00.000Z",
  });
  const returned = transitionLeaveRequest({
    request: submitted,
    command: { type: "return", actor: lead, opinion: "请补充交接安排" },
    now: "2026-07-28T09:10:00.000Z",
  });
  const updated = updateLeaveDraft({
    request: returned,
    input: { ...input, handover: "已补充完整交接清单并通知负责人" },
    now: "2026-07-28T09:15:00.000Z",
  });
  const resubmitted = transitionLeaveRequest({
    request: updated,
    command: { type: "resubmit", actor: employee, opinion: "已补充" },
    now: "2026-07-28T09:20:00.000Z",
  });

  assert.equal(resubmitted.status, "pending_department");
  assert.equal(resubmitted.history.at(-1).action, "resubmitted");
});

test("员工只能在部门负责人处理前撤回", () => {
  const submitted = transitionLeaveRequest({
    request: createDraft(),
    command: { type: "submit", actor: employee },
    now: "2026-07-28T09:05:00.000Z",
  });
  const departmentApproved = transitionLeaveRequest({
    request: submitted,
    command: { type: "approve_department", actor: lead },
    now: "2026-07-28T09:10:00.000Z",
  });

  assert.throws(
    () =>
      transitionLeaveRequest({
        request: departmentApproved,
        command: { type: "withdraw", actor: employee },
        now: "2026-07-28T09:15:00.000Z",
      }),
    /当前申请状态不允许执行此操作/,
  );
});

test("退回和驳回必须填写意见", () => {
  const submitted = transitionLeaveRequest({
    request: createDraft(),
    command: { type: "submit", actor: employee },
    now: "2026-07-28T09:05:00.000Z",
  });

  assert.throws(
    () =>
      transitionLeaveRequest({
        request: submitted,
        command: { type: "reject", actor: lead, opinion: "" },
        now: "2026-07-28T09:10:00.000Z",
      }),
    /必须填写审批意见/,
  );
});
