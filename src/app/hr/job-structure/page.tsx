import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  Network,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import {
  saveJobLevelAction,
  savePositionAction,
} from "@/features/hr/server-actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "岗位与职级配置",
  description: "德馨星云岗位、职级、编制和岗位职责配置",
};

export const dynamic = "force-dynamic";

type Department = { id: string; name: string; code: string };
type JobLevel = {
  id: string;
  code: string;
  name: string;
  rank: number;
  description: string | null;
};
type Position = {
  id: string;
  code: string;
  name: string;
  headcount: number | null;
  department: { name: string } | Array<{ name: string }> | null;
  default_level:
    | { code: string; name: string }
    | Array<{ code: string; name: string }>
    | null;
};

function relationOne<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function feedbackMessage(feedback: Record<string, string | undefined>) {
  if (feedback.levelSaved) return "职级已创建。";
  if (feedback.positionSaved) return "岗位已创建。";
  const errors: Record<string, string> = {
    forbidden: "当前账号没有维护组织主数据的权限。",
    invalid_level: "职级代码、名称或排序不正确。",
    duplicate_level: "职级代码或排序已经存在。",
    invalid_position: "岗位代码、名称、部门或编制不正确。",
    duplicate_position: "岗位代码已经存在。",
    failed: "操作未完成，请刷新后重试。",
  };
  return feedback.error ? errors[feedback.error] ?? errors.failed : "";
}

