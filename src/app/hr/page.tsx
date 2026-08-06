import type { Metadata } from "next";
import Link from "next/link";
import {
  BarChart3,
  BookOpenCheck,
  BriefcaseBusiness,
  Building2,
  CalendarCheck2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  FileUser,
  GraduationCap,
  Network,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { contractExpiresWithin } from "@/features/employees/hrm";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "人力资源 HRM",
  description: "德馨星云组织、员工、入离职、考勤、请假、合同与人才发展中心",
};

export const dynamic = "force-dynamic";

type Department = { id: string; name: string };
type EmployeeSummary = {
  id: string;
  department_id: string | null;
  hired_on: string | null;
  status: "active" | "inactive";
  employment_status: string;
};

const moduleGroups = [
  {
    title: "组织与人员基础",
    modules: [
      {
        title: "组织架构",
        english: "Organization",
        description: "公司、部门、岗位、职级、汇报关系与组织架构图",
        href: "/organization",
        status: "已接入",
        icon: Network,
      },
      {
        title: "员工档案",
        english: "Employee",
        description: "员工主档、照片、任职信息、合同、假期与附件",
        href: "/employees",
        status: "已接入",
        icon: FileUser,
      },
      {
        title: "招聘管理",
        english: "Recruitment",
        description: "招聘需求、候选人、面试、Offer 与人才库",
        href: "/hr/recruitment",
        status: "规划中",
        icon: UserPlus,
      },
      {
        title: "入职离职",
        english: "Onboarding",
        description: "入职资料、账号、设备、权限与离职交接清单",
        href: "/hr/onboarding",
        status: "已接入",
        icon: ClipboardList,
      },
    ],
  },
  {
    title: "员工服务与协同",
    modules: [
      {
        title: "考勤管理",
        english: "Attendance",
        description: "上下班、外勤、加班、出差及外部考勤接口预留",
        href: "/hr/attendance",
        status: "已接入",
        icon: CalendarCheck2,
      },
      {
        title: "请假审批",
        english: "Leave",
        description: "请假申请、主管审批、HR 备案与假期账户",
        href: "/requests/leave",
        status: "已接入",
        icon: BriefcaseBusiness,
      },
      {
        title: "薪资管理",
        english: "Payroll",
        description: "工资、奖金、社保、公积金、个税与工资条",
        href: "/hr/payroll",
        status: "规划中",
        icon: CircleDollarSign,
      },
    ],
  },
  {
    title: "人才发展与决策",
    modules: [
      {
        title: "绩效考核",
        english: "Performance",
        description: "按员工配置差异化指标，联动 CRM 客户销售、利润增量与财务营收",
        href: "/hr/performance",
        status: "已接入",
        icon: TrendingUp,
      },
      {
        title: "培训中心",
        english: "Learning",
        description: "入职培训、制度、SOP、产品知识和考试记录",
        href: "/knowledge",
        status: "资料已接入",
        icon: GraduationCap,
      },
      {
        title: "HR 数据分析",
        english: "Dashboard",
        description: "人数、司龄、流动、合同、请假和组织结构分析",
        href: "#analytics",
        status: "基础版",
        icon: BarChart3,
      },
    ],
  },
] as const;

function today() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function monthStart() {
  return `${today().slice(0, 7)}-01`;
}

