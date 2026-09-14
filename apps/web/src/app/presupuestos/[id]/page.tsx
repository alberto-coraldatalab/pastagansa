import { QuoteDetail } from "./quote-detail";

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <QuoteDetail id={(await params).id} />;
}
