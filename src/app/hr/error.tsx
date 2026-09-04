"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function HrError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ApplicationErrorState error={error} reset={reset} title="人力资源模块暂时无法加载" />; }
