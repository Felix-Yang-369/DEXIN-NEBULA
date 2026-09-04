"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function SystemError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ApplicationErrorState error={error} reset={reset} title="系统管理页暂时无法加载" />;
}
