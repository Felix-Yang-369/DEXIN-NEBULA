import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SidebarIcon } from "@/components/icons/sidebar-icons";
import {
  isPlatformItemActive,
  platformNavigationGroups,
} from "@/config/platform-navigation";

export function PlatformSidebarMenu({
  activeItem,
  breadcrumb,
}: {
  activeItem: string;
  breadcrumb: string;
}) {
  return (
    <nav className="mt-7 min-h-0 flex-1 overflow-y-auto pb-5">
      {platformNavigationGroups.map((group) => (
        <div className="mb-4" key={group.label}>
          <div className="mb-1.5 flex items-center justify-between px-3 text-[9px] font-semibold tracking-[0.16em] text-[#79b9c7]/42">
            <span>{group.label}</span>
            {group.english ? (
              <span className="text-[7px] tracking-[0.12em] text-white/18">
                {group.english}
              </span>
            ) : null}
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = isPlatformItemActive(item, activeItem);
              if (item.children?.length) {
                return (
                  <details className="group/nav" key={item.href} open={active}>
                    <summary
                      className={`relative flex h-10 cursor-pointer list-none items-center gap-3 rounded-[13px] px-3 text-[13px] transition [&::-webkit-details-marker]:hidden ${
                        active
                          ? "bg-white/12 text-white shadow-sm"
                          : "text-white/58 hover:bg-white/[0.07] hover:text-white"
                      }`}
                    >
                      {active ? (
                        <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#6bd7d4]" />
                      ) : null}
                      <span
                        className={`grid size-7 place-items-center rounded-[9px] ${
                          active
                            ? "bg-[#6bd7d4] text-[#0b3152]"
                            : "bg-white/[0.055] text-white/64"
                        }`}
                      >
                        <SidebarIcon name={item.icon} />
                      </span>
                      <span>{item.label}</span>
                      {item.badge ? (
                        <span className="ml-auto rounded-full bg-[#e1a72d]/18 px-2 py-0.5 text-[8px] font-semibold text-[#f0c66b]">
                          {item.badge}
                        </span>
                      ) : null}
                      <ChevronDown className={`${item.badge ? "" : "ml-auto"} size-3.5 text-white/35 transition-transform group-open/nav:rotate-180`} />
                    </summary>
                    <div className="ml-6 mt-1 space-y-0.5 border-l border-white/10 pb-1 pl-3">
                      {item.children.map((child) => {
                        const childActive =
                          active &&
                          Boolean(
                            child.activeMatch &&
                              breadcrumb.includes(child.activeMatch),
                          );
                        return (
                          <Link
                            className={`block rounded-lg px-3 py-2 text-[11px] transition ${
                              childActive
                                ? "bg-white/[0.09] font-medium text-[#b7ead7]"
                                : "text-white/40 hover:bg-white/[0.055] hover:text-white/75"
                            }`}
                            href={child.href}
                            key={`${item.label}-${child.label}`}
                          >
                            {child.label}
                          </Link>
                        );
                      })}
                    </div>
                  </details>
                );
              }

              return (
                <Link
                  className={`relative flex h-10 items-center gap-3 rounded-[13px] px-3 text-[13px] transition ${
                    active
                      ? "bg-white/12 text-white shadow-sm"
                      : "text-white/58 hover:bg-white/[0.07] hover:text-white"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {active ? (
                    <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-[#6bd7d4]" />
                  ) : null}
                  <span
                    className={`grid size-7 place-items-center rounded-[9px] ${
                      active
                        ? "bg-[#6bd7d4] text-[#0b3152]"
                        : "bg-white/[0.055] text-white/64"
                    }`}
                  >
                    <SidebarIcon name={item.icon} />
                  </span>
                  <span>{item.label}</span>
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
  );
}
