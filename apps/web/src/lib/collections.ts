import { formatMoney } from "./catalog";

export type CollectionBucket =
  | "DUE_THIS_WEEK"
  | "OVERDUE_1_7"
  | "OVERDUE_8_30"
  | "OVERDUE_31_60"
  | "OVERDUE_61_90"
  | "OVERDUE_90_PLUS";

export type CollectionStatus = "OPEN" | "PROMISED" | "DISPUTED";

export interface CollectionEvent {
  type:
    | "SENT"
    | "DELIVERY_FAILED"
    | "ACCEPTED"
    | "REJECTED"
    | "DISPUTED"
    | "PARTIALLY_PAID"
    | "PAID"
    | "PAYMENT_PROMISED"
    | "NOTE";
  source: string;
  effectiveAt: string;
  comment: string | null;
}

export interface CollectionInvoice {
  id: string;
  contactId: string;
  customerLegalName: string;
  fullNumber: string | null;
  draftCode: string;
  currency: string;
  amountDue: string;
  dueDate: string | null;
  daysOverdue: number;
  bucket: CollectionBucket | null;
  operationalStatus: CollectionStatus;
  lastEvent: CollectionEvent | null;
  nextAction: string | null;
}

export interface CollectionsPage {
  asOf: string;
  data: CollectionInvoice[];
  nextCursor: string | null;
}

export interface CollectionsSummary {
  asOf: string;
  currency: string;
  total: string;
  count: number;
  buckets: Record<CollectionBucket, string>;
  operational: { open: string; promised: string; disputed: string };
  forecast: { days30: string; days60: string; days90: string };
}

export interface CollectionsFilters {
  asOf: string;
  bucket: CollectionBucket | "";
  status: CollectionStatus | "";
  text: string;
}

export const bucketLabels: Record<CollectionBucket, string> = {
  DUE_THIS_WEEK: "Vence esta semana",
  OVERDUE_1_7: "1–7 días vencida",
  OVERDUE_8_30: "8–30 días vencida",
  OVERDUE_31_60: "31–60 días vencida",
  OVERDUE_61_90: "61–90 días vencida",
  OVERDUE_90_PLUS: "Más de 90 días vencida",
};

export function collectionFilters(params: URLSearchParams): CollectionsFilters {
  const bucket = params.get("bucket");
  const status = params.get("status");
  return {
    asOf: params.get("asOf") ?? "",
    bucket: isBucket(bucket) ? bucket : "",
    status: isStatus(status) ? status : "",
    text: (params.get("text") ?? "").slice(0, 240),
  };
}

export function collectionSearch(
  filters: CollectionsFilters,
  includeStatus = true,
) {
  const params = new URLSearchParams({ limit: "100" });
  if (filters.asOf) params.set("asOf", filters.asOf);
  if (filters.bucket) params.set("bucket", filters.bucket);
  if (includeStatus && filters.status) params.set("status", filters.status);
  if (filters.text.trim()) params.set("text", filters.text.trim());
  return params;
}

export function collectionAmount(value: string, currency: string) {
  return formatMoney(value, currency);
}

export function overdueTotal(summary: CollectionsSummary) {
  return [
    "OVERDUE_1_7",
    "OVERDUE_8_30",
    "OVERDUE_31_60",
    "OVERDUE_61_90",
    "OVERDUE_90_PLUS",
  ]
    .reduce(
      (total, bucket) =>
        total + Number(summary.buckets[bucket as CollectionBucket]),
      0,
    )
    .toFixed(2);
}

function isBucket(value: string | null): value is CollectionBucket {
  return value !== null && value in bucketLabels;
}

function isStatus(value: string | null): value is CollectionStatus {
  return value === "OPEN" || value === "PROMISED" || value === "DISPUTED";
}
