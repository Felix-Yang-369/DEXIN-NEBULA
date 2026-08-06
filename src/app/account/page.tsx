import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  KeyRound,
  Mail,
  ShieldCheck,
  Upload,
  UserRoundCog,
  UsersRound,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/business/employee-avatar";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { uploadOwnAvatarAction } from "@/features/employees/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "账号信息管理",
  description: "查看德馨星云个人账号、组织归属与访问角色",
};

export const dynamic = "force-dynamic";

type RelationName = { name: string } | Array<{ name: string }> | null;

type AccountEmployee = {
  employee_no: string;
  name: string;
  english_name: string | null;
  email: string;
  title: string | null;
  hired_on: string | null;
  employment_status: "active" | "probation" | "intern" | "part_time" | "departed";
  avatar_path: string | null;
  department: RelationName;
  manager: RelationName;
  organization: RelationName;
};

const roleLabels: Record<string, string> = {
  admin: "系统管理员",
  chairman: "董事长",
  finance: "财务",
  hr: "人事行政",
  department_lead: "部门负责人",
  employee: "普通员工",
};

const employmentLabels: Record<AccountEmployee["employment_status"], string> = {
  active: "在职",
  probation: "试用",
  intern: "实习",
  part_time: "兼职",
  departed: "已离职",
};

