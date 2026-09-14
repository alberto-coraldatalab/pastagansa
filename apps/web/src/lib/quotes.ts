import { z } from "zod";

export const quoteLineInputSchema = z.object({
  catalogItemId: z.uuid().optional(),
  description: z.string().trim().min(1).max(2_000),
  quantity: z.number().positive().multipleOf(0.001),
  unitPrice: z.number().min(0).multipleOf(0.01),
  discountPct: z.number().min(0).max(100).multipleOf(0.01).optional(),
  taxRate: z.union([z.literal(21), z.literal(10), z.literal(4)]),
});

export const quoteInputSchema = z.object({
  contactId: z.uuid(),
  issueDate: z.iso.date(),
  validUntil: z.union([z.iso.date(), z.literal("")]).optional(),
  currency: z.literal("EUR"),
  notes: z.string().trim().max(5_000).optional(),
  lines: z.array(quoteLineInputSchema).min(1).max(200),
});

export type QuoteInput = z.infer<typeof quoteInputSchema>;

export const quoteStatuses = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
] as const;

export type QuoteStatus = (typeof quoteStatuses)[number];

export interface Quote {
  id: string;
  contactId: string;
  code: string;
  status: QuoteStatus;
  customerLegalName: string;
  customerTaxId: string | null;
  issueDate: string;
  validUntil: string | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  notes: string | null;
  lines?: Array<{
    id: string;
    catalogItemId: string | null;
    description: string;
    quantity: string;
    unitPrice: string;
    discountPct: string;
    taxRate: string;
    netAmount: string;
    taxAmount: string;
    totalAmount: string;
  }>;
}

export interface QuotePage {
  data: Quote[];
  nextCursor: string | null;
}

export function quoteStatusLabel(status: QuoteStatus) {
  return {
    DRAFT: "Borrador",
    SENT: "Enviado",
    ACCEPTED: "Aceptado",
    REJECTED: "Rechazado",
    EXPIRED: "Caducado",
    CANCELLED: "Cancelado",
  }[status];
}

export function quoteCode(code: string) {
  return `PRE-${code.slice(-8).toUpperCase()}`;
}

export function defaultQuoteExpiry(issueDate: string) {
  const date = new Date(`${issueDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 30);
  return date.toISOString().slice(0, 10);
}
