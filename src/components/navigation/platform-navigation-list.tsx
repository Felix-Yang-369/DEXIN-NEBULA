"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { SidebarIcon } from "@/components/icons/sidebar-icons";
import {
  ensureNavigationGroupOpen,
  getNavigationGroupMemory,
  setNavigationGroupOpen,
} from "@/components/navigation/navigation-group-state";
import {
  isPlatformItemActive,
  type PlatformNavigationGroup,
  type PlatformNavigationItem,
} from "@/config/platform-navigation";

function itemIsActive(item: PlatformNavigationItem, activeItem: string) {
  return isPlatformItemActive(item, activeItem);
}

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
  const router = useRouter();
  const [navigationGroupMemory] = useState(getNavigationGroupMemory);
  const activeGroup = useMemo(
    () =>
      groups.find((group) =>
        group.items.some((item) => itemIsActive(item, activeItem)),
      )?.label ?? groups[0]?.label,
    [activeItem, groups],
  );
  const groupLabels = useMemo(() => groups.map((group) => group.label), [groups]);
  const [navigationState, setNavigationState] = useState<{
    activeGroup: string | undefined;
    openGroups: ReadonlySet<string>;
  }>(() => ({
    activeGroup,
    openGroups: navigationGroupMemory.restore(groupLabels, activeGroup),
  }));
  const [compactOpenGroup, setCompactOpenGroup] = useState<string | null>(null);

  if (navigationState.activeGroup !== activeGroup) {
    setNavigationState({
      activeGroup,
      openGroups: ensureNavigationGroupOpen(navigationState.openGroups, activeGroup),
    });
  }

  const openGroups = navigationState.openGroups;

  useEffect(() => {
    if (!compact) {
      navigationGroupMemory.remember(groupLabels, openGroups);
    }
  }, [compact, groupLabels, navigationGroupMemory, openGroups]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCompactOpenGroup(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  const preload = (href: string) => router.prefetch(href);

  if (compact) {
    return (
      <div className="space-y-1.5">
        {groups.map((group) => {
          const groupActive = group.items.some((item) =>
            itemIsActive(item, activeItem),
          );
          const flyoutOpen = compactOpenGroup === group.label;
          const groupIcon = group.items[0]?.icon ?? "dashboard";

          return (
            <div
              className="group/rail relative"
              data-open={flyoutOpen}
              key={group.label}
              onMouseLeave={() => setCompactOpenGroup(null)}
            >
              <button
                aria-expanded={flyoutOpen}
                aria-haspopup="menu"
                aria-label={group.label}
                className={`relative grid size-10 w-full place-items-center rounded-md transition-colors ${
                  groupActive
                    ? "bg-white/12 text-white"
                    : "text-white/60 hover:bg-white/[0.08] hover:text-white"
                }`}
                onClick={() =>
                  setCompactOpenGroup((current) =>
                    current === group.label ? null : group.label,
                  )
                }
                title={group.label}
                type="button"
              >
                {groupActive ? (
                  <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                ) : null}
                <SidebarIcon className="size-4" name={groupIcon} />
              </button>

              <div
                className={`ui-overlay absolute left-[calc(100%+8px)] top-0 z-50 w-60 border-white/10 bg-sidebar p-2 transition duration-150 ${
                  flyoutOpen
                    ? "visible translate-x-0 opacity-100"
                    : "invisible translate-x-1 opacity-0 group-hover/rail:visible group-hover/rail:translate-x-0 group-hover/rail:opacity-100 group-focus-within/rail:visible group-focus-within/rail:translate-x-0 group-focus-within/rail:opacity-100"
                }`}
                role="menu"
              >
                <div className="flex items-center justify-between px-2 pb-2 pt-1 text-[13px] font-semibold text-white/80">
                  <span>{group.label}</span>
                  <ChevronRight className="size-3.5 text-white/30" />
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = itemIsActive(item, activeItem);
                    return (
                      <div key={`${group.label}-${item.label}`}>
                        <Link
                          aria-current={active ? "page" : undefined}
                          className={`flex min-h-9 items-center gap-2.5 rounded-md px-2 text-[13px] transition ${
                            active
                              ? "bg-white/10 text-white"
                              : "text-white/62 hover:bg-white/[0.07] hover:text-white"
                          }`}
                          href={item.href}
                          onClick={() => {
                            setCompactOpenGroup(null);
                            onNavigate?.();
                          }}
                          onFocus={() => preload(item.href)}
                          onMouseEnter={() => preload(item.href)}
                          prefetch={false}
                          role="menuitem"
                        >
                          <span className="grid size-6 shrink-0 place-items-center">
                            <SidebarIcon name={item.icon} />
                          </span>
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {item.countBadge ? (
                            <span className="text-xs tabular-nums text-white/45">
                              {item.countBadge}
                            </span>
                          ) : null}
                        </Link>
                        {item.children?.length ? (
                          <div className="ml-8 border-l border-white/10 pl-2">
                            {item.children.map((child) => (
                              <Link
                                className="block truncate rounded px-2 py-1.5 text-[13px] text-white/42 hover:bg-white/[0.06] hover:text-white/80"
                                href={child.href}
                                key={`${item.label}-${child.label}`}
                                onClick={() => {
                                  setCompactOpenGroup(null);
                                  onNavigate?.();
                                }}
                                onFocus={() => preload(child.href)}
                                onMouseEnter={() => preload(child.href)}
                                prefetch={false}
                                role="menuitem"
                              >
                                {child.label}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {groups.map((group) => {
        const groupActive = group.items.some((item) =>
          itemIsActive(item, activeItem),
        );
        const expanded = openGroups.has(group.label);

        return (
          <details
            className="group/sidebar-section"
            key={group.label}
            onToggle={(event) => {
              const open = event.currentTarget.open;
              setNavigationState((current) => {
                const nextOpenGroups = setNavigationGroupOpen(
                  current.openGroups,
                  group.label,
                  open,
                );

                if (nextOpenGroups === current.openGroups) return current;

                // Persist synchronously so a child-link navigation cannot remount
                // the shell before the effect has remembered the latest groups.
                navigationGroupMemory.remember(groupLabels, nextOpenGroups);
                return { ...current, openGroups: nextOpenGroups };
              });
            }}
            open={expanded}
          >
            <summary
              className={`flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-left text-[13px] font-semibold transition ${
                groupActive
                  ? "text-white"
                  : "text-white/45 hover:bg-white/[0.05] hover:text-white/75"
              } cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
            >
              <span className="min-w-0 flex-1 truncate">{group.label}</span>
              <ChevronDown className="size-3.5 transition-transform group-open/sidebar-section:rotate-180" />
            </summary>

            <div className="mt-1 space-y-0.5 pb-1">
                {group.items.map((item) => {
                  const active = itemIsActive(item, activeItem);
                  const hasChildren = Boolean(item.children?.length);

                  return (
                    <div className="relative" key={`${group.label}-${item.label}`}>
                      <Link
                        aria-current={active ? "page" : undefined}
                        className={`group/item relative flex h-9 items-center overflow-hidden rounded-md text-sm transition-colors gap-2.5 pl-2.5 ${
                          hasChildren ? "pr-9" : "pr-2.5"
                        } ${
                          active
                            ? "bg-white/10 text-white"
                            : "text-white/62 hover:bg-white/[0.07] hover:text-white"
                        }`}
                        href={item.href}
                        onClick={onNavigate}
                        onFocus={() => preload(item.href)}
                        onMouseEnter={() => preload(item.href)}
                        prefetch={false}
                      >
                        {active ? (
                          <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-sidebar-primary" />
                        ) : null}
                        <span className="grid size-6 shrink-0 place-items-center text-white/70 group-hover/item:text-white">
                          <SidebarIcon name={item.icon} />
                        </span>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {typeof item.countBadge === "number" && item.countBadge > 0 ? (
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs tabular-nums text-white/70">
                            {item.countBadge}
                          </span>
                        ) : null}
                        {item.badge ? (
                          <span className="rounded-full bg-white/10 px-1.5 py-0.5 text-xs text-white/70">
                            {item.badge}
                          </span>
                        ) : null}
                      </Link>

                      {hasChildren ? (
                        <details className="group/nav" open={active}>
                          <summary
                            aria-label={`展开或收起${item.label}`}
                            className="absolute right-1 top-0.5 grid size-8 cursor-pointer list-none place-items-center rounded-md text-white/35 transition hover:bg-white/10 hover:text-white [&::-webkit-details-marker]:hidden"
                          >
                            <ChevronDown className="size-3.5 transition-transform group-open/nav:rotate-180" />
                          </summary>
                          <div className="ml-5 mt-0.5 space-y-0.5 border-l border-white/10 pb-1 pl-3">
                            {item.children?.map((child) => {
                              const current = Boolean(
                                active &&
                                  child.activeMatch &&
                                  breadcrumb.includes(child.activeMatch),
                              );
                              return (
                                <Link
                                  aria-current={current ? "page" : undefined}
                                  className={`block min-h-8 rounded-md px-2.5 py-1.5 text-[13px] leading-5 transition ${
                                    current
                                      ? "bg-white/[0.09] font-medium text-white"
                                      : "text-white/42 hover:bg-white/[0.055] hover:text-white/78"
                                  }`}
                                  href={child.href}
                                  key={`${item.label}-${child.label}`}
                                  onClick={onNavigate}
                                  onFocus={() => preload(child.href)}
                                  onMouseEnter={() => preload(child.href)}
                                  prefetch={false}
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
          </details>
        );
      })}
    </div>
  );
}