function relationOne(value: RelationName) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatDate(value: string | null) {
  if (!value) return "尚未录入";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(`${value}T00:00:00+08:00`));
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ avatarSaved?: string; error?: string }>;
}) {
  const currentEmployee = await requireCurrentEmployee();
  const feedback = await searchParams;
  const supabase = await createClient();
  const [{ data: profile }, { data: authResult }] = await Promise.all([
    supabase
      .from("employees")
      .select(
        "employee_no, name, english_name, email, title, hired_on, employment_status, avatar_path, department:departments!employees_department_id_fkey(name), manager:employees!employees_manager_id_fkey(name), organization:organizations!employees_organization_id_fkey(name)",
      )
      .eq("id", currentEmployee.id)
      .single(),
    supabase.auth.getUser(),
  ]);

  const employee = profile as AccountEmployee | null;
  const department = relationOne(employee?.department ?? null);
  const manager = relationOne(employee?.manager ?? null);
  const organization = relationOne(employee?.organization ?? null);
  const { data: signedAvatar } = employee?.avatar_path
    ? await supabase.storage
        .from("avatars")
        .createSignedUrl(employee.avatar_path, 3600)
    : { data: null };
  const roleNames = currentEmployee.roleCodes
    .map((code) => roleLabels[code] ?? code)
    .join(" · ");
  const lastSignedIn = authResult?.user?.last_sign_in_at
    ? new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date(authResult.user.last_sign_in_at))
    : "暂无记录";

  return (
    <WorkflowShell
      activeItem=""
      breadcrumb="个人中心 / 账号信息管理"
      currentUser={{
        name: currentEmployee.name,
        roleLabel: currentEmployee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1280px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[radial-gradient(circle_at_82%_18%,rgba(24,175,179,.26),transparent_27%),linear-gradient(135deg,#0a385d,#092947_68%,#061b31)] px-6 py-7 text-white shadow-[0_24px_60px_-38px_rgba(6,35,64,.8)] sm:px-8">
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex shrink-0 flex-col items-center gap-2.5">
              <EmployeeAvatar
                name={employee?.name ?? currentEmployee.name}
                size="lg"
                src={signedAvatar?.signedUrl}
              />
              <form action={uploadOwnAvatarAction} className="flex flex-col items-center gap-1.5">
                <label className="group flex cursor-pointer items-center gap-1.5 rounded-full border border-white/18 bg-white/8 px-3 py-1.5 text-[9px] text-white/72 transition hover:border-[#79d8d5]/40 hover:bg-white/12 hover:text-white">
                  <Upload className="size-3" />
                  选择头像
                  <input
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    name="avatar"
                    required
                    type="file"
                  />
                </label>
                <button className="text-[9px] text-[#8ce2df] underline decoration-[#8ce2df]/30 underline-offset-2 hover:text-white" type="submit">
                  确认上传
                </button>
              </form>
            </div>
            <div>
              <div className="text-[10px] font-medium tracking-[0.16em] text-[#79d8d5]">
                ACCOUNT · PROFILE & ACCESS
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
                {employee?.name ?? currentEmployee.name}
              </h1>
              <p className="mt-2 text-xs text-white/55">
                {employee?.employee_no ?? currentEmployee.employeeNo} · {employee?.title ?? "职位待完善"} · {department?.name ?? "部门待分配"}
              </p>
            </div>
            <span className="w-fit rounded-full border border-[#79d8d5]/25 bg-[#79d8d5]/10 px-3 py-1.5 text-[10px] text-[#a6e7e4] sm:ml-auto">
              账号状态正常
            </span>
          </div>
        </section>

        {feedback.avatarSaved && (
          <div className="mt-5 rounded-2xl border border-[#cfe8ec] bg-[#edf7f2] px-4 py-3 text-xs text-[#0d6c78]">
            头像已更新，顶部账号入口和侧边栏已同步。
          </div>
        )}
        {feedback.error && (
          <div className="mt-5 rounded-2xl border border-[#eed3cd] bg-[#fff4f1] px-4 py-3 text-xs text-[#985846]">
            {feedback.error === "invalid_avatar"
              ? "请选择 2MB 以内的 JPG、PNG 或 WebP 图片。"
              : "头像上传失败，请稍后重试。"}
          </div>
        )}

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_380px]">
          <div className="space-y-5">
            <section className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <UserRoundCog className="size-4 text-primary" />
                <h2 className="text-base font-semibold">个人与组织信息</h2>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  ["企业邮箱", employee?.email ?? currentEmployee.email, <Mail className="size-4" key="mail" />],
                  ["所属公司", organization?.name ?? "长沙德馨淼盛科技有限公司", <Building2 className="size-4" key="company" />],
                  ["所属部门", department?.name ?? "尚未分配", <UsersRound className="size-4" key="department" />],
                  ["职位", employee?.title ?? "尚未录入", <BriefcaseBusiness className="size-4" key="title" />],
                  ["直属负责人", manager?.name ?? "尚未设置", <BadgeCheck className="size-4" key="manager" />],
                  ["入职日期", formatDate(employee?.hired_on ?? null), <CalendarDays className="size-4" key="hired" />],
                ].map(([label, value, icon]) => (
                  <div className="rounded-2xl border border-border/70 bg-[#fbfdfc] p-4" key={String(label)}>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      {icon}
                      {label}
                    </div>
                    <div className="mt-2 break-all text-xs font-medium">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-2xl bg-[#f3f7fa] px-4 py-3 text-[10px] leading-5 text-muted-foreground">
                姓名、部门、职位和入职状态来自 HRM 员工主档。若信息有误，请联系行政人事统一修改，避免账号权限与组织关系不一致。
              </div>
            </section>

            <section className="rounded-[20px] border border-border/75 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                <h2 className="text-base font-semibold">角色与访问权限</h2>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {currentEmployee.roleCodes.map((code) => (
                  <span className="rounded-full border border-[#cfe2e8] bg-[#eaf3f8] px-3 py-1.5 text-[10px] font-medium text-[#0d6475]" key={code}>
                    {roleLabels[code] ?? code}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-[10px] leading-5 text-muted-foreground">
                当前权限：{roleNames || "尚未分配角色"}。角色与数据范围由系统管理员统一配置，个人不能自行提升权限。
              </p>
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-[20px] border border-border/75 bg-white p-5">
              <div className="flex items-center gap-2">
                <KeyRound className="size-4 text-primary" />
                <h2 className="text-sm font-semibold">登录与安全</h2>
              </div>
              <dl className="mt-4 space-y-4 text-[10px]">
                <div>
                  <dt className="text-muted-foreground">登录账号</dt>
                  <dd className="mt-1.5 break-all text-xs font-medium">{authResult?.user?.email ?? currentEmployee.email}</dd>
                </div>
                <div className="border-t border-border/70 pt-4">
                  <dt className="text-muted-foreground">最近登录</dt>
                  <dd className="mt-1.5 text-xs font-medium">{lastSignedIn}</dd>
                </div>
                <div className="border-t border-border/70 pt-4">
                  <dt className="text-muted-foreground">员工状态</dt>
                  <dd className="mt-1.5 text-xs font-medium">
                    {employee ? employmentLabels[employee.employment_status] : "在职"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="rounded-[20px] border border-border/75 bg-white p-5">
              <h2 className="text-sm font-semibold">账号操作</h2>
              <div className="mt-4 grid gap-2">
                <Link className="flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-[10px] font-medium text-primary-foreground" href={`/employees/${currentEmployee.id}`}>
                  查看我的完整员工档案
                </Link>
                <Link className="flex h-10 items-center justify-center rounded-xl border border-border bg-white px-4 text-[10px] font-medium text-muted-foreground hover:bg-muted" href="/help">
                  获取账号使用帮助
                </Link>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </WorkflowShell>
  );
}
