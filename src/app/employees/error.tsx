"use client";
import { ApplicationErrorState } from "@/components/business/application-error-state";
export default function EmployeesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ApplicationErrorState error={error} reset={reset} title="员工模块暂时无法加载" />; }
