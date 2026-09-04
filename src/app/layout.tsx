import type { Metadata } from "next";
import { FloatingAiAssistantTrigger } from "@/features/ai/floating-ai-assistant-trigger";
import { PwaRegistration } from "@/components/pwa-registration";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "德馨星云",
    template: "%s｜德馨星云",
  },
  description: "德馨淼盛企业数字化运营平台",
  applicationName: "德馨星云 DEXIN Nebula",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/dexin-nebula-icon.png",
    apple: "/dexin-nebula-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <ToastProvider>
          <PwaRegistration />
          {children}
          <FloatingAiAssistantTrigger
            configured={Boolean(process.env.DEEPSEEK_API_KEY)}
          />
        </ToastProvider>
      </body>
    </html>
  );
}
