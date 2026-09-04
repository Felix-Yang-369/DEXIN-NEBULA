import { PlatformRouteStateShell } from "@/components/business/platform-route-state-shell";

export type PlatformSkeletonVariant =
  | "dashboard"
  | "list"
  | "detail"
  | "form"
  | "chat";

const metricItems = [0, 1, 2, 3];
const listItems = [0, 1, 2, 3, 4, 5];

function Bone({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-200/80 motion-reduce:animate-none ${className}`}
    />
  );
}

function HeroSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <section
      className={`${compact ? "min-h-[166px]" : "min-h-[190px]"} overflow-hidden rounded-md bg-card px-6 py-7 sm:px-8 lg:px-10`}
    >
      <div className="h-2.5 w-44 animate-pulse rounded bg-muted motion-reduce:animate-none" />
      <div className="mt-4 h-8 w-64 max-w-full animate-pulse rounded-md bg-white/20 motion-reduce:animate-none" />
      <div className="mt-4 h-3 w-full max-w-2xl animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
      <div className="mt-2 h-3 w-3/5 max-w-lg animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
    </section>
  );
}

function MetricsSkeleton() {
  return (
    <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {metricItems.map((item) => (
        <article
          className="min-h-[108px] rounded-md border border-border/70 bg-white p-4"
          key={item}
        >
          <div className="flex justify-between">
            <Bone className="h-3 w-20" />
            <Bone className="size-4 rounded-full" />
          </div>
          <Bone className="mt-4 h-6 w-28" />
          <Bone className="mt-2 h-2.5 w-24" />
        </article>
      ))}
    </section>
  );
}

function ListSkeleton() {
  return (
    <section className="mt-5 min-h-[560px] overflow-hidden rounded-md border border-border/70 bg-white">
      <div className="flex min-h-[74px] items-center justify-between gap-4 border-b border-border/70 px-5 sm:px-6">
        <div>
          <Bone className="h-5 w-32" />
          <Bone className="mt-2 h-2.5 w-56" />
        </div>
        <Bone className="h-10 w-32" />
      </div>
      <div className="border-b border-border/70 bg-muted p-4 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_120px]">
          <Bone className="h-10 w-full" />
          <Bone className="h-10 w-full" />
          <Bone className="h-10 w-full" />
        </div>
      </div>
      <div className="divide-y divide-border/60 px-4 sm:px-6">
        {listItems.map((item) => (
          <div className="flex min-h-[72px] items-center gap-4 py-3" key={item}>
            <Bone className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <Bone className="h-3.5 w-40 max-w-2/3" />
              <Bone className="mt-2 h-2.5 w-64 max-w-full" />
            </div>
            <Bone className="hidden h-3 w-24 sm:block" />
            <Bone className="h-7 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <>
      <MetricsSkeleton />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
        <section className="min-h-[430px] rounded-md border border-border/70 bg-white p-5 sm:p-6">
          <Bone className="h-5 w-32" />
          <Bone className="mt-2 h-2.5 w-56" />
          <div className="mt-6 flex h-[290px] items-end gap-3 rounded-lg bg-muted p-5">
            {[42, 68, 54, 80, 62, 88, 72].map((height, index) => (
              <div
                className="flex-1 animate-pulse rounded-t-lg bg-muted motion-reduce:animate-none"
                key={`${height}-${index}`}
                style={{ height: `${height}%` }}
              />
            ))}
          </div>
        </section>
        <section className="min-h-[430px] rounded-md border border-border/70 bg-white p-5 sm:p-6">
          <Bone className="h-5 w-28" />
          <div className="mt-5 space-y-4">
            {metricItems.map((item) => (
              <div className="flex items-center gap-3" key={item}>
                <Bone className="size-10 shrink-0 rounded-md" />
                <div className="flex-1">
                  <Bone className="h-3 w-28" />
                  <Bone className="mt-2 h-2.5 w-full" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.25fr)_380px]">
      <div className="space-y-5">
        {[0, 1].map((section) => (
          <section
            className="min-h-[260px] rounded-md border border-border/70 bg-white p-5 sm:p-6"
            key={section}
          >
            <Bone className="h-5 w-28" />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {metricItems.map((item) => (
                <div className="rounded-md bg-muted p-3" key={item}>
                  <Bone className="h-2.5 w-14" />
                  <Bone className="mt-3 h-3.5 w-24" />
                </div>
              ))}
            </div>
            <Bone className="mt-5 h-20 w-full" />
          </section>
        ))}
      </div>
      <section className="min-h-[545px] rounded-md border border-border/70 bg-white p-5 sm:p-6">
        <Bone className="h-5 w-24" />
        <div className="mt-5 space-y-3">
          {listItems.slice(0, 5).map((item) => (
            <Bone className="h-14 w-full" key={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

function FormSkeleton() {
  return (
    <section className="mt-5 min-h-[600px] rounded-md border border-border/70 bg-white p-5 sm:p-7">
      <Bone className="h-5 w-36" />
      <Bone className="mt-2 h-2.5 w-72 max-w-full" />
      <div className="mt-7 grid gap-4 sm:grid-cols-2">
        {listItems.map((item) => (
          <div key={item}>
            <Bone className="h-2.5 w-20" />
            <Bone className="mt-2 h-11 w-full" />
          </div>
        ))}
      </div>
      <Bone className="mt-5 h-28 w-full" />
      <div className="mt-6 flex justify-end gap-3">
        <Bone className="h-10 w-24" />
        <Bone className="h-10 w-28" />
      </div>
    </section>
  );
}

function ChatSkeleton() {
  return (
    <div className="grid min-h-[calc(100svh-72px)] md:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="hidden border-r border-border/70 bg-white p-4 md:block">
        <Bone className="h-10 w-full" />
        <div className="mt-5 space-y-3">
          {listItems.map((item) => <Bone className="h-14 w-full" key={item} />)}
        </div>
      </aside>
      <main className="flex min-h-[640px] flex-col bg-muted p-4 sm:p-6">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-end gap-5">
          <Bone className="h-20 w-3/5" />
          <Bone className="ml-auto h-16 w-2/5" />
          <Bone className="h-28 w-4/5" />
          <Bone className="mt-auto h-14 w-full rounded-lg" />
        </div>
      </main>
    </div>
  );
}

export function PlatformPageSkeleton({
  variant = "list",
  label = "页面内容",
}: {
  variant?: PlatformSkeletonVariant;
  label?: string;
}) {
  return (
    <PlatformRouteStateShell loadingLabel={label}>
      {variant === "chat" ? (
        <div aria-busy="true" aria-label={`正在加载${label}`}>
          <span className="sr-only">正在加载{label}，请稍候</span>
          <ChatSkeleton />
        </div>
      ) : (
        <main
          aria-busy="true"
          aria-label={`正在加载${label}`}
          className="mx-auto max-w-[1440px] p-4 sm:p-6 xl:p-8"
        >
          <span className="sr-only">正在加载{label}，请稍候</span>
          <HeroSkeleton compact={variant === "form"} />
          {variant === "dashboard" ? <DashboardSkeleton /> : null}
          {variant === "list" ? <><MetricsSkeleton /><ListSkeleton /></> : null}
          {variant === "detail" ? <DetailSkeleton /> : null}
          {variant === "form" ? <FormSkeleton /> : null}
        </main>
      )}
    </PlatformRouteStateShell>
  );
}
