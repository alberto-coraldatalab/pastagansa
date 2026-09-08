import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InvoiceStatus, Prisma } from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { SendInvoiceEmailDto } from "./dto/send-invoice-email.dto";

@Injectable()
export class InvoiceEmailService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async enqueue(
    invoiceId: string,
    input: SendInvoiceEmailDto,
    idempotencyKey: string,
  ) {
    const scope = this.scope();
    const locked = await this.tenant.db.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "invoices"
      WHERE "id" = CAST(${invoiceId} AS uuid)
        AND "organization_id" = CAST(${scope.organizationId} AS uuid)
        AND "company_id" = CAST(${scope.companyId} AS uuid)
      FOR UPDATE
    `;
    if (!locked.length) throw new NotFoundException("Invoice not found");
    const invoice = await this.tenant.db.invoice.findFirst({
      where: { id: invoiceId, ...scope },
      select: {
        id: true,
        status: true,
        fullNumber: true,
        customerEmail: true,
      },
    });
    if (!invoice) throw new NotFoundException("Invoice not found");
    if (invoice.status === InvoiceStatus.DRAFT || !invoice.fullNumber)
      throw new ConflictException("Only issued invoices can be emailed");
    const recipient = input.recipient ?? invoice.customerEmail;
    if (!recipient)
      throw new BadRequestException(
        "recipient is required because the invoice has no customer email snapshot",
      );
    const subject = input.subject?.trim() ?? `Factura ${invoice.fullNumber}`;
    const existing = await this.tenant.db.invoiceEmailDelivery.findFirst({
      where: { companyId: scope.companyId, idempotencyKey },
    });
    if (existing) {
      if (
        existing.invoiceId === invoiceId &&
        existing.recipient === recipient &&
        existing.subject === subject
      )
        return existing;
      throw new ConflictException(
        "Idempotency-Key has already been used for another email request",
      );
    }
    try {
      const delivery = await this.tenant.db.invoiceEmailDelivery.create({
        data: {
          ...scope,
          invoiceId,
          idempotencyKey,
          recipient,
          subject,
        },
      });
      await this.audit.record("invoice.email_queued", "invoice", invoiceId, {
        deliveryId: delivery.id,
        recipient,
      });
      return delivery;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ConflictException(
          "Idempotency-Key was used by a concurrent email request",
        );
      throw error;
    }
  }

  async list(invoiceId: string) {
    const scope = this.scope();
    const exists = await this.tenant.db.invoice.findFirst({
      where: { id: invoiceId, ...scope },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException("Invoice not found");
    return this.tenant.db.invoiceEmailDelivery.findMany({
      where: { invoiceId, ...scope },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}
