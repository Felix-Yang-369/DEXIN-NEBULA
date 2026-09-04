"use client";

import Image from "next/image";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { uploadCustomerLogo } from "@/features/customers/server-actions";

function logoLabel(name: string) {
  const shortened = name
    .replace(/有限责任公司|股份有限公司|有限公司|集团|科技/g, "")
    .trim();

  return (shortened || name).slice(0, 4);
}

function LogoVisual({
  name,
  logoUrl,
}: {
  name: string;
  logoUrl?: string | null;
}) {
  return (
    <span
      aria-label={logoUrl ? `${name}企业 Logo` : `${name}文字标识`}
      className="relative grid size-[52px] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-card   "
      role="img"
    >
      {logoUrl ? (
        <Image
          alt={`${name}企业 Logo`}
          className="scale-[1.02] object-cover"
          fill
          sizes="52px"
          src={logoUrl}
          unoptimized
        />
      ) : (
        <span className="max-w-[42px] text-center text-xs font-semibold leading-[1.25] tracking-[-0.02em] text-foreground">
          {logoLabel(name)}
        </span>
      )}
    </span>
  );
}

export function CustomerLogoUpload({
  customerId,
  name,
  logoUrl,
  canManage,
}: {
  customerId: string;
  name: string;
  logoUrl?: string | null;
  canManage: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (!canManage) {
    return <LogoVisual logoUrl={logoUrl} name={name} />;
  }

  return (
    <form action={uploadCustomerLogo} ref={formRef}>
      <input name="customerId" type="hidden" value={customerId} />
      <label
        className="group/logo relative block cursor-pointer rounded-md outline-none focus-within:ring-2 focus-within:ring-primary/25"
        title="点击上传或更换企业 Logo（JPG、PNG、WebP，最大 2MB）"
      >
        <LogoVisual logoUrl={logoUrl} name={name} />
        <span className="absolute inset-0 grid place-items-center rounded-md bg-primary text-white opacity-0 transition-opacity group-hover/logo:opacity-100 group-focus-within/logo:opacity-100">
          <Upload className="size-4" />
          <span className="sr-only">上传企业 Logo</span>
        </span>
        <input
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          name="logo"
          onChange={(event) => {
            if (event.currentTarget.files?.length) {
              formRef.current?.requestSubmit();
            }
          }}
          type="file"
        />
      </label>
    </form>
  );
}
