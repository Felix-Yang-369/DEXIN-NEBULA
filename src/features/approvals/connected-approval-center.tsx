import {
  CircleCheck,
  Clock3,
  FileText,
  ReceiptText,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import type { CurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
import { processExpenseApprovalAction } from "./expense-server-actions";
import { processSealApprovalAction } from "./seal-server-actions";
import { processLeaveRequestAction } from "./server-actions";
import { processUnifiedApprovalAction } from "./unified-server-actions";

type ConnectedUnifiedRequest = { id:string;request_no:string;request_type:string;title:string;summary:string|null;applicant_employee_id:string;current_approver_employee_id:string|null;status:string;current_step_order:number|null;total_steps:number;version:number;amount_cny:number|null;due_at:string|null;applicant:{name:string;employee_no:string}|Array<{name:string;employee_no:string}>|null };

type ConnectedLeaveRequest = {
  id: string;
  applicant_employee_id: string;
  current_approver_employee_id: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  leave_days: number;
  reason: string;
  handover: string;
  status: string;
  version: number;
  created_at: string;
  applicant:
    | { name: string; employee_no: string }
    | Array<{ name: string; employee_no: string }>
    | null;
};

type ConnectedExpenseRequest = {
  id: string;
  request_no: string;
  applicant_employee_id: string;
  current_approver_employee_id: string | null;
  status: string;
  current_step_order: number | null;
  total_steps: number;
  version: number;
  created_at: string;
  applicant:
    | { name: string; employee_no: string }
    | Array<{ name: string; employee_no: string }>
    | null;
  expense:
    | {
        expense_category: string;
        occurred_on: string;
        amount: number;
        vendor: string | null;
        description: string;
        has_invoice: boolean;
        invoice_count: number;
      }
    | Array<{
        expense_category: string;
        occurred_on: string;
        amount: number;
        vendor: string | null;
        description: string;
        has_invoice: boolean;
        invoice_count: number;
      }>
    | null;
};

type ConnectedSealRequest = {
  id: string;
  request_no: string;
  applicant_employee_id: string;
  current_approver_employee_id: string | null;
  status: string;
  current_step_order: number | null;
  total_steps: number;
  version: number;
  created_at: string;
  applicant:
    | { name: string; employee_no: string }
    | Array<{ name: string; employee_no: string }>
    | null;
  seal:
    | {
        seal_type: string;
        use_date: string;
        document_title: string;
        purpose: string;
        counterparty: string | null;
        copies: number;
        is_external: boolean;
        expected_return_on: string | null;
      }
    | Array<{
        seal_type: string;
        use_date: string;
        document_title: string;
        purpose: string;
        counterparty: string | null;
        copies: number;
        is_external: boolean;
        expected_return_on: string | null;
      }>
    | null;
};

const leaveTypeLabels: Record<string, string> = {
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

const statusLabels: Record<string, string> = {
  draft: "草稿",
  pending_department: "直属上级审批中",
  pending_chairman: "董事长审批中",
  pending_hr_filing: "行政人事备案中",
  approved: "已通过",
  returned: "已退回",
  rejected: "已驳回",
  withdrawn: "已撤回",
};

const expenseCategoryLabels: Record<string, string> = {
  travel: "差旅费",
  transport: "交通费",
  hospitality: "业务招待费",
  office: "办公费",
  purchase: "零星采购",
  other: "其他费用",
};

const sealTypeLabels: Record<string, string> = {
  company: "公司公章",
  contract: "合同专用章",
  finance: "财务专用章",
  legal_representative: "法人章",
  other: "其他印章",
};

function applicantName(request: ConnectedLeaveRequest) {
  const applicant = Array.isArray(request.applicant)
    ? request.applicant[0]
    : request.applicant;
  return applicant?.name ?? "未知员工";
}

function expenseApplicantName(request: ConnectedExpenseRequest) {
  const applicant = Array.isArray(request.applicant)
    ? request.applicant[0]
    : request.applicant;
  return applicant?.name ?? "未知员工";
}

function expenseDetail(request: ConnectedExpenseRequest) {
  return Array.isArray(request.expense)
    ? request.expense[0]
    : request.expense;
}

function sealApplicantName(request: ConnectedSealRequest) {
  const applicant = Array.isArray(request.applicant)
    ? request.applicant[0]
    : request.applicant;
  return applicant?.name ?? "未知员工";
}

function sealDetail(request: ConnectedSealRequest) {
  return Array.isArray(request.seal) ? request.seal[0] : request.seal;
}

function expenseStepLabel(stepOrder: number | null) {
  if (stepOrder === 1) return "直属负责人审批中";
  if (stepOrder === 2) return "财务复核中";
  if (stepOrder === 3) return "董事长审批中";
  return "审批中";
}

function sealStepLabel(request: ConnectedSealRequest) {
  if (request.current_step_order === 1) return "直属负责人审批中";
  if (request.total_steps === 3 && request.current_step_order === 2) {
    return "董事长审批中";
  }
  if (request.current_step_order === request.total_steps) {
    return "行政用印登记中";
  }
  return "审批中";
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
  }).format(amount);
}

function feedbackMessage({
  created,
  updated,
  expenseCreated,
  expenseUpdated,
  sealCreated,
  sealUpdated,
  error,
}: {
  created?: string;
  updated?: string;
  expenseCreated?: string;
  expenseUpdated?: string;
  sealCreated?: string;
  sealUpdated?: string;
  error?: string;
}) {
  if (created === "1") return "请假申请已提交，并已分配给直属上级。";
  if (updated === "1") return "审批动作已记录，流程已进入下一节点。";
  if (expenseCreated === "1")
    return "报销申请已提交，审批节点已经生成。";
  if (expenseUpdated === "1")
    return "报销审批动作已记录，流程已进入下一节点。";
  if (sealCreated === "1")
    return "用印申请已提交，审批与行政登记节点已经生成。";
  if (sealUpdated === "1")
    return "用印审批动作已记录，流程已进入下一节点。";
  if (error === "opinion_required") return "退回或驳回必须填写审批意见。";
  if (error === "version_conflict")
    return "申请已被其他人处理，请查看最新状态。";
  if (error === "forbidden") return "该待办未分配给当前账号。";
  if (error) return "操作未完成，请刷新后重试。";
  return "";
}

export async function ConnectedApprovalCenter({
  employee,
  feedback,
}: {
  employee: CurrentEmployee;
  feedback: {
    created?: string;
    updated?: string;
    expenseCreated?: string;
    expenseUpdated?: string;
    sealCreated?: string;
    sealUpdated?: string;
    error?: string;
  };
}) {
  const supabase = await createClient();
  const [
    { data: leaveData, error: leaveError },
    { data: expenseData, error: expenseError },
    { data: sealData, error: sealError },
    { data: unifiedData, error: unifiedError },
  ] = await Promise.all([
    supabase
      .from("leave_requests")
      .select(
        "id, applicant_employee_id, current_approver_employee_id, leave_type, start_date, end_date, leave_days, reason, handover, status, version, created_at, applicant:employees!leave_requests_applicant_employee_id_fkey(name, employee_no)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("approval_requests")
      .select(
        "id, request_no, applicant_employee_id, current_approver_employee_id, status, current_step_order, total_steps, version, created_at, applicant:employees!approval_requests_applicant_employee_id_fkey(name, employee_no), expense:expense_claims(expense_category, occurred_on, amount, vendor, description, has_invoice, invoice_count)",
      )
      .eq("request_type", "expense")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("approval_requests")
      .select(
        "id, request_no, applicant_employee_id, current_approver_employee_id, status, current_step_order, total_steps, version, created_at, applicant:employees!approval_requests_applicant_employee_id_fkey(name, employee_no), seal:seal_requests(seal_type, use_date, document_title, purpose, counterparty, copies, is_external, expected_return_on)",
      )
      .eq("request_type", "seal")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("approval_requests").select("id,request_no,request_type,title,summary,applicant_employee_id,current_approver_employee_id,status,current_step_order,total_steps,version,amount_cny,due_at,applicant:employees!approval_requests_applicant_employee_id_fkey(name,employee_no)").eq("request_type","sales_order").order("created_at",{ascending:false}).limit(50),
  ]);

  const requests = (leaveData ?? []) as ConnectedLeaveRequest[];
  const expenseRequests = (expenseData ?? []) as ConnectedExpenseRequest[];
  const sealRequests = (sealData ?? []) as ConnectedSealRequest[];
  const unifiedRequests=(unifiedData??[]) as ConnectedUnifiedRequest[];const unifiedPending=unifiedRequests.filter((request)=>request.current_approver_employee_id===employee.id);const unifiedMine=unifiedRequests.filter((request)=>request.applicant_employee_id===employee.id);const unifiedCompleted=unifiedRequests.filter((request)=>["approved","rejected","withdrawn"].includes(request.status));
  const pending = requests.filter(
    (request) => request.current_approver_employee_id === employee.id,
  );
  const expensePending = expenseRequests.filter(
    (request) => request.current_approver_employee_id === employee.id,
  );
  const sealPending = sealRequests.filter(
    (request) => request.current_approver_employee_id === employee.id,
  );
  const mine = requests.filter(
    (request) => request.applicant_employee_id === employee.id,
  );
  const expenseMine = expenseRequests.filter(
    (request) => request.applicant_employee_id === employee.id,
  );
  const sealMine = sealRequests.filter(
    (request) => request.applicant_employee_id === employee.id,
  );
  const completed = requests.filter((request) =>
    ["approved", "rejected", "withdrawn"].includes(request.status),
  );
  const expenseCompleted = expenseRequests.filter((request) =>
    ["approved", "rejected", "withdrawn"].includes(request.status),
  );
  const sealCompleted = sealRequests.filter((request) =>
    ["approved", "rejected", "withdrawn"].includes(request.status),
  );
  const error = leaveError ?? expenseError ?? sealError ?? unifiedError;
  const message = feedbackMessage(feedback);

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-3">
        {[
          {
            label: "我的待审批",
            value: pending.length + expensePending.length + sealPending.length + unifiedPending.length,
            note: "只显示分配给当前账号的有效节点",
            icon: Clock3,
            tone: "bg-[#fff4e7] text-[#9a6321]",
          },
          {
            label: "我的申请",
            value: mine.length + expenseMine.length + sealMine.length + unifiedMine.length,
            note: "本人申请由数据库行级策略隔离",
            icon: FileText,
            tone: "bg-[#edf2f7] text-[#42647a]",
          },
          {
            label: "可见已完成",
            value:
              completed.length + expenseCompleted.length + sealCompleted.length + unifiedCompleted.length,
            note: "按本人、负责人和角色范围统计",
            icon: CircleCheck,
            tone: "bg-[#eaf3f8] text-[#0d6c78]",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article
              className="rounded-[20px] border border-border/80 bg-white p-5"
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
                  className={`grid size-10 place-items-center rounded-xl ${item.tone}`}
                >
                  <Icon className="size-[17px]" />
                </span>
              </div>
              <div className="mt-4 border-t border-border/80 pt-3 text-[10px] text-muted-foreground">
                {item.note}
              </div>
            </article>
          );
        })}
      </section>

      {message && (
        <div className="mt-5 rounded-xl border border-[#d8e8ee] bg-[#eef4f8] px-4 py-3 text-xs text-primary">
          {message}
        </div>
      )}

      {error && (
        <div className="mt-5 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-4 py-3 text-xs text-[#965151]">
          无法读取审批数据，请确认数据库迁移和账号绑定已经完成。
        </div>
      )}

      <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" />
          <div>
            <h2 className="text-base font-semibold">我的待审批</h2>
            <p className="mt-1 text-[10px] text-muted-foreground">
              服务端会再次校验当前处理人、状态和版本号
            </p>
          </div>
        </div>

        {pending.length === 0 &&
        expensePending.length === 0 &&
        sealPending.length === 0 && unifiedPending.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-border bg-[#fafcfe] py-10 text-center">
            <CircleCheck className="mx-auto size-7 text-primary" />
            <div className="mt-3 text-xs font-medium">当前没有待审批</div>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {unifiedPending.map((request)=><article className="rounded-[18px] border border-cyan-100 bg-cyan-50/40 p-4 sm:p-5" key={request.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="font-mono text-[10px] text-primary">{request.request_no}</div><h3 className="mt-2 text-sm font-semibold">{request.title}</h3><p className="mt-1 text-[10px] text-muted-foreground">申请人 {Array.isArray(request.applicant)?request.applicant[0]?.name:request.applicant?.name} · 金额 {request.amount_cny===null?"—":formatCurrency(request.amount_cny)}</p></div><span className="rounded-full bg-[#fff4e7] px-3 py-1 text-[9px] text-[#9a6321]">节点 {request.current_step_order}/{request.total_steps}</span></div><form action={processUnifiedApprovalAction} className="mt-4"><input name="requestId" type="hidden" value={request.id}/><input name="version" type="hidden" value={request.version}/><textarea className="min-h-20 w-full rounded-xl border border-border bg-white px-3 py-2 text-xs" name="opinion" placeholder="同意可选，退回或驳回时必填"/><div className="mt-3 flex justify-end gap-2"><button className="h-9 rounded-xl border border-[#f0dfc7] px-3 text-[10px] text-[#8b612c]" name="workflowAction" value="return">退回</button><button className="h-9 rounded-xl border border-[#ead8d8] px-3 text-[10px] text-[#965151]" name="workflowAction" value="reject">驳回</button><button className="h-9 rounded-xl bg-primary px-4 text-[10px] text-primary-foreground" name="workflowAction" value="approve">同意</button></div></form></article>)}
            {sealPending.map((request) => {
              const detail = sealDetail(request);
              if (!detail) return null;

              return (
                <article
                  className="rounded-[18px] border border-[#dfd5e9] bg-[#fdfbff] p-4 sm:p-5"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] text-[#76589c]">
                        <Stamp className="size-3.5" />
                        {request.request_no}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold">
                        {sealTypeLabels[detail.seal_type]} ·{" "}
                        {sealApplicantName(request)}
                      </h3>
                    </div>
                    <span className="rounded-full bg-[#f3edfa] px-3 py-1.5 text-[9px] font-medium text-[#76589c]">
                      {sealStepLabel(request)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {[
                      ["文件 / 事项", detail.document_title],
                      ["计划用印", detail.use_date],
                      ["用印份数", `${detail.copies} 份`],
                      [
                        "使用方式",
                        detail.is_external
                          ? `外带 · ${detail.expected_return_on ?? "待归还"}`
                          : "公司内用印",
                      ],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-xl bg-[#f6f1fa] px-3 py-2.5"
                        key={label}
                      >
                        <div className="text-[9px] text-muted-foreground">
                          {label}
                        </div>
                        <div className="mt-1 truncate text-xs font-medium">
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-white p-3">
                      <div className="text-[9px] text-muted-foreground">
                        用印事由
                      </div>
                      <p className="mt-2 text-xs leading-5">{detail.purpose}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-white p-3">
                      <div className="text-[9px] text-muted-foreground">
                        对方单位
                      </div>
                      <p className="mt-2 text-xs leading-5">
                        {detail.counterparty ?? "未填写"}
                      </p>
                    </div>
                  </div>

                  <form action={processSealApprovalAction} className="mt-4">
                    <input name="requestId" type="hidden" value={request.id} />
                    <input
                      name="version"
                      type="hidden"
                      value={request.version}
                    />
                    <textarea
                      className="min-h-20 w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-xs leading-5 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
                      name="opinion"
                      placeholder={
                        request.current_step_order === request.total_steps
                          ? "可填写实际用印份数、日期或登记说明"
                          : "同意时可选，退回或驳回时必填"
                      }
                    />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        className="h-9 rounded-xl border border-[#f0dfc7] bg-[#fff8ee] px-3 text-[10px] font-medium text-[#8b612c]"
                        name="workflowAction"
                        type="submit"
                        value="return"
                      >
                        退回修改
                      </button>
                      <button
                        className="h-9 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-3 text-[10px] font-medium text-[#965151]"
                        name="workflowAction"
                        type="submit"
                        value="reject"
                      >
                        驳回
                      </button>
                      <button
                        className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                        name="workflowAction"
                        type="submit"
                        value="approve"
                      >
                        {request.current_step_order === request.total_steps
                          ? "完成用印登记"
                          : "同意并进入下一节点"}
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}

            {expensePending.map((request) => {
              const detail = expenseDetail(request);
              if (!detail) return null;

              return (
                <article
                  className="rounded-[18px] border border-[#d8e8ee] bg-[#fbfcfe] p-4 sm:p-5"
                  key={request.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-[10px] text-primary">
                        <ReceiptText className="size-3.5" />
                        {request.request_no}
                      </div>
                      <h3 className="mt-2 text-sm font-semibold">
                        {expenseCategoryLabels[detail.expense_category]} ·{" "}
                        {expenseApplicantName(request)}
                      </h3>
                    </div>
                    <span className="rounded-full bg-[#fff4e7] px-3 py-1.5 text-[9px] font-medium text-[#9a6321]">
                      {expenseStepLabel(request.current_step_order)}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-4">
                    {[
                      ["报销金额", formatCurrency(detail.amount)],
                      ["发生日期", detail.occurred_on],
                      ["收款方", detail.vendor ?? "未填写"],
                      ["审批进度", `${request.current_step_order}/${request.total_steps}`],
                    ].map(([label, value]) => (
                      <div
                        className="rounded-xl bg-[#f1f6f4] px-3 py-2.5"
                        key={label}
                      >
                        <div className="text-[9px] text-muted-foreground">
                          {label}
                        </div>
                        <div className="mt-1 text-xs font-medium">{value}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl border border-border bg-white p-3">
                    <div className="text-[9px] text-muted-foreground">
                      费用说明
                    </div>
                    <p className="mt-2 text-xs leading-5">
                      {detail.description}
                    </p>
                  </div>

                  <form action={processExpenseApprovalAction} className="mt-4">
                    <input name="requestId" type="hidden" value={request.id} />
                    <input
                      name="version"
                      type="hidden"
                      value={request.version}
                    />
                    <textarea
                      className="min-h-20 w-full resize-y rounded-xl border border-border bg-white px-3 py-2.5 text-xs leading-5 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
                      name="opinion"
                      placeholder="同意时可选，退回或驳回时必填"
                    />
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      <button
                        className="h-9 rounded-xl border border-[#f0dfc7] bg-[#fff8ee] px-3 text-[10px] font-medium text-[#8b612c]"
                        name="workflowAction"
                        type="submit"
                        value="return"
                      >
                        退回修改
                      </button>
                      <button
                        className="h-9 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-3 text-[10px] font-medium text-[#965151]"
                        name="workflowAction"
                        type="submit"
                        value="reject"
                      >
                        驳回
                      </button>
                      <button
                        className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                        name="workflowAction"
                        type="submit"
                        value="approve"
                      >
                        同意并进入下一节点
                      </button>
                    </div>
                  </form>
                </article>
              );
            })}

            {pending.map((request) => (
              <article
                className="rounded-[18px] border border-border p-4 sm:p-5"
                key={request.id}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] text-primary">
                      {request.id}
                    </div>
                    <h3 className="mt-2 text-sm font-semibold">
                      {leaveTypeLabels[request.leave_type]} ·{" "}
                      {applicantName(request)}
                    </h3>
                  </div>
                  <span className="rounded-full bg-[#fff4e7] px-3 py-1.5 text-[9px] font-medium text-[#9a6321]">
                    {statusLabels[request.status]}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {[
                    ["开始日期", request.start_date],
                    ["结束日期", request.end_date],
                    ["请假天数", `${request.leave_days} 天`],
                    ["当前版本", `V${request.version}`],
                  ].map(([label, value]) => (
                    <div
                      className="rounded-xl bg-[#f3f7fa] px-3 py-2.5"
                      key={label}
                    >
                      <div className="text-[9px] text-muted-foreground">
                        {label}
                      </div>
                      <div className="mt-1 text-xs font-medium">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[9px] text-muted-foreground">
                      请假事由
                    </div>
                    <p className="mt-2 text-xs leading-5">{request.reason}</p>
                  </div>
                  <div className="rounded-xl border border-border p-3">
                    <div className="text-[9px] text-muted-foreground">
                      工作交接
                    </div>
                    <p className="mt-2 text-xs leading-5">{request.handover}</p>
                  </div>
                </div>

                <form action={processLeaveRequestAction} className="mt-4">
                  <input name="requestId" type="hidden" value={request.id} />
                  <input
                    name="version"
                    type="hidden"
                    value={request.version}
                  />
                  <textarea
                    className="min-h-20 w-full resize-y rounded-xl border border-border bg-[#fafcfe] px-3 py-2.5 text-xs leading-5 outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
                    name="opinion"
                    placeholder="同意时可选，退回或驳回时必填"
                  />
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      className="h-9 rounded-xl border border-[#f0dfc7] bg-[#fff8ee] px-3 text-[10px] font-medium text-[#8b612c]"
                      name="workflowAction"
                      type="submit"
                      value="return"
                    >
                      退回修改
                    </button>
                    <button
                      className="h-9 rounded-xl border border-[#ead8d8] bg-[#f8eeee] px-3 text-[10px] font-medium text-[#965151]"
                      name="workflowAction"
                      type="submit"
                      value="reject"
                    >
                      驳回
                    </button>
                    <button
                      className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                      name="workflowAction"
                      type="submit"
                      value="approve"
                    >
                      {request.status === "pending_hr_filing"
                        ? "完成备案"
                        : "同意并进入下一节点"}
                    </button>
                  </div>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
        <h2 className="text-base font-semibold">我的申请</h2>
        <div className="mt-4 space-y-3">
          {mine.length === 0 &&
          expenseMine.length === 0 &&
          sealMine.length === 0 ? (
            <div className="rounded-xl bg-[#f3f7fa] px-4 py-8 text-center text-xs text-muted-foreground">
              还没有审批申请
            </div>
          ) : (
            <>
              {sealMine.map((request) => {
                const detail = sealDetail(request);
                if (!detail) return null;

                return (
                  <article
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                    key={request.id}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <Stamp className="size-3.5 text-[#76589c]" />
                        {sealTypeLabels[detail.seal_type]} ·{" "}
                        {detail.document_title}
                      </div>
                      <div className="mt-1 text-[9px] text-muted-foreground">
                        {request.request_no} · 计划 {detail.use_date} ·{" "}
                        {detail.copies} 份
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#f3f6f5] px-2.5 py-1 text-[9px] text-muted-foreground">
                        {request.status === "pending"
                          ? sealStepLabel(request)
                          : statusLabels[request.status]}
                      </span>
                      {request.status === "pending" &&
                        request.current_step_order === 1 && (
                          <form action={processSealApprovalAction}>
                            <input
                              name="requestId"
                              type="hidden"
                              value={request.id}
                            />
                            <input
                              name="version"
                              type="hidden"
                              value={request.version}
                            />
                            <input name="opinion" type="hidden" value="" />
                            <button
                              className="h-8 rounded-lg border border-[#ead8d8] bg-[#f8eeee] px-3 text-[9px] font-medium text-[#965151]"
                              name="workflowAction"
                              type="submit"
                              value="withdraw"
                            >
                              撤回
                            </button>
                          </form>
                        )}
                      {request.status === "returned" && (
                        <form action={processSealApprovalAction}>
                          <input
                            name="requestId"
                            type="hidden"
                            value={request.id}
                          />
                          <input
                            name="version"
                            type="hidden"
                            value={request.version}
                          />
                          <input
                            name="opinion"
                            type="hidden"
                            value="确认文件信息后重新提交"
                          />
                          <button
                            className="h-8 rounded-lg bg-primary px-3 text-[9px] font-medium text-primary-foreground"
                            name="workflowAction"
                            type="submit"
                            value="resubmit"
                          >
                            重新提交
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                );
              })}

              {expenseMine.map((request) => {
                const detail = expenseDetail(request);
                if (!detail) return null;

                return (
                  <article
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                    key={request.id}
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs font-medium">
                        <ReceiptText className="size-3.5 text-primary" />
                        {expenseCategoryLabels[detail.expense_category]} ·{" "}
                        {formatCurrency(detail.amount)}
                      </div>
                      <div className="mt-1 text-[9px] text-muted-foreground">
                        {request.request_no} · {detail.occurred_on}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[#f3f6f5] px-2.5 py-1 text-[9px] text-muted-foreground">
                        {request.status === "pending"
                          ? expenseStepLabel(request.current_step_order)
                          : statusLabels[request.status]}
                      </span>
                      {request.status === "pending" &&
                        request.current_step_order === 1 && (
                          <form action={processExpenseApprovalAction}>
                            <input
                              name="requestId"
                              type="hidden"
                              value={request.id}
                            />
                            <input
                              name="version"
                              type="hidden"
                              value={request.version}
                            />
                            <input name="opinion" type="hidden" value="" />
                            <button
                              className="h-8 rounded-lg border border-[#ead8d8] bg-[#f8eeee] px-3 text-[9px] font-medium text-[#965151]"
                              name="workflowAction"
                              type="submit"
                              value="withdraw"
                            >
                              撤回
                            </button>
                          </form>
                        )}
                      {request.status === "returned" && (
                        <form action={processExpenseApprovalAction}>
                          <input
                            name="requestId"
                            type="hidden"
                            value={request.id}
                          />
                          <input
                            name="version"
                            type="hidden"
                            value={request.version}
                          />
                          <input
                            name="opinion"
                            type="hidden"
                            value="确认材料后重新提交"
                          />
                          <button
                            className="h-8 rounded-lg bg-primary px-3 text-[9px] font-medium text-primary-foreground"
                            name="workflowAction"
                            type="submit"
                            value="resubmit"
                          >
                            重新提交
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                );
              })}

              {mine.map((request) => (
              <article
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3"
                key={request.id}
              >
                <div>
                  <div className="text-xs font-medium">
                    {leaveTypeLabels[request.leave_type]} · {request.leave_days} 天
                  </div>
                  <div className="mt-1 text-[9px] text-muted-foreground">
                    {request.start_date} 至 {request.end_date}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[#f3f6f5] px-2.5 py-1 text-[9px] text-muted-foreground">
                    {statusLabels[request.status]}
                  </span>
                  {request.status === "pending_department" && (
                    <form action={processLeaveRequestAction}>
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <input
                        name="version"
                        type="hidden"
                        value={request.version}
                      />
                      <input name="opinion" type="hidden" value="" />
                      <button
                        className="h-8 rounded-lg border border-[#ead8d8] bg-[#f8eeee] px-3 text-[9px] font-medium text-[#965151]"
                        name="workflowAction"
                        type="submit"
                        value="withdraw"
                      >
                        撤回
                      </button>
                    </form>
                  )}
                  {request.status === "returned" && (
                    <form action={processLeaveRequestAction}>
                      <input
                        name="requestId"
                        type="hidden"
                        value={request.id}
                      />
                      <input
                        name="version"
                        type="hidden"
                        value={request.version}
                      />
                      <input
                        name="opinion"
                        type="hidden"
                        value="修改后重新提交"
                      />
                      <button
                        className="h-8 rounded-lg bg-primary px-3 text-[9px] font-medium text-primary-foreground"
                        name="workflowAction"
                        type="submit"
                        value="resubmit"
                      >
                        重新提交
                      </button>
                    </form>
                  )}
                </div>
              </article>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
}
