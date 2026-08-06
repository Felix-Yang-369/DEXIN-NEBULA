import {
  BookOpenText,
  Bot,
  BellRing,
  ChartNoAxesCombined,
  ClipboardCheck,
  Files,
  Handshake,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  Network,
  NotebookPen,
  PackageSearch,
  PanelsTopLeft,
  RadioTower,
  Settings2,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  Workflow,
  UsersRound,
  UserRoundSearch,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarIconName =
  | "dashboard"
  | "approvals"
  | "announcements"
  | "notifications"
  | "organization"
  | "employees"
  | "roles"
  | "policies"
  | "weekly"
  | "customers"
  | "sales"
  | "orders"
  | "supply"
  | "media"
  | "publicity"
  | "events"
  | "suppliers"
  | "products"
  | "inventory"
  | "finance"
  | "documents"
  | "audit"
  | "office"
  | "bi"
  | "ai"
  | "system";

const sidebarIcons: Record<SidebarIconName, LucideIcon> = {
  dashboard: LayoutDashboard,
  approvals: ClipboardCheck,
  announcements: Megaphone,
  notifications: BellRing,
  organization: Network,
  employees: UsersRound,
  roles: ShieldCheck,
  policies: BookOpenText,
  weekly: NotebookPen,
  customers: Handshake,
  sales: TrendingUp,
  orders: ShoppingCart,
  supply: Workflow,
  media: RadioTower,
  publicity: Megaphone,
  events: CalendarDays,
  suppliers: UserRoundSearch,
  products: PackageSearch,
  inventory: Warehouse,
  finance: ChartNoAxesCombined,
  documents: Files,
  audit: ScrollText,
  office: PanelsTopLeft,
  bi: ChartNoAxesCombined,
  ai: Bot,
  system: Settings2,
};

export function SidebarIcon({
  name,
  className,
}: {
  name: SidebarIconName;
  className?: string;
}) {
  const Icon = sidebarIcons[name];

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-[15px] stroke-[1.8]", className)}
    />
  );
}
