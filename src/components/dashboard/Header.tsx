import Link from "next/link";
import { Bell, CircleHelp, Command, Search } from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import { EmployeeAvatar } from "@/components/business/employee-avatar";

export function Header({
  name,
  role,
  avatarUrl,
  unreadCount,
}: {
  name: string;
  role: string;
  avatarUrl: string | null;
  unreadCount: number;
}) {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center border-b border-[#dce6ed]/90 bg-white/84 px-4 shadow-[0_6px_24px_rgba(12,48,78,.045)] backdrop-blur-2xl sm:px-6 xl:px-8">
      <div className="lg:hidden">
        <NebulaLogo compact />
      </div>
      <div className="ml-3 hidden min-w-0 flex-1 md:block lg:ml-0">
        <div className="flex items-center gap-2.5 text-xs font-medium text-[#647789]">
          <span className="size-1.5 rounded-full bg-[#18afb3] shadow-[0_0_0_4px_rgba(24,175,179,.12)]" />
          德馨星云
          <span className="text-[#b4c1cb]">/</span>
          <span className="text-[#2b465e]">企业经营驾驶舱</span>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <Link
          aria-label="打开全局搜索"
          className="grid size-10 place-items-center rounded-xl border border-[#dce6ed] bg-white text-[#6b7d8d] md:hidden"
          href="/search"
        >
          <Search className="size-4" />
        </Link>
        <form action="/search" className="relative hidden md:block" method="get">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-3.5 -translate-y-1/2 text-[#8697a6]" />
          <input
            className="h-10 w-60 rounded-full border border-[#dce6ed] bg-[#f3f7fa]/90 pl-10 pr-12 text-xs outline-none transition-all placeholder:text-[#93a2af] focus:w-72 focus:border-[#18afb3]/35 focus:bg-white focus:shadow-[0_8px_24px_rgba(12,80,107,.07)] focus:ring-4 focus:ring-[#18afb3]/8 xl:w-72 xl:focus:w-80"
            name="q"
            placeholder="搜索员工、制度或功能"
            type="search"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 items-center gap-0.5 rounded-md border border-[#dce6ed] bg-white px-1.5 py-0.5 text-[8px] text-[#8697a6] xl:flex">
            <Command className="size-2.5" /> K
          </span>
        </form>
        <Link
          aria-label={`查看消息，${unreadCount} 条未读`}
          className="relative grid size-10 place-items-center rounded-full border border-[#dce6ed] bg-white text-[#647789] transition hover:bg-[#eef5f8] hover:text-[#0d6475]"
          href="/notifications"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#ef6b73]" />
          )}
        </Link>
        <Link
          aria-label="打开使用指南"
          className="grid size-10 place-items-center rounded-full border border-[#dce6ed] bg-white text-[#647789] transition hover:bg-[#eef5f8] hover:text-[#0d6475]"
          href="/help"
        >
          <CircleHelp className="size-4" />
        </Link>
        <Link
          aria-label="进入账号信息管理"
          className="group ml-1 hidden items-center gap-2.5 rounded-full border border-[#dce6ed] bg-white/90 py-1.5 pl-1.5 pr-4 shadow-[0_5px_18px_rgba(12,48,78,.055)] transition hover:border-[#18afb3]/35 hover:bg-[#f7fbfc] hover:shadow-[0_8px_24px_rgba(12,80,107,.09)] sm:flex"
          href="/account"
        >
          <EmployeeAvatar name={name} size="sm" src={avatarUrl} />
          <div>
            <div className="text-[11px] font-medium leading-4">{name}</div>
            <div className="text-[9px] text-[#8797a5]">{role}</div>
          </div>
        </Link>
        <form action="/auth/signout" method="post">
          <button
            className="hidden h-9 rounded-full px-3 text-[10px] text-[#748696] transition hover:bg-[#eef3f7] sm:block"
            type="submit"
          >
            退出
          </button>
        </form>
      </div>
    </header>
  );
}
