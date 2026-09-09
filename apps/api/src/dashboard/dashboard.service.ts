import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DocumentType,
  InvoiceStatus,
  PurchaseInvoiceStatus,
} from "@prisma/client";
import { TenantContextService } from "../tenancy/tenant-context.service";

@Injectable()
export class DashboardService {
  constructor(private readonly tenant: TenantContextService) {}

  async summary() {
    const scope = this.scope();
    const [sales, purchases, salesOpen, purchasesOpen] = await Promise.all([
      this.tenant.db.invoice.count({
        where: {
          ...scope,
          documentType: DocumentType.INVOICE,
          status: { notIn: [InvoiceStatus.DRAFT, InvoiceStatus.CANCELLED] },
        },
      }),
      this.tenant.db.purchaseInvoice.count({
        where: { ...scope, status: PurchaseInvoiceStatus.APPROVED },
      }),
      this.tenant.db.invoice.aggregate({
        where: {
          ...scope,
          documentType: DocumentType.INVOICE,
          amountDue: { gt: 0 },
          status: {
            in: [
              InvoiceStatus.ISSUED,
              InvoiceStatus.SENT,
              InvoiceStatus.PARTIALLY_PAID,
              InvoiceStatus.OVERDUE,
            ],
          },
        },
        _sum: { amountDue: true },
        _count: true,
      }),
      this.tenant.db.purchaseInvoice.aggregate({
        where: {
          ...scope,
          status: PurchaseInvoiceStatus.APPROVED,
          amountDue: { gt: 0 },
        },
        _sum: { amountDue: true },
        _count: true,
      }),
    ]);
    return {
      currency: "EUR",
      sales: { count: sales },
      purchases: { count: purchases },
      receivable: {
        count: salesOpen._count,
        amount: salesOpen._sum.amountDue?.toString() ?? "0",
      },
      payable: {
        count: purchasesOpen._count,
        amount: purchasesOpen._sum.amountDue?.toString() ?? "0",
      },
    };
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}