export default async function HrPage() {
  const currentEmployee = await requireCurrentEmployee();
  const canViewManagement = currentEmployee.roleCodes.some((role) =>
    ["hr", "admin", "chairman"].includes(role),
  );
  const supabase = await createClient();

  let employees: EmployeeSummary[] = [];
  let departments: Department[] = [];
  let contractWarnings = 0;
  let leavePending = 0;
  let positionCount = 0;
  let levelCount = 0;
  let leaveRequestCount = 0;

  if (canViewManagement) {
    const [
      employeeResult,
      departmentResult,
      contractResult,
      leaveBalanceResult,
      positionResult,
      levelResult,
      leaveRequestResult,
    ] = await Promise.all([
      supabase
        .from("employees")
        .select("id, department_id, hired_on, status, employment_status"),
      supabase
        .from("departments")
        .select("id, name")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("employee_contracts")
        .select("employee_id, ends_on")
        .eq("status", "active"),
      supabase
        .from("employee_leave_balances")
        .select("employee_id")
        .eq("balance_year", Number(today().slice(0, 4))),
      supabase
        .from("positions")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("job_levels")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      supabase
        .from("leave_requests")
        .select("id", { count: "exact", head: true })
        .gte("start_date", monthStart()),
    ]);

    employees = (employeeResult.data ?? []) as EmployeeSummary[];
    departments = (departmentResult.data ?? []) as Department[];
    contractWarnings = (contractResult.data ?? []).filter((item) =>
      contractExpiresWithin(item.ends_on, today(), 60),
    ).length;
    const leaveConfigured = new Set(
      (leaveBalanceResult.data ?? []).map((item) => item.employee_id),
    );
    leavePending = employees.filter(
      (item) => item.status === "active" && !leaveConfigured.has(item.id),
    ).length;
    positionCount = positionResult.count ?? 0;
    levelCount = levelResult.count ?? 0;
    leaveRequestCount = leaveRequestResult.count ?? 0;
  }

  const activeEmployees = employees.filter(
    (item) => item.status === "active",
  );
  const newHireCount = activeEmployees.filter(
    (item) => item.hired_on && item.hired_on >= monthStart(),
  ).length;
  const probationCount = activeEmployees.filter(
    (item) => item.employment_status === "probation",
  ).length;
  const departmentCounts = departments.map((department) => ({
    name: department.name,
    count: activeEmployees.filter(
      (employee) => employee.department_id === department.id,
    ).length,
  }));
  const maxDepartmentCount = Math.max(
    ...departmentCounts.map((item) => item.count),
    1,
  );

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="人力资源 / HRM 总览"
      currentUser={{
        name: currentEmployee.name,
        roleLabel: currentEmployee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8 lg:px-10">
          <div className="absolute -right-20 -top-24 size-80 rounded-full border border-white/8" />
          <Building2 className="absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.05] sm:block" />
          <div className="relative">
            <div className="text-[10px] font-medium tracking-[0.16em] text-[#79d8d5]">
              HRM · HUMAN RESOURCE MANAGEMENT
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
              人力资源管理
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
              连接组织、员工、入离职、考勤请假、合同与人才发展，形成员工全生命周期管理中心。
            </p>
          </div>
        </section>

        {canViewManagement ? (
          <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              [activeEmployees.length, "在职人数", "当前有效用工"],
              [newHireCount, "本月入职", "按入职日期统计"],
              [probationCount, "试用员工", "待跟踪转正"],
              [contractWarnings, "合同提醒", "60 天内到期"],
              [leavePending, "假期待配置", "本年度账户"],
              [leaveRequestCount, "本月请假", "申请单数量"],
            ].map(([value, label, note]) => (
              <article
                className="rounded-[18px] border border-border/75 bg-white p-5"
                key={String(label)}
              >
                <div className="text-2xl font-semibold">{value}</div>
                <div className="mt-2 text-xs font-medium">{label}</div>
                <div className="mt-1 text-[9px] text-muted-foreground">{note}</div>
              </article>
            ))}
          </section>
        ) : (
          <div className="mt-5 rounded-[18px] border border-border bg-white px-5 py-4 text-xs text-muted-foreground">
            当前为员工自助视图。你可以发起请假、查看制度与培训资料；组织经营指标仅向人事和管理层开放。
          </div>
        )}

        <div className="mt-7 space-y-7">
          {moduleGroups.map((group) => (
            <section key={group.title}>
              <h2 className="text-sm font-semibold">{group.title}</h2>
              <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {group.modules.map((module) => {
                  const Icon = module.icon;
                  return (
                    <Link
                      className="group rounded-[20px] border border-border/75 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_14px_35px_-28px_rgba(16,62,53,.55)]"
                      href={module.href}
                      key={module.title}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="grid size-10 place-items-center rounded-xl bg-[#eaf3f8] text-primary">
                          <Icon className="size-5" />
                        </span>
                        <span
                          className={`rounded-full px-2 py-1 text-[9px] ${
                            module.status.includes("规划")
                              ? "bg-[#f3f6f5] text-muted-foreground"
                              : "bg-[#eef6f2] text-primary"
                          }`}
                        >
                          {module.status}
                        </span>
                      </div>
                      <div className="mt-4 text-[9px] font-medium tracking-[0.12em] text-primary/55">
                        {module.english}
                      </div>
                      <h3 className="mt-1 text-sm font-semibold">{module.title}</h3>
                      <p className="mt-2 min-h-10 text-[10px] leading-5 text-muted-foreground">
                        {module.description}
                      </p>
                      <div className="mt-4 flex items-center gap-1 text-[10px] font-medium text-primary">
                        进入模块
                        <ChevronRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {canViewManagement && (
          <section
            className="mt-7 grid gap-5 xl:grid-cols-[1.2fr_.8fr]"
            id="analytics"
          >
            <article className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-5 text-primary" />
                <div>
                  <h2 className="text-base font-semibold">部门人数结构</h2>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    当前在职员工口径
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {departmentCounts.map((item) => (
                  <div
                    className="grid grid-cols-[90px_1fr_28px] items-center gap-3 text-[10px]"
                    key={item.name}
                  >
                    <span className="truncate text-muted-foreground">
                      {item.name}
                    </span>
                    <div className="h-2 overflow-hidden rounded-full bg-[#eaf0f4]">
                      <div
                        className="h-full rounded-full bg-[#4f9a82]"
                        style={{
                          width: `${(item.count / maxDepartmentCount) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-right font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </article>
            <article className="rounded-[20px] border border-border/75 bg-[#eef4f8] p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <BookOpenCheck className="size-5 text-primary" />
                <h2 className="text-base font-semibold">组织基础完整度</h2>
              </div>
              <dl className="mt-5 grid grid-cols-2 gap-3">
                {[
                  [departments.length, "有效部门"],
                  [positionCount, "已配置岗位"],
                  [levelCount, "已配置职级"],
                  [activeEmployees.length, "在职员工"],
                ].map(([value, label]) => (
                  <div className="rounded-xl bg-white p-4" key={String(label)}>
                    <dt className="text-[9px] text-muted-foreground">{label}</dt>
                    <dd className="mt-1 text-lg font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </section>
        )}
      </main>
    </WorkflowShell>
  );
}
