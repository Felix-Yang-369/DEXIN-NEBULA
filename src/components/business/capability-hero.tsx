import type { LucideIcon } from "lucide-react";
export function CapabilityHero({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <section className="relative overflow-hidden rounded-[24px] bg-[linear-gradient(135deg,#082d4c,#0b5265)] px-6 py-8 text-white sm:px-8">
      {Icon && (
        <Icon className="absolute right-10 top-1/2 size-32 -translate-y-1/2 text-white/[.06]" />
      )}
      <div className="text-[10px] tracking-[.16em] text-[#74d8d4]">
        {eyebrow}
      </div>
      <h1 className="mt-3 text-2xl font-semibold">{title}</h1>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
        {description}
      </p>
    </section>
  );
}
