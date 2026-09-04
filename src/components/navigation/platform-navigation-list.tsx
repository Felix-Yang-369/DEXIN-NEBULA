import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SidebarIcon } from "@/components/icons/sidebar-icons";
import {
  isPlatformItemActive,
  type PlatformNavigationGroup,
} from "@/config/platform-navigation";

export function PlatformNavigationList({
  groups,
  activeItem,
  breadcrumb = "",
  compact = false,
  onNavigate,
}: {
  groups: PlatformNavigationGroup[];
  activeItem: string;
  breadcrumb?: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  return groups.map((group) => {
    return (
      <section className={compact ? "mb-3" : "mb-5"} key={group.label}>
        <div className={`mb-2 items-center gap-2 px-3 text-[9px] font-semibold tracking-[0.14em] text-[#79d8d5]/52 ${compact ? "hidden" : "flex"}`}>
          <span>{group.label}</span>
          <span className="ml-auto text-[7px] tracking-[0.12em] text-white/20">
            {group.english}
          </span>
        </div>

        <div className="space-y-1">
          {group.items.map((item) => {
            const active = isPlatformItemActive(item, activeItem);
            const hasChildren = Boolean(item.children?.length);

            return (
              <div className="group/compact relative" key={`${group.label}-${item.label}`}>
                <Link
                  aria-current={active ? "page" : undefined}
                  className={`group/item relative flex min-h-10 items-center overflow-hidden rounded-[13px] py-2 text-[13px] transition-all duration-200 ${
                    compact ? "justify-center px-1" : `gap-3 pl-3 ${hasChildren ? "pr-10" : "pr-3"}`
                  } ${
                    active
                      ? "bg-[linear-gradient(90deg,rgba(24,175,179,.22),rgba(255,255,255,.08))] text-white shadow-[inset_0_0_0_1px_rgba(107,215,212,.16),0_8px_20px_rgba(0,0,0,.1)]"
                      : "text-white/58 hover:translate-x-0.5 hover:bg-white/[0.07] hover:text-white"
                  }`}
                  href={item.href}
                  onClick={onNavigate}
                  title={compact ? item.label : undefined}
                >
                  {active ? (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#e1a72d]" />
                  ) : null}
                  <span
                    className={`grid size-7 shrink-0 place-items-center rounded-[9px] transition ${
                      active
                        ? "bg-[#6bd7d4] text-[#071d34] shadow-[0_5px_14px_rgba(24,175,179,.22)]"
                        : "bg-white/[0.055] text-white/64 group-hover/item:bg-white/10 group-hover/item:text-white/90"
                    }`}
                  >
                    <SidebarIcon name={item.icon} />
                  </span>
                  {!compact ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
                  {!compact && typeof item.countBadge === "number" && item.countBadge > 0 ? (
                    <span className="rounded-full bg-[#6bd7d4]/16 px-2 py-0.5 text-[9px] tabular-nums text-[#9be5e2]">
                      {item.countBadge}
                    </span>
                  ) : null}
                  {!compact && item.badge ? (
                    <span className="rounded-full bg-[#e1a72d]/18 px-2 py-0.5 text-[8px] font-semibold text-[#f0c66b]">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>

                {hasChildren && compact ? (
                  <div className="invisible absolute left-[calc(100%+8px)] top-0 z-50 w-52 translate-x-1 rounded-xl border border-white/10 bg-[#0a2b4b] p-2 opacity-0 shadow-2xl transition group-hover/compact:visible group-hover/compact:translate-x-0 group-hover/compact:opacity-100 group-focus-within/compact:visible group-focus-within/compact:translate-x-0 group-focus-within/compact:opacity-100">
                    <div className="px-2 pb-2 pt-1 text-[10px] font-semibold text-white/80">{item.label}</div>
                    {item.children?.map((child) => (
                      <Link
                        className="block rounded-lg px-2 py-2 text-[10px] text-white/55 hover:bg-white/10 hover:text-white"
                        href={child.href}
                        key={`${item.label}-${child.label}`}
                        onClick={onNavigate}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                ) : hasChildren ? (
                  <details className="group/nav" open={active}>
                    <summary
                      aria-label={`展开或收起${item.label}`}
                      className="absolute right-2 top-1 grid size-8 cursor-pointer list-none place-items-center rounded-lg text-white/35 transition hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden"
                    >
                      <ChevronDown className="size-3.5 transition-transform group-open/nav:rotate-180" />
                    </summary>
                    <div className="ml-6 mt-1 space-y-0.5 border-l border-white/10 pb-1 pl-3">
                      {item.children?.map((child) => {
                        const current = Boolean(
                          active &&
                            child.activeMatch &&
                            breadcrumb.includes(child.activeMatch),
                        );
                        return (
                          <Link
                            aria-current={current ? "page" : undefined}
                            className={`block rounded-lg px-3 py-2 text-[11px] leading-4 transition ${
                              current
                                ? "bg-white/[0.09] font-medium text-[#8ce2df]"
                                : "text-white/42 hover:bg-white/[0.055] hover:text-white/78"
                            }`}
                            href={child.href}
                            key={`${item.label}-${child.label}`}
                            onClick={onNavigate}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>
    );
  });
}
