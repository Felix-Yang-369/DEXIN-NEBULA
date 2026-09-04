"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Keyboard, ScanLine } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type Detector = { detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;

export function MobileBarcodeScanner() {
  const router = useRouter();
  const { notify } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const [manual, setManual] = useState("");
  const [scanning, setScanning] = useState(false);

  function stop() {
    if (frameRef.current) cancelAnimationFrame(frameRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setScanning(false);
  }

  useEffect(() => stop, []);

  function openProduct(value: string) {
    stop();
    router.push(`/products?q=${encodeURIComponent(value)}`);
  }

  async function beginScan() {
    const DetectorClass = (window as typeof window & { BarcodeDetector?: DetectorConstructor }).BarcodeDetector;
    if (!DetectorClass) {
      notify({ title: "当前浏览器不支持扫码识别", description: "请在下方手动输入商品条码。", tone: "warning" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (!videoRef.current) return stop();
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScanning(true);
      const detector = new DetectorClass({ formats: ["ean_13", "ean_8", "code_128", "qr_code"] });
      const scan = async () => {
        if (!videoRef.current || !streamRef.current) return;
        const matches = await detector.detect(videoRef.current).catch(() => []);
        if (matches[0]?.rawValue) return openProduct(matches[0].rawValue);
        frameRef.current = requestAnimationFrame(scan);
      };
      frameRef.current = requestAnimationFrame(scan);
    } catch {
      stop();
      notify({ title: "无法使用相机", description: "请允许相机权限，或改为手动输入条码。", tone: "danger" });
    }
  }

  return (
    <section className="space-y-4 rounded-md border border-border bg-white p-4">
      <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-md bg-foreground text-white"><video className="absolute inset-0 size-full object-cover" muted playsInline ref={videoRef} /><div className="relative z-10 text-center"><ScanLine className="mx-auto size-10" /><p className="mt-2 text-sm">将商品条码放入画面中央</p></div></div>
      <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white" onClick={scanning ? stop : () => void beginScan()} type="button"><Camera className="size-4" />{scanning ? "停止扫码" : "打开相机扫码"}</button>
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); if (manual.trim()) openProduct(manual.trim()); }}><label className="relative flex-1"><Keyboard className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">手动输入条码</span><input className="h-11 w-full rounded-md border border-border pl-10 pr-3 text-sm" onChange={(event) => setManual(event.target.value)} placeholder="手动输入商品条码" value={manual} /></label><button className="min-h-11 rounded-md border border-border px-4 text-sm" type="submit">查询</button></form>
      <p className="text-xs leading-5 text-muted-foreground">相机只会在点击按钮后启用；离开页面即停止，不上传视频画面。</p>
    </section>
  );
}
