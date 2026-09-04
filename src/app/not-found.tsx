import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-muted p-5">
      <section className="w-full max-w-lg rounded-md border border-border bg-white px-7 py-12 text-center ">
        <span className="mx-auto grid size-14 place-items-center rounded-lg bg-muted text-foreground">
          <SearchX className="size-6" />
        </span>
        <div className="mt-5 text-xs font-semibold tracking-[0.16em] text-foreground">
          PAGE NOT FOUND
        </div>
        <h1 className="mt-3 text-xl font-semibold text-foreground">
          没有找到这个页面
        </h1>
        <p className="mt-3 text-xs leading-6 text-foreground">
          链接可能已失效、业务记录已变更，或当前账号没有对应的可见路径。
        </p>
        <Link
          className="mx-auto mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-xs font-medium text-white"
          href="/dashboard"
        >
          <ArrowLeft className="size-4" /> 返回工作台
        </Link>
      </section>
    </main>
  );
}
