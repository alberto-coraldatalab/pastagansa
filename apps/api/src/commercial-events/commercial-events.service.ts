import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CommercialDocumentEventType,
  CommercialEventSource,
  Prisma,
} from "@prisma/client";
import { AuditService } from "../audit/audit.service";
import { decodeCursor, encodeCursor } from "../common/cursor";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { CreateCommercialEventDto } from "./dto/create-commercial-event.dto";
import { ListCommercialEventsDto } from "./dto/list-commercial-events.dto";

const manualTypes = new Set<CommercialDocumentEventType>([
  CommercialDocumentEventType.ACCEPTED,
  CommercialDocumentEventType.REJECTED,
  CommercialDocumentEventType.DISPUTED,
  CommercialDocumentEventType.PAYMENT_PROMISED,
  CommercialDocumentEventType.NOTE,
]);

@Injectable()
export class CommercialEventsService {
  constructor(private readonly tenant: TenantContextService, private readonly audit: AuditService) {}

  async listInvoice(invoiceId: string, query: ListCommercialEventsDto) {
    await this.requireInvoice(invoiceId);
    return this.list({ invoiceId }, query);
  }

  async listQuote(quoteId: string, query: ListCommercialEventsDto) {
    await this.requireQuote(quoteId);
    return this.list({ quoteId }, query);
  }

  async recordInvoice(invoiceId: string, input: CreateCommercialEventDto) {
    await this.requireInvoice(invoiceId);
    return this.record({ invoiceId }, input, "invoice");
  }

  async recordQuote(quoteId: string, input: CreateCommercialEventDto) {
    await this.requireQuote(quoteId);
    return this.record({ quoteId }, input, "quote");
  }

  async recordPayment(input: {
    invoiceId: string; paymentId: string; paidAt: Date; amount: string; currency: string; fullyPaid: boolean;
  }) {
    const scope = this.scope();
    return this.tenant.db.commercialDocumentEvent.create({
      data: {
        ...scope,
        invoiceId: input.invoiceId,
        paymentId: input.paymentId,
        type: input.fullyPaid ? CommercialDocumentEventType.PAID : CommercialDocumentEventType.PARTIALLY_PAID,
        source: CommercialEventSource.SYSTEM,
        externalId: `payment:${input.paymentId}`,
        effectiveAt: input.paidAt,
        payload: { schemaVersion: 1, amount: input.amount, currency: input.currency, paymentId: input.paymentId },
      },
    });
  }

  private async record(target: { invoiceId?: string; quoteId?: string }, input: CreateCommercialEventDto, entityType: "invoice" | "quote") {
    if (!manualTypes.has(input.type))
      throw new BadRequestException("Payment events are derived from recorded payments and cannot be created manually");
    const scope = this.scope();
    const correction = input.correctionOfId
      ? await this.tenant.db.commercialDocumentEvent.findFirst({ where: { id: input.correctionOfId, ...scope, ...target }, select: { id: true } })
      : null;
    if (input.correctionOfId && !correction)
      throw new BadRequestException("The correction event must belong to the same document");
    try {
      const event = await this.tenant.db.commercialDocumentEvent.create({
        data: {
          ...scope,
          ...target,
          correctionOfId: correction?.id,
          actorUserId: this.tenant.required.userId,
          type: input.type,
          source: input.source,
          externalId: input.externalId?.trim() || null,
          effectiveAt: new Date(input.effectiveAt),
          receivedAt: input.receivedAt ? new Date(input.receivedAt) : new Date(),
          comment: input.comment?.trim() || null,
          payload: { schemaVersion: 1, originalSource: input.source },
        },
      });
      await this.audit.record("commercial_event.recorded", "commercial_document_event", event.id, {
        documentType: entityType, documentId: target.invoiceId ?? target.quoteId, type: event.type, source: event.source,
      });
      return event;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
        throw new ConflictException("An event with this source and external identifier already exists");
      throw error;
    }
  }

  private async list(target: { invoiceId?: string; quoteId?: string }, query: ListCommercialEventsDto) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    const scope = this.scope();
    const data = await this.tenant.db.commercialDocumentEvent.findMany({
      where: { ...scope, ...target },
      orderBy: [{ effectiveAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = data.length > query.limit;
    const events = hasMore ? data.slice(0, -1) : data;
    const last = events.at(-1);
    return { data: events, nextCursor: hasMore && last ? encodeCursor(last.id, last.effectiveAt.toISOString()) : null };
  }

  private async requireInvoice(id: string) {
    const invoice = await this.tenant.db.invoice.findFirst({ where: { id, ...this.scope() }, select: { id: true } });
    if (!invoice) throw new NotFoundException("Invoice not found");
  }
  private async requireQuote(id: string) {
    const quote = await this.tenant.db.quote.findFirst({ where: { id, ...this.scope() }, select: { id: true } });
    if (!quote) throw new NotFoundException("Quote not found");
  }
  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}
