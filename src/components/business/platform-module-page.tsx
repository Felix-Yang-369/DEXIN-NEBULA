import Link from "next/link";
import { ArrowUpRight, Boxes, CircleDashed } from "lucide-react";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import type { CurrentEmployee } from "@/features/auth/current-employee";

export function PlatformModulePage({
  employee,
  activeItem,
  breadcrumb,
  eyebrow,
  title,
  description,
  stage,
  capabilities,
  relatedLinks,
}: {
  employee: CurrentEmployee;
  activeItem: string;
  breadcrumb: string;
  eyebrow: string;
  title: string;
  description: string;
  stage: string;
  capabilities: Array<{ id?: string; title: string; description: string }>;
  relatedLinks: Array<{ label: string; href: string }>;
}) {
  return (
    <WorkflowShell
      activeItem={activeItem}
      breadcrumb={breadcrumb}
      currentUser={{
        name: employee.name,
        roleLabel: employee.title ?? "内部员工",
      }}
    >
      <main className="mx-auto max-w-[1200px] p-4 sm:p-6 xl:p-8">
        <section className="relative overflow-hidden rounded-[24px] bg-[#0a385d] px-6 py-8 text-white sm:px-8">
          <Boxes className="absolute right-12 top-1/2 hidden size-40 -translate-y-1/2 text-white/[0.05] sm:block" />
          <div className="relative">
            <div className="text-[10px] tracking-[0.15em] text-[#79d8d5]">
              {eyebrow}
            </div>
            <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h1 className="text-2xl font-semibold">{title}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-white/55">
                  {description}
                </p>
              </div>
              <span className="self-start rounded-full bg-white/10 px-3 py-2 text-[10px] sm:self-auto">
                {stage}
              </span>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2">
          {capabilities.map((capability, index) => (
            <article
              className="scroll-mt-24 rounded-[20px] border border-border/75 bg-white p-5"
              id={capability.id}
              key={capability.title}
            >
              <div className="flex items-start gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-[#eaf3f8] text-[10px] font-semibold text-primary">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2 className="text-sm font-semibold">{capability.title}</h2>
                  <p className="mt-2 text-[10px] leading-5 text-muted-foreground">
                    {capability.description}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </section>

        <section className="mt-5 rounded-[20px] border border-border bg-[#eef4f8] p-5">
          <div className="flex items-start gap-3">
            <CircleDashed className="mt-0.5 size-5 text-primary" />
            <div>
              <h2 className="text-sm font-semibold">当前边界</h2>
              <p className="mt-2 text-[10px] leading-5 text-[#5c7587]">
                该模块已纳入德馨星云一级架构；尚未接入的数据不展示虚构统计，后续按真实业务流程逐步开发。
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {relatedLinks.map((link) => (
                  <Link
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-white px-3 text-[10px] font-medium text-primary"
                    href={link.href}
                    key={link.href}
                  >
                    {link.label}
                    <ArrowUpRight className="size-3" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </WorkflowShell>
  );
}
