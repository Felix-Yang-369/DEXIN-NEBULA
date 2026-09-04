import Image from "next/image";
import { cn } from "@/lib/utils";

export function DexiaoxinAvatar({
  className,
  decorative = false,
  priority = false,
}: {
  className?: string;
  decorative?: boolean;
  priority?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[27%] bg-primary  ring-1 ring-ring/20",
        className,
      )}
    >
      <Image
        alt={decorative ? "" : "德小馨 AI"}
        className="size-full object-contain"
        fill
        priority={priority}
        sizes="(max-width: 768px) 96px, 128px"
        src="/brand/dexiaoxin-avatar-256.webp"
      />
    </span>
  );
}
