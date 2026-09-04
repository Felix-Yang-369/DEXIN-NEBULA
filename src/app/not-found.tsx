import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-svh place-items-center bg-[#f5f8fb] p-5">
      <section className="w-full max-w-lg rounded-[26px] border border-[#dce6ed] bg-white px-7 py-12 text-center shadow-[0_24px_70px_-54px_rgba(6,24,44,.7)]">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#eef4f8] text-[#0d6475]">
          <SearchX className="size-6" />
        </span>
        <div className="mt-5 text-[10px] font-semibold tracking-[0.16em] text-[#0d7580]">
          PAGE NOT FOUND
        </div>
        <h1 className="mt-3 text-xl font-semibold text-[#12324a]">
          没有找到这个页面
        </h1>
        <p className="mt-3 text-xs leading-6 text-[#687b8d]">
          链接可能已失效、业务记录已变更，或当前账号没有对应的可见路径。
        </p>
        <Link
          className="mx-auto mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0a385d] px-5 text-xs font-medium text-white"
          href="/dashboard"
        >
          <ArrowLeft className="size-4" /> 返回工作台
        </Link>
      </section>
    </main>
  );
}
