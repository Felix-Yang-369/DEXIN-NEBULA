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
        "relative inline-grid shrink-0 place-items-center overflow-hidden rounded-[27%] bg-[#0c2d28] shadow-[0_10px_28px_-16px_rgba(7,47,41,.85)] ring-1 ring-[#e5ca79]/35",
        className,
      )}
    >
      <Image
        alt={decorative ? "" : "德小馨 AI"}
        className="size-full scale-[1.035] object-cover"
        fill
        priority={priority}
        sizes="(max-width: 768px) 96px, 128px"
        src="/dexinai-icon.png"
      />
    </span>
  );
}
