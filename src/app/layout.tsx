import type { Metadata } from "next";
import { FloatingAiAssistant } from "@/features/ai/floating-ai-assistant";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "德馨星云",
    template: "%s｜德馨星云",
  },
  description: "德馨淼盛企业数字化运营平台",
  applicationName: "德馨星云 DEXIN Nebula",
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
        {children}
        <FloatingAiAssistant configured={Boolean(process.env.DEEPSEEK_API_KEY)} />
      </body>
    </html>
  );
}
