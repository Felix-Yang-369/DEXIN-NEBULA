import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { NebulaLogo } from "@/components/brand/nebula-logo";
import {
  SidebarIcon,
} from "@/components/icons/sidebar-icons";
import { platformNavigationGroups } from "@/config/platform-navigation";

export function Sidebar({ pendingCount }: { pendingCount: number }) {
  const navGroups = platformNavigationGroups.map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.href === "/oa" && pendingCount > 0
        ? { ...item, countBadge: pendingCount }
        : item,
    ),
  }));

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(24,175,179,.26),transparent_29%),linear-gradient(180deg,#0a2b4b_0%,#0a2340_58%,#06182c_100%)] px-3.5 py-4 text-white shadow-[12px_0_36px_rgba(6,24,44,.12)] lg:flex">
      <div className="border-b border-white/[0.08] px-2.5 pb-5 pt-1">
        <NebulaLogo inverse />
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto pb-4">
        {navGroups.map((group) => (
          <div className="mb-4" key={group.label}>
            <div className="mb-1.5 flex items-center justify-between px-3 text-[9px] font-semibold tracking-[0.16em] text-[#79d8d5]/48">
              <span>{group.label}</span>
              {group.english ? (
                <span className="text-[7px] tracking-[0.12em] text-white/18">
                  {group.english}
                </span>
              ) : null}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = item.href === "/dashboard";
                if (item.children?.length) {
                  return (
                    <details className="group/nav" key={item.href}>
                      <summary className="flex h-10 cursor-pointer list-none items-center gap-3 rounded-[13px] px-3 text-[13px] text-white/58 transition hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white [&::-webkit-details-marker]:hidden">
                        <span className="grid size-7 place-items-center rounded-[9px] bg-white/[0.055] text-white/64">
                          <SidebarIcon name={item.icon} />
                        </span>
                        <span>{item.label}</span>
                        {typeof item.countBadge === "number" && (
                          <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[9px] tabular-nums text-white/48">
                            {item.countBadge}
                          </span>
                        )}
                        {item.badge ? (
                          <span className="ml-auto rounded-full bg-[#e1a72d]/18 px-2 py-0.5 text-[8px] font-semibold text-[#f0c66b]">
                            {item.badge}
                          </span>
                        ) : null}
                        <ChevronDown
                          className={`size-3.5 text-white/35 transition-transform group-open/nav:rotate-180 ${
                            typeof item.countBadge === "number" || item.badge ? "" : "ml-auto"
                          }`}
                        />
                      </summary>
                      <div className="ml-6 mt-1 space-y-0.5 border-l border-white/10 pb-1 pl-3">
                        {item.children.map((child) => (
                          <Link
                            className="block rounded-lg px-3 py-2 text-[11px] text-white/40 transition hover:bg-white/[0.055] hover:text-white/75"
                            href={child.href}
                            key={`${item.label}-${child.label}`}
                          >
                            {child.label}
                          </Link>
                        ))}
                      </div>
                    </details>
                  );
                }
                return (
                  <Link
                    className={`group relative flex h-10 items-center gap-3 overflow-hidden rounded-[13px] px-3 text-[13px] transition-all duration-200 ${
                      active
                        ? "bg-[linear-gradient(90deg,rgba(24,175,179,.22),rgba(255,255,255,.08))] text-white shadow-[inset_0_0_0_1px_rgba(107,215,212,.16),0_8px_20px_rgba(0,0,0,.1)]"
                        : "text-white/58 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                    }`}
                    href={item.href}
                    key={item.href}
                  >
                    {active && (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#e1a72d]" />
                    )}
                    <span
                      className={`grid size-7 place-items-center rounded-[9px] transition-all duration-200 ${
                        active
                          ? "bg-[#6bd7d4] text-[#071d34] shadow-[0_5px_14px_rgba(24,175,179,.22)]"
                          : "bg-white/[0.055] text-white/64 group-hover:bg-white/10 group-hover:text-white/90"
                      }`}
                    >
                      <SidebarIcon name={item.icon} />
                    </span>
                    <span>{item.label}</span>
                    {typeof item.countBadge === "number" && (
                      <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[9px] tabular-nums text-white/48">
                        {item.countBadge}
                      </span>
                    )}
                    {item.badge ? (
                      <span className="ml-auto rounded-full bg-[#e1a72d]/18 px-2 py-0.5 text-[8px] font-semibold text-[#f0c66b]">
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

    </aside>
  );
}
