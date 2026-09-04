"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, X } from "lucide-react";

export function FirstVisitGuide({ guideKey, title, steps }: { guideKey: string; title: string; steps: string[] }) {
  const storageKey = `nebula_first_visit:${guideKey}:v1`;
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try { setVisible(localStorage.getItem(storageKey) !== "done"); } catch { setVisible(true); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [storageKey]);

  function dismiss() {
    try { localStorage.setItem(storageKey, "done"); } catch { /* Private browsing may block storage. */ }
    setVisible(false);
  }

  if (!visible) return null;
  return <aside className="mb-4 rounded-md border border-info/25 bg-info-surface p-4" aria-label="首次使用引导"><div className="flex items-start gap-3"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-info" /><div className="min-w-0 flex-1"><h2 className="text-sm font-semibold text-foreground">{title}</h2><ol className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">{steps.map((step, index) => <li key={step}>{index + 1}. {step}</li>)}</ol></div><button aria-label="关闭引导" className="grid size-10 place-items-center rounded-md text-muted-foreground hover:bg-white/60" onClick={dismiss} type="button"><X className="size-4" /></button></div></aside>;
}
