"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function InventoryError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ApplicationErrorState error={error} reset={reset} title="库存数据暂时无法加载" />;
}
