import Image from "next/image";
import { cn } from "@/lib/utils";

type NebulaLogoProps = {
  compact?: boolean;
  inverse?: boolean;
  className?: string;
};

export function NebulaLogo({
  compact = false,
  inverse = false,
  className,
}: NebulaLogoProps) {
  return (
    <div className={cn("flex items-center gap-3.5", className)}>
      <span
        className={cn(
          "relative block size-11 shrink-0 overflow-hidden rounded-[14px]",
          inverse
            ? "bg-white p-1 ring-1 ring-white/24 shadow-[0_12px_30px_rgba(0,0,0,.2)]"
            : "bg-white p-1 ring-1 ring-[#0a2340]/10 shadow-[0_8px_24px_-12px_rgba(9,48,79,.32)]",
        )}
      >
        <Image
          alt={compact ? "德馨星云" : ""}
          className="object-contain"
          fill
          priority
          sizes="44px"
          src="/dexin-nebula-flat.svg"
        />
      </span>
      {!compact && (
        <span className="flex flex-col">
          <span
            className={cn(
              "text-[17px] font-semibold leading-5 tracking-[0.06em]",
              inverse ? "text-white" : "text-foreground",
            )}
          >
            德馨星云
          </span>
          <span
            className={cn(
              "mt-1 text-[8px] font-semibold uppercase leading-3 tracking-[0.24em]",
              inverse ? "text-[#79d8d5]/76" : "text-muted-foreground",
            )}
          >
            DEXIN NEBULA
          </span>
        </span>
      )}
    </div>
  );
}
