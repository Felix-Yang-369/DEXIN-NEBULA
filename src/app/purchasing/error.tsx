"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function PurchasingError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ApplicationErrorState error={error} reset={reset} title="采购模块暂时无法加载" />; }
