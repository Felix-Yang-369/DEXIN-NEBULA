import { PlatformNavigationList } from "@/components/navigation/platform-navigation-list";
import {
  navigationGroupsForRoles,
  splitNavigationGroups,
} from "@/config/platform-navigation";
import { getCurrentEmployee } from "@/features/auth/current-employee";

export async function PlatformSidebarMenu({
  activeItem,
  breadcrumb,
}: {
  activeItem: string;
  breadcrumb: string;
}) {
  const employee = await getCurrentEmployee();
  const groups = navigationGroupsForRoles(employee?.roleCodes ?? []);
  const { mainGroups, bottomGroups } = splitNavigationGroups(groups);

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      <nav className="min-h-0 flex-1 overflow-y-auto pb-3">
        <PlatformNavigationList
          activeItem={activeItem}
          breadcrumb={breadcrumb}
          groups={mainGroups}
        />
      </nav>
      {bottomGroups.length ? (
        <nav className="shrink-0 border-t border-white/10 pt-3">
          <PlatformNavigationList
            activeItem={activeItem}
            breadcrumb={breadcrumb}
            groups={bottomGroups}
          />
        </nav>
      ) : null}
    </div>
  );
}
