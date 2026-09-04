import { LoaderCircle } from "lucide-react";

export default function Loading() {
  return <main aria-busy="true" className="grid h-dvh min-h-[420px] place-items-center bg-muted text-foreground"><div className="text-center"><LoaderCircle className="mx-auto size-6 animate-spin motion-reduce:animate-none" /><p className="mt-3 text-xs">正在连接德小馨…</p></div></main>;
}
