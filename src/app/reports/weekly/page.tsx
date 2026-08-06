import type { Metadata } from "next";
import Link from "next/link";
import {
  BookOpenText,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Clock3,
  FilePenLine,
  NotebookPen,
  UsersRound,
} from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { requireCurrentEmployee } from "@/features/auth/current-employee";
import { WeeklyReportForm } from "@/features/reports/weekly-report-form";
import {
  defaultReportingWeek,
  formatDateTime,
  formatWeekRange,
  isValidReportingWeek,
  reportingWeekOptions,
} from "@/features/reports/weekly-report-utils";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "周报管理",
  description: "德馨淼盛员工周报提交、历史与团队查阅",
};

export const dynamic = "force-dynamic";

type WeeklyReportRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_title: string | null;
  department_name: string | null;
  week_start: string;
  week_end: string;
  completed_work: string;
  ongoing_work: string;
  blockers: string;
  next_week_plan: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  updated_at: string;
};

const reportSections = [
  ["completed_work", "本周完成工作"],
  ["ongoing_work", "当前推进事项"],
  ["blockers", "存在的问题"],
  ["next_week_plan", "下周工作计划"],
] as const;

function ReportDetails({ report }: { report: WeeklyReportRow }) {
  return (
    <details className="group rounded-[18px] border border-border/80 bg-white open:shadow-[0_14px_38px_-30px_rgba(23,57,50,.35)]">
      <summary className="flex cursor-pointer list-none items-center gap-4 p-4 sm:p-5">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-xl ${
            report.status === "submitted"
              ? "bg-[#eaf3f8] text-primary"
              : "bg-[#fff4e7] text-[#9a6321]"
          }`}
        >
          {report.status === "submitted" ? (
            <CheckCircle2 className="size-[17px]" />
          ) : (
            <Clock3 className="size-[17px]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-[#294b65]">
              {report.employee_name}
            </span>
            <span className="rounded-full bg-[#f1f5f3] px-2 py-1 text-[9px] text-muted-foreground">
              {report.department_name ?? "部门待设置"}
            </span>
            <span
              className={`rounded-full px-2 py-1 text-[9px] font-medium ${
                report.status === "submitted"
                  ? "bg-[#eaf3f8] text-[#0d6c78]"
                  : "bg-[#fff4e7] text-[#9a6321]"
              }`}
            >
              {report.status === "submitted" ? "已提交" : "草稿"}
            </span>
          </span>
          <span className="mt-1.5 block text-[10px] text-muted-foreground">
            {formatWeekRange(report.week_start)} ·{" "}
            {report.status === "submitted"
              ? `提交于 ${formatDateTime(report.submitted_at)}`
              : `保存于 ${formatDateTime(report.updated_at)}`}
          </span>
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-3 border-t border-border/75 bg-[#fbfcfc] p-4 sm:grid-cols-2 sm:p-5">
        {reportSections.map(([key, label]) => (
          <section className="rounded-xl border border-border/70 bg-white p-4" key={key}>
            <h3 className="text-[10px] font-semibold text-primary">{label}</h3>
            <p className="mt-2 whitespace-pre-wrap text-[11px] leading-6 text-[#52655f]">
              {report[key]}
            </p>
          </section>
        ))}
      </div>
    </details>
  );
}

export default async function WeeklyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    week?: string;
    view?: string;
    saved?: string;
  }>;
}) {
  const employee = await requireCurrentEmployee();
  const params = await searchParams;
  const selectedWeek = isValidReportingWeek(params.week)
    ? params.week
    : defaultReportingWeek();
  const canReviewTeam = employee.roleCodes.some((role) =>
    ["department_lead", "hr", "admin", "chairman"].includes(role),
  );
  const view = params.view === "team" && canReviewTeam ? "team" : "mine";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weekly_reports")
    .select(
      "id, employee_id, employee_name, employee_title, department_name, week_start, week_end, completed_work, ongoing_work, blockers, next_week_plan, status, submitted_at, updated_at",
    )
    .order("week_start", { ascending: false })
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .limit(100);

  const reports = (data ?? []) as WeeklyReportRow[];
  const myReports = reports.filter(
    (report) => report.employee_id === employee.id,
  );
  const selectedReport =
    myReports.find((report) => report.week_start === selectedWeek) ?? null;
  const teamReports = reports.filter(
    (report) =>
      report.employee_id !== employee.id &&
      report.status === "submitted" &&
      report.week_start === selectedWeek,
  );
  const submittedCount = teamReports.length;
  const weekOptions = reportingWeekOptions();

  return (
    <WorkflowShell
      activeItem="协同办公"
      breadcrumb="协同办公 / 周报管理"
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1600px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-7 text-white shadow-[0_18px_50px_-32px_rgba(12,47,41,.75)] sm:px-8 lg:px-10">
          <div className="absolute -right-20 -top-36 size-80 rounded-full border border-white/8" />
          <NotebookPen className="pointer-events-none absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.055] sm:block" />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div>
              <div className="text-xs font-medium tracking-[0.12em] text-[#79d8d5]">
                WEEKLY REPORT
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-[-0.035em] sm:text-[30px]">
                周报管理
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                用结果、进度、问题和下周计划完成每周复盘。草稿仅本人可见，提交后自动送达直属负责人。
              </p>
            </div>
            <Link
              className="inline-flex h-10 w-fit items-center gap-2 rounded-xl border border-white/14 bg-white/8 px-4 text-xs text-white/70 transition-colors hover:bg-white/12"
              href="/knowledge/weekly-report-and-quarterly-review"
            >
              <BookOpenText className="size-4 text-[#6bd7d4]" />
              查看周报制度
            </Link>
          </div>
        </section>

        <section className="mt-5 flex flex-col gap-3 rounded-[22px] border border-border/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex gap-2">
            <Link
              className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[10px] font-medium ${
                view === "mine"
                  ? "bg-primary text-white"
                  : "border border-border text-muted-foreground"
              }`}
              href={`/reports/weekly?week=${selectedWeek}`}
            >
              <FilePenLine className="size-3.5" />
              我的周报
            </Link>
            {canReviewTeam && (
              <Link
                className={`inline-flex h-9 items-center gap-2 rounded-xl px-3 text-[10px] font-medium ${
                  view === "team"
                    ? "bg-primary text-white"
                    : "border border-border text-muted-foreground"
                }`}
                href={`/reports/weekly?view=team&week=${selectedWeek}`}
              >
                <UsersRound className="size-3.5" />
                团队周报
              </Link>
            )}
          </div>
          <form className="flex items-center gap-2" method="get">
            {view === "team" && <input name="view" type="hidden" value="team" />}
            <CalendarRange className="size-4 text-muted-foreground" />
            <select
              aria-label="选择周报周期"
              className="h-9 rounded-xl border border-border bg-[#f3f7fa] px-3 text-[10px] outline-none focus:border-primary/35"
              defaultValue={selectedWeek}
              name="week"
            >
              {weekOptions.map((week) => (
                <option key={week} value={week}>
                  {formatWeekRange(week)}
                  {week === defaultReportingWeek() ? " · 建议填写" : ""}
                </option>
              ))}
            </select>
            <button
              className="h-9 rounded-xl border border-border bg-white px-3 text-[10px] font-medium text-muted-foreground hover:bg-muted"
              type="submit"
            >
              切换
            </button>
          </form>
        </section>

        {params.saved === "draft" && (
          <div className="mt-5 rounded-xl border border-[#d8e3ea] bg-[#edf2f7] px-4 py-3 text-xs text-[#42647a]">
            周报草稿已保存，仅你本人可以查看。
          </div>
        )}
        {params.saved === "submit" && (
          <div className="mt-5 rounded-xl border border-[#d8e8ee] bg-[#eef4f8] px-4 py-3 text-xs text-primary">
            周报已提交，直属负责人已经收到站内通知。
          </div>
        )}

        {error ? (
          <section className="mt-5 rounded-[22px] border border-[#ead8d8] bg-[#f8eeee] px-6 py-12 text-center text-[#965151]">
            <NotebookPen className="mx-auto size-7" />
            <h2 className="mt-4 text-sm font-semibold">暂时无法读取周报数据</h2>
            <p className="mt-2 text-xs text-[#965151]/75">
              请确认第十二个数据库迁移已经执行。
            </p>
          </section>
        ) : view === "mine" ? (
          <>
            <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 shadow-[0_10px_35px_-28px_rgba(23,57,50,.32)] sm:p-6">
              <div className="mb-5 flex flex-col gap-2 border-b border-border/75 pb-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.12em] text-primary">
                    REPORTING PERIOD
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[#294b65]">
                    {formatWeekRange(selectedWeek)} 周报
                  </h2>
                </div>
                <span
                  className={`w-fit rounded-full px-3 py-1.5 text-[9px] font-medium ${
                    selectedReport?.status === "submitted"
                      ? "bg-[#eaf3f8] text-[#0d6c78]"
                      : selectedReport?.status === "draft"
                        ? "bg-[#fff4e7] text-[#9a6321]"
                        : "bg-[#edf2f7] text-[#42647a]"
                  }`}
                >
                  {selectedReport?.status === "submitted"
                    ? "已提交"
                    : selectedReport?.status === "draft"
                      ? "草稿"
                      : "未填写"}
                </span>
              </div>
              <WeeklyReportForm report={selectedReport} weekStart={selectedWeek} />
            </section>

            <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-medium tracking-[0.12em] text-primary">
                    MY HISTORY
                  </div>
                  <h2 className="mt-2 text-base font-semibold text-[#294b65]">
                    我的周报记录
                  </h2>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  共 {myReports.length} 份
                </span>
              </div>
              <div className="mt-5 space-y-3">
                {myReports.length > 0 ? (
                  myReports.map((report) => (
                    <ReportDetails key={report.id} report={report} />
                  ))
                ) : (
                  <div className="rounded-[18px] bg-[#f3f7fa] px-6 py-10 text-center text-xs text-muted-foreground">
                    还没有周报记录，从上方完成第一份周报。
                  </div>
                )}
              </div>
            </section>
          </>
        ) : (
          <section className="mt-5 rounded-[22px] border border-border/80 bg-white p-5 sm:p-6">
            <div className="flex flex-col gap-3 border-b border-border/75 pb-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-[10px] font-medium tracking-[0.12em] text-primary">
                  TEAM REPORTS
                </div>
                <h2 className="mt-2 text-lg font-semibold tracking-[-0.02em] text-[#294b65]">
                  {formatWeekRange(selectedWeek)} 团队周报
                </h2>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  仅展示你有权查看且已经提交的周报，员工草稿不会出现在此处。
                </p>
              </div>
              <span className="w-fit rounded-full bg-[#eaf3f8] px-3 py-1.5 text-[9px] font-medium text-[#0d6c78]">
                已提交 {submittedCount} 份
              </span>
            </div>
            <div className="mt-5 space-y-3">
              {teamReports.length > 0 ? (
                teamReports.map((report) => (
                  <ReportDetails key={report.id} report={report} />
                ))
              ) : (
                <div className="rounded-[18px] bg-[#f3f7fa] px-6 py-12 text-center">
                  <UsersRound className="mx-auto size-6 text-muted-foreground/45" />
                  <h3 className="mt-3 text-sm font-semibold">本周期暂无团队周报</h3>
                  <p className="mt-2 text-[10px] text-muted-foreground">
                    员工提交后会自动显示在这里。
                  </p>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </WorkflowShell>
  );
}