export default async function HrJobStructurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const feedback = await searchParams;
  const employee = await requireCurrentEmployee();
  const canManage = employee.roleCodes.some((role) =>
    ["hr", "admin"].includes(role),
  );
  const supabase = await createClient();
  const [organizationResult, departmentResult, levelResult, positionResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name, slug")
        .eq("id", employee.organizationId)
        .single(),
      supabase
        .from("departments")
        .select("id, name, code")
        .eq("status", "active")
        .order("name"),
      supabase
        .from("job_levels")
        .select("id, code, name, rank, description")
        .eq("status", "active")
        .order("rank"),
      supabase
        .from("positions")
        .select(
          "id, code, name, headcount, department:departments(name), default_level:job_levels!positions_default_job_level_id_fkey(code, name)",
        )
        .eq("status", "active")
        .order("name"),
    ]);

  const departments = (departmentResult.data ?? []) as Department[];
  const levels = (levelResult.data ?? []) as JobLevel[];
  const positions = (positionResult.data ?? []) as Position[];
  const message = feedbackMessage(feedback);

  return (
    <WorkflowShell
      activeItem="人力资源"
      breadcrumb="人力资源 / 组织架构 / 岗位与职级"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1400px] p-4 sm:p-6 xl:p-8">
        <Link
          className="inline-flex items-center gap-2 text-[11px] text-muted-foreground hover:text-primary"
          href="/hr"
        >
          <ArrowLeft className="size-4" />
          返回 HRM 总览
        </Link>

        <section className="mt-4 rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
          <div className="text-[10px] tracking-[0.15em] text-[#79d8d5]">
            HRM · ORGANIZATION
          </div>
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h1 className="mt-3 text-2xl font-semibold">岗位与职级配置</h1>
              <p className="mt-3 text-sm text-white/55">
                {organizationResult.data?.name ?? "当前组织"} · 岗位、职级、编制与岗位职责
              </p>
            </div>
            <Link
              className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-xs font-medium text-[#0b3a5d]"
              href="/organization"
            >
              查看可视化组织树
            </Link>
          </div>
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

        <section className="mt-5 grid gap-4 sm:grid-cols-3">
          {[
            [departments.length, "有效部门", Network],
            [positions.length, "已配置岗位", BriefcaseBusiness],
            [levels.length, "已配置职级", BadgeCheck],
          ].map(([value, label, Icon]) => {
            const CardIcon = Icon as typeof Network;
            return (
              <article className="rounded-[18px] border border-border bg-white p-5" key={String(label)}>
                <CardIcon className="size-5 text-primary/60" />
                <div className="mt-3 text-2xl font-semibold">{String(value)}</div>
                <div className="mt-1 text-[10px] text-muted-foreground">{String(label)}</div>
              </article>
            );
          })}
        </section>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-2">
          <section className="rounded-[20px] border border-border bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">职级体系</h2>
              <span className="text-[9px] text-muted-foreground">如 P1 / P2 / P3</span>
            </div>
            <div className="mt-4 space-y-2">
              {levels.map((level) => (
                <div className="flex items-center justify-between rounded-xl bg-[#f8fafc] p-3" key={level.id}>
                  <div>
                    <span className="text-xs font-semibold">{level.code}</span>
                    <span className="ml-2 text-[10px]">{level.name}</span>
                  </div>
                  <span className="text-[9px] text-muted-foreground">序列 {level.rank}</span>
                </div>
              ))}
              {!levels.length && <div className="rounded-xl bg-[#fff9ef] p-4 text-[10px] text-[#8a6633]">尚未配置职级，不自动创建未经确认的等级定义。</div>}
            </div>
            {canManage && (
              <form action={saveJobLevelAction} className="mt-4 grid gap-3 sm:grid-cols-3">
                <input className="h-10 rounded-xl border border-border px-3 text-xs" name="code" placeholder="代码，如 P1" required />
                <input className="h-10 rounded-xl border border-border px-3 text-xs" name="name" placeholder="职级名称" required />
                <input className="h-10 rounded-xl border border-border px-3 text-xs" min="1" name="rank" placeholder="排序" required type="number" />
                <input className="h-10 rounded-xl border border-border px-3 text-xs sm:col-span-2" name="description" placeholder="职级说明（选填）" />
                <button className="h-10 rounded-xl bg-primary text-xs text-primary-foreground" type="submit">新增职级</button>
              </form>
            )}
          </section>

          <section className="rounded-[20px] border border-border bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">岗位管理</h2>
              <Link className="text-[10px] text-primary" href="/organization">查看组织架构图</Link>
            </div>
            <div className="mt-4 space-y-2">
              {positions.map((position) => (
                <div className="rounded-xl bg-[#f8fafc] p-3" key={position.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{position.name}</span>
                    <span className="font-mono text-[9px] text-muted-foreground">{position.code}</span>
                  </div>
                  <div className="mt-1 text-[9px] text-muted-foreground">
                    {relationOne(position.department)?.name ?? "未分部门"} ·{" "}
                    {relationOne(position.default_level)?.code ?? "未设职级"} ·{" "}
                    编制 {position.headcount ?? "待定"}
                  </div>
                </div>
              ))}
              {!positions.length && <div className="rounded-xl bg-[#fff9ef] p-4 text-[10px] text-[#8a6633]">尚未配置岗位。</div>}
            </div>
            {canManage && (
              <form action={savePositionAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input className="h-10 rounded-xl border border-border px-3 text-xs" name="code" placeholder="岗位代码" required />
                <input className="h-10 rounded-xl border border-border px-3 text-xs" name="name" placeholder="岗位名称" required />
                <select className="h-10 rounded-xl border border-border px-3 text-xs" name="departmentId">
                  <option value="">暂不分配部门</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
                <select className="h-10 rounded-xl border border-border px-3 text-xs" name="jobLevelId">
                  <option value="">暂不设置职级</option>
                  {levels.map((level) => (
                    <option key={level.id} value={level.id}>{level.code} · {level.name}</option>
                  ))}
                </select>
                <input className="h-10 rounded-xl border border-border px-3 text-xs" min="0" name="headcount" placeholder="岗位编制" type="number" />
                <input className="h-10 rounded-xl border border-border px-3 text-xs" name="responsibilities" placeholder="岗位职责摘要" />
                <button className="h-10 rounded-xl bg-primary text-xs text-primary-foreground sm:col-span-2" type="submit">新增岗位</button>
              </form>
            )}
          </section>
        </div>

        <section className="mt-5 rounded-[20px] border border-border bg-[#eef4f8] p-5">
          <div className="flex items-center gap-3">
            <Building2 className="size-5 text-primary" />
            <p className="text-[11px] leading-6 text-[#5c7587]">
              部门层级与汇报关系继续由现有组织架构维护；岗位和职级是新增主数据，后续会关联到员工任职和招聘需求。
            </p>
          </div>
        </section>
      </main>
    </WorkflowShell>
  );
}
