import { PlatformRouteStateShell } from "@/components/business/platform-route-state-shell";

function Skeleton({ className }: { className: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-slate-200/80 motion-reduce:animate-none ${className}`}
    />
  );
}

export default function CashDocumentsLoading() {
  return (
    <PlatformRouteStateShell loadingLabel="收付款单">
      <main
        aria-busy="true"
        aria-label="正在加载收付款单"
        className="mx-auto max-w-[1500px] p-4 sm:p-6 xl:p-8"
      >
        <span className="sr-only">正在加载收付款单，请稍候</span>
        <section className="min-h-[196px] overflow-hidden rounded-[26px] bg-[linear-gradient(135deg,#092c4b,#0b4964_62%,#087c78)] px-6 py-8 sm:px-8">
          <div className="h-3 w-24 animate-pulse rounded bg-white/15 motion-reduce:animate-none" />
          <div className="mt-5 h-2.5 w-44 animate-pulse rounded bg-[#73d8d5]/25 motion-reduce:animate-none" />
          <div className="mt-4 h-9 w-56 max-w-full animate-pulse rounded-xl bg-white/20 motion-reduce:animate-none" />
          <div className="mt-4 h-3 w-full max-w-2xl animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
          <div className="mt-2 h-3 w-3/5 max-w-lg animate-pulse rounded bg-white/10 motion-reduce:animate-none" />
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <article
              className="min-h-[104px] rounded-[20px] border border-border/70 bg-white p-4"
              key={item}
            >
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="size-4 rounded-full" />
              </div>
              <Skeleton className="mt-4 h-6 w-28" />
              <Skeleton className="mt-2 h-2.5 w-24" />
            </article>
          ))}
        </section>

        <div className="mt-5 flex h-11 w-[184px] rounded-xl bg-[#e9efef] p-1">
          <div className="h-9 w-1/2 animate-pulse rounded-lg bg-white/80 motion-reduce:animate-none" />
          <div className="h-9 w-1/2" />
        </div>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(380px,.6fr)]">
          <section className="min-h-[620px] overflow-hidden rounded-[22px] border border-border/70 bg-white">
            <div className="border-b border-border/70 px-5 py-5 sm:px-6">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="mt-2 h-2.5 w-56" />
            </div>
            <div className="space-y-3 p-4 sm:p-5">
              {[0, 1, 2].map((item) => (
                <article
                  className="min-h-[136px] rounded-[18px] border border-border/70 bg-[#fbfcfc] p-4"
                  key={item}
                >
                  <div className="flex justify-between gap-6">
                    <div className="flex-1">
                      <Skeleton className="h-3 w-36" />
                      <Skeleton className="mt-3 h-4 w-44" />
                      <Skeleton className="mt-3 h-2.5 w-60 max-w-full" />
                      <Skeleton className="mt-3 h-2.5 w-4/5" />
                    </div>
                    <div className="w-32">
                      <Skeleton className="ml-auto h-6 w-28" />
                      <Skeleton className="ml-auto mt-2 h-2.5 w-24" />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="min-h-[620px] rounded-[22px] border border-border/70 bg-white p-5 sm:p-6">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="mt-2 h-2.5 w-64 max-w-full" />
            <div className="mt-6 space-y-3">
              <Skeleton className="h-10 w-full" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-44 w-full rounded-2xl" />
              <Skeleton className="h-16 w-full" />
              <div className="grid grid-cols-2 gap-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </section>
        </div>
      </main>
    </PlatformRouteStateShell>
  );
}
