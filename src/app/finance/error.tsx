"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function FinanceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ApplicationErrorState error={error} reset={reset} title="财务数据暂时无法加载" />;
}
