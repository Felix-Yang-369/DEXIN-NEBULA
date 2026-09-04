import { cn } from "@/lib/utils";

export type CustomerLevel = "S" | "A" | "B" | "C";

const customerLevelTone: Record<CustomerLevel, string> = {
  S: "bg-customer-level-s-surface text-customer-level-s",
  A: "bg-customer-level-a-surface text-customer-level-a",
  B: "bg-customer-level-b-surface text-customer-level-b",
  C: "bg-customer-level-c-surface text-customer-level-c",
};

export function CustomerLevelBadge({
  level,
  className,
}: {
  level: CustomerLevel;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-5 items-center rounded-full px-2 py-0.5 text-xs font-semibold leading-none",
        customerLevelTone[level],
        className,
      )}
      title={`${level} 级客户`}
    >
      {level} 级
    </span>
  );
}
