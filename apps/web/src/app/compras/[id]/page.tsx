import { PurchaseDetail } from "./purchase-detail";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <PurchaseDetail id={(await params).id} />;
}
