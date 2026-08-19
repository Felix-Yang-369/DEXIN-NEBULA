import { NebulaLogo } from "@/components/brand/nebula-logo";
import { PlatformNavigationList } from "@/components/navigation/platform-navigation-list";
import {
  navigationGroupsForRoles,
  splitNavigationGroups,
} from "@/config/platform-navigation";

export function Sidebar({
  pendingCount,
  roleCodes,
}: {
  pendingCount: number;
  roleCodes: string[];
}) {
  const groups = navigationGroupsForRoles(roleCodes).map((group) => ({
    ...group,
    items: group.items.map((item) =>
      item.href === "/approvals" && pendingCount > 0
        ? { ...item, countBadge: pendingCount }
        : item,
    ),
  }));
  const { mainGroups, bottomGroups } = splitNavigationGroups(groups);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[252px] flex-col overflow-hidden border-r border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(24,175,179,.26),transparent_29%),linear-gradient(180deg,#0a2b4b_0%,#0a2340_58%,#06182c_100%)] px-3.5 py-4 text-white shadow-[12px_0_36px_rgba(6,24,44,.12)] lg:flex">
      <div className="border-b border-white/[0.08] px-2.5 pb-5 pt-1">
        <NebulaLogo inverse />
      </div>

      <nav className="mt-4 min-h-0 flex-1 overflow-y-auto pb-3">
        <PlatformNavigationList
          activeItem="驾驶舱"
          breadcrumb="经营决策 / 经营概览"
          groups={mainGroups}
        />
      </nav>

      {bottomGroups.length ? (
        <nav className="shrink-0 border-t border-white/10 pt-3">
          <PlatformNavigationList
            activeItem="驾驶舱"
            breadcrumb="经营决策 / 经营概览"
            groups={bottomGroups}
          />
        </nav>
      ) : null}
    </aside>
  );
}
