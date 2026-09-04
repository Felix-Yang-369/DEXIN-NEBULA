"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function SalesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ApplicationErrorState error={error} reset={reset} title="销售数据暂时无法加载" />;
}
