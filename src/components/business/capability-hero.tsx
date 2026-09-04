import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/application";
export function CapabilityHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return <PageHeader breadcrumb={eyebrow} description={description} title={title} />;
}
