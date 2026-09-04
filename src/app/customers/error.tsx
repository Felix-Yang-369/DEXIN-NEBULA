"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function CustomersError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ApplicationErrorState error={error} reset={reset} title="客户数据暂时无法加载" />;
}
