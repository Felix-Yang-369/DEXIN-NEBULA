import {
  BadgeCheck,
  CircleAlert,
  FileClock,
  KeyRound,
  UserCog,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { EmployeeAvatar } from "@/components/business/employee-avatar";
import type { CurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";
import { contractExpiresWithin } from "./hrm";
import {
  linkEmployeeAccountAction,
  saveEmployeeAction,
  saveEmployeeRolesAction,
  uploadEmployeeAvatarAction,
} from "./server-actions";

type Department = {
  id: string;
  name: string;
};

type EmployeeRow = {
  id: string;
  auth_user_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  employee_no: string;
  name: string;
  avatar_path: string | null;
  english_name: string | null;
  email: string | null;
  title: string | null;
  hired_on: string | null;
  status: "active" | "inactive";
  employment_status:
    | "active"
    | "departed"
    | "probation"
    | "intern"
    | "part_time";
  department: Department | Department[] | null;
  employee_roles: Array<{
    roles:
      | { code: string; name: string }
      | Array<{ code: string; name: string }>
      | null;
  }>;
};

type ContractSummary = {
  employee_id: string;
  ends_on: string | null;
  status: "draft" | "active" | "expired" | "terminated";
};

type LeaveSummary = {
  employee_id: string;
  balance_year: number;
};

const roleOptions = [
  ["employee", "普通员工"],
  ["department_lead", "部门负责人"],
  ["hr", "人事行政"],
  ["finance", "财务"],
  ["admin", "系统管理员"],
  ["chairman", "董事长"],
] as const;

const employmentStatusLabels: Record<EmployeeRow["employment_status"], string> = {
  active: "在职",
  departed: "已离职",
  probation: "试用",
  intern: "实习",
  part_time: "兼职",
};

const employmentStatusTones: Record<
  EmployeeRow["employment_status"],
  string
> = {
  active: "bg-[#eaf3f8] text-primary",
  departed: "bg-[#f3f6f5] text-muted-foreground",
  probation: "bg-[#fff4df] text-[#97651e]",
  intern: "bg-[#edf3fb] text-[#426c9b]",
  part_time: "bg-[#f1edfa] text-[#72529a]",
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function employeeRoleCodes(employee: EmployeeRow) {
  return employee.employee_roles
    .map((item) => relationOne(item.roles)?.code)
    .filter((code): code is string => Boolean(code));
}

function feedbackMessage(params: {
  saved?: string;
  rolesSaved?: string;
  accountLinked?: string;
  avatarSaved?: string;
  error?: string;
}) {
  if (params.saved === "1") return "员工档案和负责人关系已保存。";
  if (params.rolesSaved === "1") return "员工角色已更新。";
  if (params.accountLinked === "1") return "Supabase 登录账号已绑定。";
  if (params.avatarSaved === "1") return "员工职业照已更新。";

  const errors: Record<string, string> = {
    forbidden: "当前账号没有维护员工数据的权限。",
    duplicate: "员工编号或邮箱已存在。",
    manager: "直属负责人不存在、已停用或设置不正确。",
    self_protection: "不能停用当前登录账号。",
    employee_email_missing: "请先补充员工的企业邮箱，再绑定登录账号。",
    auth_email: "Auth 账号邮箱必须与员工档案邮箱一致。",
    auth_missing: "没有找到对应的 Supabase Auth 用户。",
    admin_protection: "不能移除当前账号的管理员角色。",
    governance_protection: "必须保留至少一位在职董事长。",
    invalid_employee: "员工资料格式不正确。",
    invalid_roles: "请至少保留普通员工角色。",
    invalid_auth_user: "Auth User UUID 格式不正确。",
    invalid_avatar: "请选择不超过 2MB 的 JPG、PNG 或 WebP 图片。",
    avatar_upload_failed: "职业照上传失败，请刷新后重试。",
    operation_failed: "操作未完成，请刷新后重试。",
  };

  return params.error ? errors[params.error] ?? errors.operation_failed : "";
}

function EmployeeFields({
  employee,
  departments,
  employees,
}: {
  employee?: EmployeeRow;
  departments: Department[];
  employees: EmployeeRow[];
}) {
  return (
    <>
      <input
        name="employeeId"
        type="hidden"
        value={employee?.id ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <label>
          <span className="text-[10px] font-medium">员工编号 *</span>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.employee_no}
            name="employeeNo"
            required
          />
        </label>
        <label>
          <span className="text-[10px] font-medium">姓名 *</span>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.name}
            name="name"
            required
          />
        </label>
        <label>
          <span className="text-[10px] font-medium">英文名</span>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.english_name ?? ""}
            name="englishName"
            placeholder="例如 Felix Yang"
          />
        </label>
        <label>
          <span className="text-[10px] font-medium">企业邮箱</span>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.email ?? ""}
            name="email"
            placeholder="账号开通前可暂留空"
            type="email"
          />
        </label>
        <label>
          <span className="text-[10px] font-medium">职位</span>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.title ?? ""}
            name="title"
          />
        </label>
        <label>
          <span className="text-[10px] font-medium">部门</span>
          <select
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.department_id ?? ""}
            name="departmentId"
          >
            <option value="">暂不分配</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-[10px] font-medium">直属负责人</span>
          <select
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.manager_id ?? ""}
            name="managerId"
          >
            <option value="">暂不设置</option>
            {employees
              .filter(
                (candidate) =>
                  candidate.id !== employee?.id && candidate.status === "active",
              )
              .map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} · {candidate.employee_no}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span className="text-[10px] font-medium">入职日期</span>
          <input
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.hired_on ?? ""}
            name="hiredOn"
            type="date"
          />
        </label>
        <label>
          <span className="text-[10px] font-medium">员工状态</span>
          <select
            className="mt-2 h-10 w-full rounded-xl border border-border bg-white px-3 text-xs outline-none focus:border-primary/35 focus:ring-4 focus:ring-primary/7"
            defaultValue={employee?.employment_status ?? "active"}
            name="status"
          >
            <option value="active">在职</option>
            <option value="departed">已离职</option>
            <option value="probation">试用</option>
            <option value="intern">实习</option>
            <option value="part_time">兼职</option>
          </select>
        </label>
      </div>
    </>
  );
}

