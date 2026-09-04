import type { Metadata } from "next";
import Link from "next/link";
import { EmployeeAvatar } from "@/components/business/employee-avatar";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "组织架构",
  description: "德馨淼盛组织、部门、职位与员工账号管理",
};

const setupSteps = [
  {
    index: "01",
    title: "确认部门",
    description: "核对部门名称、上下级和部门编码。",
    status: "已完成",
  },
  {
    index: "02",
    title: "设置职位",
    description: "建立岗位名称、职级与所属部门。",
    status: "已完成",
  },
  {
    index: "03",
    title: "导入员工",
    description: "使用模板导入员工及直属负责人。",
    status: "已完成",
  },
  {
    index: "04",
    title: "分配角色",
    description: "按职责授予页面、操作与数据权限。",
    status: "待完善",
  },
];

const permissionRoles = [
  { name: "普通员工", scope: "本人数据", mark: "员" },
  { name: "部门负责人", scope: "本部门数据", mark: "负" },
  { name: "人事行政", scope: "组织与员工", mark: "人" },
  { name: "财务", scope: "费用与报销", mark: "财" },
  { name: "系统管理员", scope: "系统配置", mark: "管" },
];

type DepartmentRow = {
  id: string;
  name: string;
  code: string;
  manager:
    | { name: string; title: string | null; avatar_path: string | null }
    | Array<{ name: string; title: string | null; avatar_path: string | null }>
    | null;
};

