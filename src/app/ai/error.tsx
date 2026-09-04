"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function AiError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ApplicationErrorState error={error} reset={reset} title="德小馨暂时无法加载" />; }
