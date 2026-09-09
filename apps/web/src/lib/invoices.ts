import { z } from "zod";

export const invoiceLineInputSchema = z.object({
  catalogItemId: z.uuid().optional(),
  description: z.string().trim().min(1).max(2_000),
  quantity: z.number().positive().multipleOf(0.001),
  unitPrice: z.number().min(0).multipleOf(0.01),
  discountPct: z.number().min(0).max(100).multipleOf(0.01).optional(),
  taxRate: z.union([z.literal(21), z.literal(10), z.literal(4)]),
});

export const invoiceInputSchema = z.object({
  contactId: z.uuid(),
  issueDate: z.iso.date(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
  currency: z.literal("EUR"),
  notes: z.string().trim().max(5_000).optional(),
  lines: z.array(invoiceLineInputSchema).min(1).max(200),
});

export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export interface Invoice {
  id: string;
  contactId: string;
  draftCode: string;
  fullNumber: string | null;
  status:
    | "DRAFT"
    | "ISSUED"
    | "SENT"
    | "PARTIALLY_PAID"
    | "PAID"
    | "OVERDUE"
    | "CANCELLED"
    | "RECTIFIED";
  documentType: "INVOICE" | "CREDIT_NOTE";
  customerLegalName: string;
  customerTaxId: string | null;
  issueDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  issuedAt: string | null;
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

export interface DocumentSequence {
  id: string;
  documentType: "INVOICE" | "CREDIT_NOTE" | "PURCHASE_INVOICE";
  series: string;
  nextNumber: string;
  padding: number;
  active: boolean;
}

export interface InvoicePage {
  data: Invoice[];
  nextCursor: string | null;
}

export function todayIso(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatInvoiceDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-ES", { timeZone: "UTC" }).format(
    new Date(value),
  );
}

export function invoiceStatusLabel(status: Invoice["status"]) {
  return {
    DRAFT: "Borrador",
    ISSUED: "Emitida",
    SENT: "Enviada",
    PARTIALLY_PAID: "Cobro parcial",
    PAID: "Cobrada",
    OVERDUE: "Vencida",
    CANCELLED: "Anulada",
    RECTIFIED: "Rectificada",
  }[status];
}

export function invoiceIssueKey(invoiceId: string, existing?: string | null) {
  if (existing) return existing;
  return `issue-${invoiceId}-${crypto.randomUUID()}`;
}