type OrganizationEmployee = {
  id: string;
  employee_no: string;
  department_id: string | null;
  manager_id: string | null;
  auth_user_id: string | null;
  name: string;
  title: string | null;
  avatar_path: string | null;
  status: "active";
  department:
    | { name: string }
    | Array<{ name: string }>
    | null;
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function OrganizationPersonCard({
  employee,
  avatarUrl,
  emphasized = false,
}: {
  employee: OrganizationEmployee;
  avatarUrl?: string | null;
  emphasized?: boolean;
}) {
  const department = relationOne(employee.department);
  return (
    <article
      className={`relative flex min-w-0 items-center gap-3 rounded-lg border p-3 text-left  ${
        emphasized
          ? "border-primary/35 bg-primary/5 text-foreground"
          : "border-border/80 bg-white"
      }`}
    >
      <EmployeeAvatar
        name={employee.name}
        size={emphasized ? "lg" : "md"}
        src={avatarUrl}
      />
      <div className="min-w-0">
        <div
          className={`truncate text-xs font-semibold ${
            emphasized ? "text-primary" : "text-foreground"
          }`}
        >
          {employee.name}
        </div>
        <div
          className={`mt-1 truncate text-xs ${
            emphasized ? "text-muted-foreground" : "text-primary"
          }`}
        >
          {employee.title ?? "职位待设置"}
        </div>
        <div
          className={`mt-0.5 truncate text-xs ${
            "text-muted-foreground"
          }`}
        >
          {department?.name ?? "未分部门"}
        </div>
      </div>
    </article>
  );
}

export default async function OrganizationPage() {
  const currentEmployee = await requireCurrentEmployee();
  const supabase = await createClient();
  const [{ data: departmentData }, { data: employeeData }] = await Promise.all([
    supabase
      .from("departments")
      .select(
        "id, name, code, manager:employees!departments_manager_employee_id_fkey(name, title, avatar_path)",
      )
      .eq("status", "active")
      .order("code"),
    supabase
      .from("employees")
      .select(
        "id, employee_no, department_id, manager_id, auth_user_id, name, title, avatar_path, status, department:departments!employees_department_id_fkey(name)",
      )
      .eq("status", "active")
      .not("employee_no", "like", "DX-DEV-%")
      .order("employee_no"),
  ]);
  const organizationEmployees = (employeeData ?? []) as OrganizationEmployee[];
  const departments = ((departmentData ?? []) as DepartmentRow[]).map(
    (department) => {
      const manager = Array.isArray(department.manager)
        ? department.manager[0]
        : department.manager;
      const members = organizationEmployees.filter(
        (employee) => employee.department_id === department.id,
      ).length;

      return {
        ...department,
        parent: "德馨淼盛",
        leader: manager?.name ?? "待设置",
        members: String(members),
        status: manager ? "已启用" : "负责人待设置",
      };
    },
  );
  const activeEmployees = organizationEmployees.length;
  const accountCount =
    organizationEmployees.filter((employee) => employee.auth_user_id).length;
  const avatarPaths = organizationEmployees
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
  const chairman =
    organizationEmployees.find(
      (employee) =>
        employee.title?.includes("董事长") &&
        !employee.title.includes("助理"),
    ) ??
    organizationEmployees.find((employee) => !employee.manager_id) ??
    null;
  const supportEmployees = chairman
    ? organizationEmployees.filter(
        (employee) =>
          employee.id !== chairman.id &&
          !employee.manager_id &&
          employee.title?.includes("助理"),
      )
    : [];
  const directReports = chairman
    ? organizationEmployees.filter(
        (employee) => employee.manager_id === chairman.id,
      )
    : [];
  const branchEmployees = new Map(
    directReports.map((leader) => [
      leader.id,
      organizationEmployees.filter(
        (employee) => employee.manager_id === leader.id,
      ),
    ]),
  );

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="组织运营 / 人力资源 / 组织架构"
      currentUser={{ name: currentEmployee.name, roleLabel: currentEmployee.title ?? "员工" }}
    >
      <main className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8">
          <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium text-primary">ORGANIZATION</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                组织架构
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                建立全平台共享的部门、职位、员工与汇报关系，为权限和审批流程提供基础。
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="h-10 rounded-md border border-border bg-card px-4 text-xs font-medium text-foreground"
                href="/hr/job-structure"
              >
                岗位与职级
              </Link>
              <Link
                className="h-10 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground "
                href="/employees"
              >
                维护人员关系
              </Link>
            </div>
          </section>

          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              ["1", "组织主体", "德馨淼盛"],
              [String(departments.length), "正式部门", "已接入真实组织数据"],
              [String(activeEmployees), "在职员工", `${accountCount} 个账号已开通`],
              ["6", "预设角色", "权限矩阵已启用"],
            ].map(([value, label, note]) => (
              <article
                className="rounded-md border border-border/75 bg-card p-5"
                key={label}
              >
                <div className="text-[26px] font-semibold tracking-[-0.04em]">
                  {value}
                </div>
                <div className="mt-2 text-xs font-medium">{label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{note}</div>
              </article>
            ))}
          </section>

          <section className="mt-5 overflow-hidden rounded-md border border-border/75 bg-card p-5 sm:p-7">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <div className="text-xs font-medium tracking-[0.14em] text-primary/60">
                  ORGANIZATION TREE
                </div>
                <h2 className="mt-2 text-base font-semibold">公司组织架构图</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  根据真实员工直属负责人关系自动生成，人员和汇报关系更新后同步变化
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-muted px-2.5 py-1 text-primary">
                  {directReports.length} 个直属管理分支
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-foreground">
                  {activeEmployees} 名在职员工
                </span>
              </div>
            </div>

            {chairman ? (
              <div className="mt-7 overflow-x-auto pb-2">
                <div className="mx-auto min-w-[760px] max-w-[1120px]">
                  <div className="grid grid-cols-[1fr_minmax(240px,320px)_1fr] items-center gap-5">
                    <div className="flex justify-end">
                      {supportEmployees.map((employee) => (
                        <div className="relative w-full max-w-[230px]" key={employee.id}>
                          <div className="absolute left-full top-1/2 hidden w-5 border-t border-dashed border-border sm:block" />
                          <OrganizationPersonCard
                            avatarUrl={
                              employee.avatar_path
                                ? avatarUrls.get(employee.avatar_path)
                                : undefined
                            }
                            employee={employee}
                          />
                          <div className="mt-1 text-center text-xs tracking-[0.12em] text-muted-foreground">
                            直属支持
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="relative">
                      <div className="absolute -inset-1 rounded-md border border-border" />
                      <OrganizationPersonCard
                        avatarUrl={
                          chairman.avatar_path
                            ? avatarUrls.get(chairman.avatar_path)
                            : undefined
                        }
                        emphasized
                        employee={chairman}
                      />
                    </div>
                    <div />
                  </div>

                  {directReports.length > 0 && (
                    <>
                      <div className="mx-auto h-8 w-px bg-primary" />
                      <div className="relative mx-auto h-5 w-[calc(100%-22%)] border-x border-t border-border">
                        <span className="absolute left-1/2 top-[-5px] size-2.5 -translate-x-1/2 rounded-full border-2 border-border bg-white" />
                      </div>
                      <div
                        className="grid items-start gap-5"
                        style={{
                          gridTemplateColumns: `repeat(${directReports.length}, minmax(0, 1fr))`,
                        }}
                      >
                        {directReports.map((leader) => {
                          const reports = branchEmployees.get(leader.id) ?? [];
                          return (
                            <div className="relative" key={leader.id}>
                              <span className="absolute -top-7 left-1/2 h-7 w-px -translate-x-1/2 bg-primary" />
                              <span className="absolute -top-[30px] left-1/2 size-2.5 -translate-x-1/2 rounded-full border-2 border-border bg-white" />
                              <OrganizationPersonCard
                                avatarUrl={
                                  leader.avatar_path
                                    ? avatarUrls.get(leader.avatar_path)
                                    : undefined
                                }
                                employee={leader}
                              />
                              {reports.length > 0 && (
                                <div className="relative mt-7 space-y-2 border-l border-border pl-4">
                                  <span className="absolute -left-1 top-0 size-2 rounded-full bg-muted" />
                                  {reports.map((report) => (
                                    <OrganizationPersonCard
                                      avatarUrl={
                                        report.avatar_path
                                          ? avatarUrls.get(report.avatar_path)
                                          : undefined
                                      }
                                      employee={report}
                                      key={report.id}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6 rounded-lg border border-dashed border-border bg-white px-5 py-12 text-center text-xs text-muted-foreground">
                尚未设置公司最高负责人，请先在员工档案中维护职位和直属负责人。
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
              <p className="text-xs text-muted-foreground">
                图中仅展开最高负责人、直属管理层及下一层负责人；完整员工列表仍在下方部门清单和员工档案中查看。
              </p>
              <Link
                className="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white"
                href="/employees"
              >
                维护汇报关系
              </Link>
            </div>
          </section>

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.42fr)_minmax(320px,.58fr)]">
            <div className="space-y-5">
              <section className="overflow-hidden rounded-md border border-border/75 bg-card">
                <div className="flex flex-col gap-4 border-b border-border/70 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em]">
                      部门清单
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      已依据员工总名单接入在职人员、岗位、负责人和部门人数
                    </p>
                  </div>
                  <div className="flex rounded-md bg-muted p-1 text-xs">
                    <button
                      className="rounded-lg bg-white px-3 py-1.5 font-medium text-primary "
                      type="button"
                    >
                      部门
                    </button>
                    <button
                      className="px-3 py-1.5 text-muted-foreground"
                      type="button"
                    >
                      职位
                    </button>
                    <button
                      className="px-3 py-1.5 text-muted-foreground"
                      type="button"
                    >
                      员工
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-border/70 bg-muted text-xs font-medium text-muted-foreground">
                        <th className="px-6 py-3">部门名称</th>
                        <th className="px-4 py-3">部门编码</th>
                        <th className="px-4 py-3">上级组织</th>
                        <th className="px-4 py-3">负责人</th>
                        <th className="px-4 py-3">人数</th>
                        <th className="px-4 py-3">状态</th>
                        <th className="px-6 py-3 text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/70">
                      {departments.map((department) => (
                        <tr
                          className="text-xs transition-colors hover:bg-muted"
                          key={department.code}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className="grid size-8 place-items-center rounded-md bg-muted text-xs font-semibold text-primary">
                                {department.name.slice(0, 1)}
                              </span>
                              <span className="font-medium">{department.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 font-mono text-xs text-muted-foreground">
                            {department.code}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {department.parent}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {department.leader}
                          </td>
                          <td className="px-4 py-4 text-muted-foreground">
                            {department.members}
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                department.leader === "待设置"
                                  ? "bg-muted text-foreground"
                                  : "bg-muted text-primary"
                              }`}
                            >
                              {department.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              className="text-xs font-medium text-primary"
                              type="button"
                            >
                              编辑
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="rounded-md border border-border/75 bg-card p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em]">
                      角色与数据范围
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      角色决定操作权限，数据范围决定可以查看哪些记录
                    </p>
                  </div>
                  <button
                    className="text-xs font-medium text-primary"
                    type="button"
                  >
                    权限矩阵
                  </button>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {permissionRoles.map((role) => (
                    <article
                      className="rounded-lg border border-border/70 bg-muted p-4"
                      key={role.name}
                    >
                      <span className="grid size-8 place-items-center rounded-md bg-muted text-xs font-semibold text-primary">
                        {role.mark}
                      </span>
                      <h3 className="mt-4 text-xs font-medium">{role.name}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {role.scope}
                      </p>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className="rounded-md border border-border/75 bg-card p-5 sm:p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em]">
                      初始化进度
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      按顺序完成组织基础配置
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-primary">
                    3 / 4
                  </span>
                </div>
                <div className="mt-5 space-y-5">
                  {setupSteps.map((step, index) => (
                    <div className="flex gap-3" key={step.index}>
                      <div className="flex flex-col items-center">
                        <span
                          className={`grid size-8 place-items-center rounded-md text-xs font-semibold ${
                            index < 3
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {step.index}
                        </span>
                        {index < setupSteps.length - 1 && (
                          <span className="mt-1 h-8 w-px bg-border" />
                        )}
                      </div>
                      <div className="pb-1">
                        <div className="flex items-center gap-2">
                          <h3 className="text-xs font-medium">{step.title}</h3>
                          <span
                            className={`text-xs ${
                              index < 3 ? "text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {step.status}
                          </span>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-md bg-primary p-5 text-white sm:p-6">
                <div className="text-xs font-medium tracking-[0.14em] text-muted-foreground">
                  DATA PREPARATION
                </div>
                <h2 className="mt-3 text-base font-semibold">需要准备的资料</h2>
                <ul className="mt-4 space-y-3 text-xs text-white/58">
                  {[
                    "部门及上下级关系",
                    "岗位和部门负责人",
                    "员工姓名、邮箱与入职日期",
                    "员工直属负责人",
                    "首批角色分配",
                  ].map((item) => (
                    <li className="flex items-center gap-2" key={item}>
                      <span className="size-1.5 rounded-full bg-muted" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  className="mt-5 h-9 rounded-md bg-white px-4 text-xs font-medium text-foreground"
                  type="button"
                >
                  查看数据模板
                </button>
              </section>

              <section className="rounded-md border border-border bg-muted p-5">
                <div className="text-xs font-medium text-foreground">
                  账号开通待完善
                </div>
                <p className="mt-2 text-xs leading-5 text-foreground">
                  组织与在职人员已经接入。名单中的身份证、工资、银行卡等敏感字段未导入；
                  其余员工需补充企业邮箱后，再逐一开通登录账号。
                </p>
              </section>
            </div>
          </div>
      </main>
    </WorkflowShell>
  );
}
