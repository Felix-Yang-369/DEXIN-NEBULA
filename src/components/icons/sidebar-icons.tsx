import {
  BookOpenText,
  Bot,
  BellRing,
  Building2,
  Calculator,
  ChartNoAxesCombined,
  ClipboardCheck,
  ContactRound,
  Files,
  Handshake,
  CalendarDays,
  LayoutDashboard,
  Landmark,
  Megaphone,
  Network,
  NotebookPen,
  PackageSearch,
  PanelsTopLeft,
  RadioTower,
  ReceiptText,
  Settings2,
  ScrollText,
  ShieldCheck,
  ShoppingCart,
  TrendingUp,
  UsersRound,
  UserRoundSearch,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type SidebarIconName =
  | "dashboard"
  | "accounting"
  | "treasury"
  | "tax"
  | "approvals"
  | "announcements"
  | "notifications"
  | "organization"
  | "employees"
  | "roles"
  | "policies"
  | "weekly"
  | "customers"
  | "crm"
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
  accounting: Calculator,
  treasury: Landmark,
  tax: ReceiptText,
  approvals: ClipboardCheck,
  announcements: Megaphone,
  notifications: BellRing,
  organization: Network,
  employees: UsersRound,
  roles: ShieldCheck,
  policies: BookOpenText,
  weekly: NotebookPen,
  customers: Handshake,
  crm: ContactRound,
  sales: TrendingUp,
  orders: ShoppingCart,
  supply: Building2,
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
