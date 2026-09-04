"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function DocumentsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ApplicationErrorState error={error} reset={reset} title="文件中心暂时无法加载" />; }
