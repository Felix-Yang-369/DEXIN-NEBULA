"use client";

import { ApplicationErrorState } from "@/components/business/application-error-state";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ApplicationErrorState error={error} reset={reset} />;
}
