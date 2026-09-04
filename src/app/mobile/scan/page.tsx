import { MobileBarcodeScanner } from "@/features/mobile/mobile-barcode-scanner";
import { WorkflowShell } from "@/features/approvals/workflow-shell";
import { PageContainer, PageHeader } from "@/components/ui/application";

export default function MobileScanPage() {
  return <WorkflowShell activeItem="产品中心" breadcrumb="移动工作台 / 扫码查商品"><PageContainer size="narrow"><PageHeader description="扫码后进入商品查询结果；也可以手动输入条码。" title="扫码查商品" /><MobileBarcodeScanner /></PageContainer></WorkflowShell>;
}
