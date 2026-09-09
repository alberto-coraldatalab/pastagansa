import { z } from "zod";
import type { InvoiceTrace, Payment, PaymentInput } from "./invoices";

export const purchaseInputSchema = z.object({
  supplierId: z.uuid(),
  supplierInvoiceNumber: z.string().trim().min(1).max(100),
  issueDate: z.iso.date(),
  receivedDate: z.iso.date(),
  dueDate: z.union([z.iso.date(), z.literal("")]).optional(),
  currency: z.literal("EUR"),
  notes: z.string().trim().max(5_000).optional(),
  lines: z
    .array(
      z.object({
        description: z.string().trim().min(1).max(2_000),
        quantity: z.number().positive().multipleOf(0.001),
        unitPrice: z.number().min(0).multipleOf(0.01),
        discountPct: z.number().min(0).max(100).multipleOf(0.01),
        taxRate: z.union([z.literal(21), z.literal(10), z.literal(4)]),
        deductiblePct: z.number().min(0).max(100).multipleOf(0.01),
      }),
    )
    .min(1)
    .max(200),
});

export type PurchaseInput = z.infer<typeof purchaseInputSchema>;

export interface Purchase {
  id: string;
  supplierId: string;
  draftCode: string;
  supplierInvoiceNumber: string;
  receptionFullNumber: string | null;
  status: "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "CANCELLED";
  supplierLegalName: string;
  supplierTaxId: string | null;
  issueDate: string;
  receivedDate: string;
  dueDate: string | null;
  currency: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  deductibleTaxTotal: string;
  total: string;
  amountPaid: string;
  amountDue: string;
  notes: string | null;
  approvedAt: string | null;
  requiredApprovals: number;
  approvalCount: number;
  lines?: Array<{
    id: string;
    description: string;
    quantity: string;
    unitPrice: string;
    discountPct: string;
    netAmount: string;
    taxAmount: string;
    totalAmount: string;
    taxLines: Array<{ taxRate: string | null; deductiblePct: string }>;
  }>;
  approvals?: Array<{
    id: string;
    position: number;
    approvedAt: string;
    approvedBy: { id: string; email: string };
  }>;
}

export interface PurchasePage {
  data: Purchase[];
  nextCursor: string | null;
}

export type SupplierPayment = Payment;
export type SupplierPaymentInput = PaymentInput;
export type PurchaseTrace = InvoiceTrace;

export function purchaseStatusLabel(status: Purchase["status"]) {
  return {
    DRAFT: "Borrador",
    PENDING_APPROVAL: "Pendiente de aprobación",
    APPROVED: "Aprobada",
    CANCELLED: "Anulada",
  }[status];
}

export function approvalKey(purchaseId: string, existing?: string | null) {
  return existing ?? `approve-${purchaseId}-${crypto.randomUUID()}`;
}

export function supplierPaymentKey(
  purchaseId: string,
  existing?: string | null,
) {
  return existing ?? `supplier-payment-${purchaseId}-${crypto.randomUUID()}`;
}