export async function ConnectedEmployeeManagement({
  currentEmployee,
  feedback,
}: {
  currentEmployee: CurrentEmployee;
  feedback: {
    saved?: string;
    rolesSaved?: string;
    accountLinked?: string;
    avatarSaved?: string;
    error?: string;
  };
}) {
  const canManage = currentEmployee.roleCodes.some((role) =>
    ["admin", "hr"].includes(role),
  );
  const canView =
    canManage || currentEmployee.roleCodes.includes("chairman");
  const isAdmin = currentEmployee.roleCodes.includes("admin");

  if (!canView) {
    return (
      <main className="mx-auto max-w-[1000px] p-4 sm:p-6 xl:p-8">
        <section className="rounded-[22px] border border-[#ead8d8] bg-white p-8 text-center">
          <CircleAlert className="mx-auto size-8 text-[#965151]" />
          <h1 className="mt-4 text-lg font-semibold">无权维护员工档案</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            该页面仅向人事行政、系统管理员和董事长只读开放。
          </p>
        </section>
      </main>
    );
  }

  const supabase = await createClient();
  const [
    { data: employeeData, error },
    { data: departmentData },
    { data: contractData },
    { data: leaveData },
  ] =
    await Promise.all([
      supabase
        .from("employees")
        .select(
          "id, auth_user_id, department_id, manager_id, employee_no, name, avatar_path, english_name, email, title, hired_on, status, employment_status, department:departments!employees_department_id_fkey(id, name), employee_roles(roles(code, name))",
        )
        .order("employee_no"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("employee_contracts")
        .select("employee_id, ends_on, status")
        .eq("status", "active"),
      supabase
        .from("employee_leave_balances")
        .select("employee_id, balance_year")
        .eq("balance_year", new Date().getFullYear()),
    ]);

  const employees = (employeeData ?? []) as EmployeeRow[];
  const departments = (departmentData ?? []) as Department[];
  const contracts = (contractData ?? []) as ContractSummary[];
  const leaveBalances = (leaveData ?? []) as LeaveSummary[];
  const avatarPaths = employees
    .map((employee) => employee.avatar_path)
    .filter((path): path is string => Boolean(path));
  const { data: signedAvatars } = avatarPaths.length
    ? await supabase.storage.from("avatars").createSignedUrls(avatarPaths, 3600)
    : { data: [] };
  const avatarUrls = new Map(
    (signedAvatars ?? [])
      .filter((avatar) => avatar.signedUrl)
      .map((avatar) => [avatar.path, avatar.signedUrl]),
  );
  const employeeNames = new Map(
    employees.map((employee) => [employee.id, employee.name]),
  );
  const activeCount = employees.filter(
    (employee) => employee.status === "active",
  ).length;
  const accountCount = employees.filter(
    (employee) => employee.auth_user_id,
  ).length;
  const emailPendingCount = employees.filter(
    (employee) => employee.status === "active" && !employee.email,
  ).length;
  const avatarCount = employees.filter(
    (employee) => employee.status === "active" && employee.avatar_path,
  ).length;
  const managerMissingCount = employees.filter(
    (employee) => employee.status === "active" && !employee.manager_id,
  ).length;
  const asOfDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const contractWarningCount = contracts.filter(
    (contract) => contractExpiresWithin(contract.ends_on, asOfDate, 60),
  ).length;
  const leaveConfiguredIds = new Set(
    leaveBalances.map((balance) => balance.employee_id),
  );
  const leavePendingCount = employees.filter(
    (employee) =>
      employee.status === "active" && !leaveConfiguredIds.has(employee.id),
  ).length;
  const message = feedbackMessage(feedback);

  return (
    <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="text-xs font-medium text-primary">
            EMPLOYEE ADMINISTRATION
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
            员工档案与任职管理
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            维护员工、部门、直属负责人、账号状态与角色，审批流程将直接使用这里的组织关系。
          </p>
        </div>
        {canManage && <details className="group">
          <summary className="flex h-10 cursor-pointer list-none items-center rounded-xl bg-primary px-4 text-xs font-medium text-primary-foreground">
            ＋ 新建员工
          </summary>
          <div className="absolute right-8 z-10 mt-2 w-[min(680px,calc(100vw-32px))] rounded-[20px] border border-border bg-[#fafcfe] p-5 shadow-xl">
            <form action={saveEmployeeAction}>
              <h2 className="mb-4 text-sm font-semibold">创建员工档案</h2>
              <EmployeeFields
                departments={departments}
                employees={employees}
              />
              <div className="mt-5 flex justify-end">
                <button
                  className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                  type="submit"
                >
                  保存员工
                </button>
              </div>
            </form>
          </div>
        </details>}
      </section>

      {message && (
        <div
          className={`mt-5 rounded-xl px-4 py-3 text-xs ${
            feedback.error
              ? "border border-[#ead8d8] bg-[#f8eeee] text-[#965151]"
              : "border border-[#d8e8ee] bg-[#eef4f8] text-primary"
          }`}
        >
          {message}
        </div>
      )}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          [String(employees.length), "员工总数", "当前组织员工档案"],
          [String(activeCount), "在职员工", "可参与组织和审批关系"],
          [String(accountCount), "已绑定账号", "可登录 Supabase Auth"],
          [
            String(contractWarningCount),
            "合同到期提醒",
            "未来 60 天内到期或已过期",
          ],
          [String(leavePendingCount), "假期待配置", "本年度尚未建立假期账户"],
          [String(managerMissingCount), "负责人待完善", "在职但未设置直属负责人"],
          [String(emailPendingCount), "邮箱待补充", "仅企业邮箱可用于登录"],
          [String(avatarCount), "职业照", "私有头像库已关联"],
        ].map(([value, label, note]) => (
          <article
            className="rounded-[18px] border border-border/75 bg-card p-5"
            key={label}
          >
            <div className="text-[26px] font-semibold tracking-[-0.04em]">
              {value}
            </div>
            <div className="mt-2 text-xs font-medium">{label}</div>
            <div className="mt-1 text-[10px] text-muted-foreground">{note}</div>
          </article>
        ))}
      </section>

      <section className="mt-5 overflow-hidden rounded-[20px] border border-border/75 bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 p-5 sm:px-6">
          <div>
            <h2 className="text-base font-semibold">员工列表</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              人事可维护档案；管理员额外维护角色和登录账号绑定
            </p>
          </div>
          <span className="rounded-full bg-[#eaf3f8] px-3 py-1.5 text-[9px] font-medium text-primary">
            服务端权限已启用
          </span>
        </div>

        {error ? (
          <div className="px-6 py-14 text-center text-xs text-[#965151]">
            无法读取员工数据，请刷新后重试；若问题持续出现，请联系系统管理员。
          </div>
        ) : employees.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <UsersRound className="mx-auto size-8 text-primary" />
            <h3 className="mt-4 text-sm font-medium">尚未创建员工档案</h3>
          </div>
        ) : (
          <div className="divide-y divide-border/70">
            {employees.map((employee) => {
              const department = relationOne(employee.department);
              const codes = employeeRoleCodes(employee);

              return (
                <article className="p-5 sm:px-6" key={employee.id}>
                  <div className="flex flex-wrap items-center gap-4">
                    <EmployeeAvatar
                      name={employee.name}
                      src={
                        employee.avatar_path
                          ? avatarUrls.get(employee.avatar_path)
                          : null
                      }
                    />
                    <div className="min-w-[180px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">
                          {employee.name}
                        </h3>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[9px] ${employmentStatusTones[employee.employment_status]}`}
                        >
                          {employmentStatusLabels[employee.employment_status]}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {employee.employee_no} · {department?.name ?? "未分部门"} ·{" "}
                        {employee.title ?? "未设置职位"}
                      </p>
                      {employee.english_name && (
                        <p className="mt-1 text-[9px] text-muted-foreground/75">
                          {employee.english_name}
                        </p>
                      )}
                    </div>
                    <div className="grid min-w-[220px] grid-cols-2 gap-3 text-[10px]">
                      <div>
                        <div className="text-muted-foreground">直属负责人</div>
                        <div className="mt-1 font-medium">
                          {employee.manager_id
                            ? employeeNames.get(employee.manager_id) ?? "待设置"
                            : "待设置"}
                        </div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">登录账号</div>
                        <div className="mt-1 font-medium">
                          {employee.auth_user_id ? "已绑定" : "未绑定"}
                        </div>
                      </div>
                    </div>
                    {canManage && <details>
                      <summary className="cursor-pointer list-none rounded-xl border border-border bg-white px-3 py-2 text-[10px] font-medium">
                        管理
                      </summary>
                      <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(280px,.7fr)]">
                        <form
                          action={saveEmployeeAction}
                          className="rounded-2xl border border-border bg-[#fafcfe] p-4"
                        >
                          <div className="mb-4 flex items-center gap-2">
                            <UserCog className="size-4 text-primary" />
                            <h4 className="text-xs font-semibold">
                              档案与负责人
                            </h4>
                          </div>
                          <EmployeeFields
                            departments={departments}
                            employee={employee}
                            employees={employees}
                          />
                          <div className="mt-4 flex justify-end">
                            <button
                              className="h-9 rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground"
                              type="submit"
                            >
                              保存档案
                            </button>
                          </div>
                        </form>

                        <div className="space-y-4">
                          <section className="rounded-2xl border border-border bg-[#fafcfe] p-4">
                            <div className="flex items-center gap-3">
                              <EmployeeAvatar
                                name={employee.name}
                                size="lg"
                                src={
                                  employee.avatar_path
                                    ? avatarUrls.get(employee.avatar_path)
                                    : null
                                }
                              />
                              <div>
                                <h4 className="text-xs font-semibold">
                                  员工职业照
                                </h4>
                                <p className="mt-1 text-[9px] text-muted-foreground">
                                  私有存储，仅公司内部登录后可查看
                                </p>
                              </div>
                            </div>
                            <form
                              action={uploadEmployeeAvatarAction}
                              className="mt-3"
                            >
                              <input
                                name="employeeId"
                                type="hidden"
                                value={employee.id}
                              />
                              <input
                                accept="image/jpeg,image/png,image/webp"
                                className="block w-full text-[9px] text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-[9px] file:font-medium file:text-primary"
                                name="avatar"
                                required
                                type="file"
                              />
                              <button
                                className="mt-3 h-8 w-full rounded-lg border border-primary/20 bg-white text-[9px] font-medium text-primary"
                                type="submit"
                              >
                                上传或更换职业照
                              </button>
                            </form>
                          </section>

                          <section className="rounded-2xl border border-border bg-[#fafcfe] p-4">
                            <div className="flex items-center gap-2">
                              <BadgeCheck className="size-4 text-primary" />
                              <h4 className="text-xs font-semibold">角色分配</h4>
                            </div>
                            {isAdmin ? (
                              <form
                                action={saveEmployeeRolesAction}
                                className="mt-3"
                              >
                                <input
                                  name="employeeId"
                                  type="hidden"
                                  value={employee.id}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                  {roleOptions.map(([code, label]) => (
                                    <label
                                      className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-2 text-[9px]"
                                      key={code}
                                    >
                                      <input
                                        defaultChecked={codes.includes(code)}
                                        name="roleCodes"
                                        type="checkbox"
                                        value={code}
                                      />
                                      {label}
                                    </label>
                                  ))}
                                </div>
                                <button
                                  className="mt-3 h-8 w-full rounded-lg border border-primary/20 bg-white text-[9px] font-medium text-primary"
                                  type="submit"
                                >
                                  保存角色
                                </button>
                              </form>
                            ) : (
                              <p className="mt-3 text-[9px] leading-5 text-muted-foreground">
                                只有系统管理员可以调整角色。
                              </p>
                            )}
                          </section>

                          <section className="rounded-2xl border border-border bg-[#fafcfe] p-4">
                            <div className="flex items-center gap-2">
                              <KeyRound className="size-4 text-primary" />
                              <h4 className="text-xs font-semibold">登录账号</h4>
                            </div>
                            {employee.auth_user_id ? (
                              <div className="mt-3 rounded-lg bg-[#eaf3f8] px-3 py-2 text-[9px] text-primary">
                                已绑定 Supabase Auth 账号
                              </div>
                            ) : isAdmin ? (
                              <form
                                action={linkEmployeeAccountAction}
                                className="mt-3"
                              >
                                <input
                                  name="employeeId"
                                  type="hidden"
                                  value={employee.id}
                                />
                                <input
                                  className="h-9 w-full rounded-lg border border-border bg-white px-3 text-[9px]"
                                  name="authUserId"
                                  placeholder="Auth User UUID"
                                  required
                                />
                                <button
                                  className="mt-2 h-8 w-full rounded-lg border border-primary/20 bg-white text-[9px] font-medium text-primary"
                                  type="submit"
                                >
                                  绑定已有账号
                                </button>
                              </form>
                            ) : (
                              <p className="mt-3 text-[9px] leading-5 text-muted-foreground">
                                只有系统管理员可以绑定登录账号。
                              </p>
                            )}
                          </section>
                        </div>
                      </div>
                    </details>}
                    <Link
                      className="rounded-xl bg-[#eaf3f8] px-3 py-2 text-[10px] font-medium text-primary"
                      href={`/employees/${employee.id}`}
                    >
                      人事档案
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-5 grid gap-4 md:grid-cols-3">
        {[
          {
            icon: FileClock,
            title: "合同与到期",
            copy: "合同台账按到期日形成提醒，原件仍由私有文件中心保存。",
          },
          {
            icon: KeyRound,
            title: "账号绑定",
            copy: "先在 Supabase Auth 创建用户，再按相同邮箱绑定员工。",
          },
          {
            icon: BadgeCheck,
            title: "员工全生命周期",
            copy: "入职、调动、晋升、转正、离职和返聘均保留不可丢失的历史。",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article
              className="rounded-[18px] border border-border bg-white p-4"
              key={item.title}
            >
              <Icon className="size-4 text-primary" />
              <h3 className="mt-3 text-xs font-semibold">{item.title}</h3>
              <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                {item.copy}
              </p>
            </article>
          );
        })}
      </section>
    </main>
  );
}
