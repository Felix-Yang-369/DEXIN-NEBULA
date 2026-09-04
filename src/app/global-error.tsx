"use client";

import { ApplicationErrorState } from "@/components/business/application-error-state";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body>
        <ApplicationErrorState
          error={error}
          reset={reset}
          title="德馨星云暂时无法启动"
        />
      </body>
    </html>
  );
}
