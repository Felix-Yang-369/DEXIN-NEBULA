import Image from "next/image";

const sizes = {
  sm: "size-8 text-xs",
  md: "size-11 text-xs",
  lg: "size-14 text-sm",
} as const;

export function EmployeeAvatar({
  name,
  src,
  size = "md",
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof sizes;
}) {
  return (
    <span
      aria-label={`${name}的头像`}
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/80 bg-muted font-semibold text-primary  ${sizes[size]}`}
      role="img"
    >
      {src ? (
        <Image
          alt={`${name}职业照`}
          className="object-cover scale-[1.28] origin-[50%_36%]"
          fill
          sizes={size === "lg" ? "56px" : size === "md" ? "44px" : "32px"}
          src={src}
          unoptimized
        />
      ) : (
        name.slice(0, 1)
      )}
    </span>
  );
}
