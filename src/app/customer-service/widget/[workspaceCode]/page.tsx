import type { Metadata } from "next";
import { PublicCustomerServiceWidget } from "@/features/customer-service/public-widget";

export const metadata: Metadata = { title: "德小馨客服", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function CustomerServiceWidgetPage({ params }: { params: Promise<{ workspaceCode: string }> }) {
  const { workspaceCode } = await params;
  return <PublicCustomerServiceWidget workspaceCode={workspaceCode} />;
}
