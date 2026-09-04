"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CustomerServiceAutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !document.querySelector(":focus:is(input, textarea, select)")) router.refresh();
    }, 5000);
    return () => window.clearInterval(timer);
  }, [router]);
  return null;
}
