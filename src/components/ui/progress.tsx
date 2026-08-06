import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
  indicatorClassName,
}: {
  value: number;
  className?: string;
  indicatorClassName?: string;
}) {
  const normalizedValue = Math.min(100, Math.max(0, value));
  return (
    <div
      aria-label={`进度 ${normalizedValue}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={normalizedValue}
      className={cn("h-1.5 overflow-hidden rounded-full bg-[#eaf0f4]", className)}
      role="progressbar"
    >
      <div
        className={cn(
          "h-full rounded-full bg-[#0d866d] transition-[width] duration-500",
          indicatorClassName,
        )}
        style={{ width: `${normalizedValue}%` }}
      />
    </div>
  );
}
