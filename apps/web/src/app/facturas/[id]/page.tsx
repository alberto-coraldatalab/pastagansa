import { InvoiceDetail } from "./invoice-detail";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <InvoiceDetail id={(await params).id} />;
}
