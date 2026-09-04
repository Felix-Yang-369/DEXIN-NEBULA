import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, CircleHelp, Search } from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";

const navigationWidths = [72, 88, 64, 92, 76, 84, 68];

export function PlatformRouteStateShell({
  children,
  loadingLabel,
}: {
  children: ReactNode;
  loadingLabel?: string;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      {loadingLabel ? (
        <div className="pointer-events-none fixed inset-x-0 top-24 z-50 flex justify-center lg:left-[var(--sidebar-width,252px)]">
          <div
            aria-label={`正在加载${loadingLabel}`}
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-full border border-border bg-white/95 px-4 py-2.5 text-xs font-medium text-foreground  backdrop-blur"
            role="status"
          >
            <span
              aria-hidden="true"
              className="size-5 animate-spin rounded-full border-2 border-border border-r-warning border-t-primary motion-reduce:animate-none"
            />
            <span>正在加载{loadingLabel}</span>
          </div>
        </div>
      ) : null}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col border-r border-white/10 bg-sidebar px-3.5 py-4 text-white lg:flex">
        <div className="border-b border-white/[0.08] px-2.5 pb-5 pt-1">
          <NebulaLogo inverse />
        </div>
        <div className="mt-5 space-y-4 px-2" aria-hidden="true">
          {navigationWidths.map((width, index) => (
            <div className="space-y-2" key={`${width}-${index}`}>
              {index === 0 || index === 3 ? (
                <div className="h-2 w-16 rounded bg-white/10" />
              ) : null}
              <div
                className={`h-10 rounded-md ${index === 3 ? "bg-white/10" : "bg-white/[0.035]"}`}
                style={{ width: `${width}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-auto h-[62px] rounded-md border border-white/10 bg-white/[0.055]" />
      </aside>

      <div className="lg:pl-[var(--sidebar-width,252px)]">
        <header className="flex h-[72px] items-center border-b border-border/80 bg-white/88 px-4 sm:px-6 xl:px-8">
          <div className="lg:hidden">
            <NebulaLogo compact />
          </div>
          <div className="ml-3 hidden h-3 w-52 rounded bg-slate-200/80 md:block lg:ml-0" />
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden h-9 w-52 rounded-md border border-border bg-muted md:block xl:w-64" />
            <Link
              aria-label="返回工作台"
              className="grid size-9 place-items-center rounded-md border border-border bg-white text-muted-foreground"
              href="/dashboard"
            >
              <ArrowLeft className="size-4" />
            </Link>
            <span className="hidden size-9 place-items-center rounded-md border border-border bg-white text-muted-foreground sm:grid">
              <Search className="size-4 md:hidden" />
              <CircleHelp className="hidden size-4 md:block" />
            </span>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
