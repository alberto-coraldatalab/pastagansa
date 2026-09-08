import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  CatalogItemStatus,
  ContactStatus,
  Prisma,
  QuoteStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { AuditService } from "../audit/audit.service";
import { TenantContextService } from "../tenancy/tenant-context.service";
import { CreateQuoteDto, QuoteLineDto, UpdateQuoteDto } from "./dto/quote.dto";
import { ListQuotesDto } from "./dto/list-quotes.dto";
import { decodeCursor, encodeCursor } from "../common/cursor";

@Injectable()
export class QuotesService {
  constructor(
    private readonly tenant: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  async list(query: ListQuotesDto) {
    const filter = query.status ?? "";
    const cursor = query.cursor
      ? decodeCursor(query.cursor, filter)
      : undefined;
    if (cursor) {
      const exists = await this.tenant.db.quote.findFirst({
        where: {
          id: cursor.id,
          createdAt: new Date(cursor.sort),
          ...this.scope(),
        },
        select: { id: true },
      });
      if (!exists)
        throw new BadRequestException(
          "Cursor is stale or does not belong to the selected company",
        );
    }
    const quotes = await this.tenant.db.quote.findMany({
      where: {
        ...this.scope(),
        ...(query.status ? { status: query.status } : {}),
      },
      include: { contact: { select: { legalName: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      take: query.limit + 1,
    });
    const hasMore = quotes.length > query.limit;
    const data = hasMore ? quotes.slice(0, -1) : quotes;
    const last = data.at(-1);
    return {
      data,
      nextCursor:
        hasMore && last
          ? encodeCursor(last.id, last.createdAt.toISOString(), filter)
          : null,
    };
  }

  async get(id: string) {
    const quote = await this.tenant.db.quote.findFirst({
      where: { id, ...this.scope() },
      include: { lines: { orderBy: { position: "asc" } } },
    });
    if (!quote) throw new NotFoundException("Quote not found");
    return quote;
  }

  async create(input: CreateQuoteDto) {
    const scope = this.scope();
    const data = await this.build(input);
    const quote = await this.tenant.db.quote.create({
      data: {
        ...scope,
        ...data.document,
        lines: {
          create: data.lines.map((item) => ({ ...item.persisted, ...scope })),
        },
      },
      include: { lines: true },
    });
    await this.audit.record("quote.created", "quote", quote.id);
    return quote;
  }

  async update(id: string, input: UpdateQuoteDto) {
    const data = await this.build(input);
    const scope = this.scope();
    const changed = await this.tenant.db.quote.updateMany({
      where: { id, ...scope, status: QuoteStatus.DRAFT },
      data: data.document,
    });
    if (changed.count !== 1)
      throw new ConflictException(
        "Quote no longer exists or is no longer a draft",
      );
    await this.tenant.db.quoteLine.deleteMany({
      where: { quoteId: id, ...scope },
    });
    await this.tenant.db.quoteLine.createMany({
      data: data.lines.map((item) => ({
        quoteId: id,
        ...scope,
        ...item.persisted,
      })),
    });
    await this.audit.record("quote.updated", "quote", id);
    return this.get(id);
  }

  async changeStatus(id: string, status: QuoteStatus) {
    const transitions: Partial<Record<QuoteStatus, QuoteStatus[]>> = {
      [QuoteStatus.SENT]: [QuoteStatus.DRAFT],
      [QuoteStatus.CANCELLED]: [QuoteStatus.DRAFT, QuoteStatus.SENT],
      [QuoteStatus.ACCEPTED]: [QuoteStatus.SENT],
      [QuoteStatus.REJECTED]: [QuoteStatus.SENT],
      [QuoteStatus.EXPIRED]: [QuoteStatus.SENT],
    };
    const allowedFrom = transitions[status];
    if (!allowedFrom)
      throw new BadRequestException(`Cannot transition a quote to ${status}`);
    const previous = await this.tenant.db.quote.findFirst({
      where: { id, ...this.scope(), status: { in: allowedFrom } },
      select: { status: true },
    });
    if (!previous)
      throw new ConflictException(
        "Invalid or concurrent quote status transition",
      );
    const changed = await this.tenant.db.quote.updateMany({
      where: { id, ...this.scope(), status: previous.status },
      data: { status },
    });
    if (changed.count !== 1)
      throw new ConflictException("Quote status changed concurrently");
    await this.audit.record("quote.status_changed", "quote", id, {
      from: previous.status,
      to: status,
    });
    return this.get(id);
  }

  private async build(input: CreateQuoteDto) {
    if (input.validUntil && input.validUntil < input.issueDate)
      throw new BadRequestException("validUntil cannot precede issueDate");
    const scope = this.scope();
    const contact = await this.tenant.db.contact.findFirst({
      where: {
        id: input.contactId,
        ...scope,
        isCustomer: true,
        status: ContactStatus.ACTIVE,
      },
      include: {
        addresses: {
          where: { type: "BILLING", archivedAt: null },
          orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
          take: 1,
        },
      },
    });
    if (!contact)
      throw new BadRequestException(
        "Quote contact must be an active customer in this company",
      );
    const catalogIds = [
      ...new Set(
        input.lines.flatMap(({ catalogItemId }) =>
          catalogItemId ? [catalogItemId] : [],
        ),
      ),
    ];
    if (catalogIds.length) {
      const count = await this.tenant.db.catalogItem.count({
        where: {
          id: { in: catalogIds },
          ...scope,
          status: CatalogItemStatus.ACTIVE,
        },
      });
      if (count !== catalogIds.length)
        throw new BadRequestException(
          "Every catalog item must be active and belong to the selected company",
        );
    }
    const lines = input.lines.map((item, index) =>
      calculateQuoteLine(item, index + 1),
    );
    const totals = lines.reduce(
      (sum, item) => ({
        subtotal: sum.subtotal.plus(item.gross),
        discountTotal: sum.discountTotal.plus(item.discount),
        taxTotal: sum.taxTotal.plus(item.persisted.taxAmount),
        total: sum.total.plus(item.persisted.totalAmount),
      }),
      zeroTotals(),
    );
    const address = contact.addresses[0];
    const billingAddress = address
      ? {
          type: address.type,
          label: address.label,
          line1: address.line1,
          line2: address.line2,
          postalCode: address.postalCode,
          city: address.city,
          province: address.province,
          country: address.country,
        }
      : Prisma.JsonNull;
    return {
      document: {
        contactId: input.contactId,
        customerLegalName: contact.legalName,
        customerTaxId: contact.taxId,
        billingAddress,
        issueDate: new Date(input.issueDate),
        validUntil: input.validUntil ? new Date(input.validUntil) : null,
        currency: input.currency ?? "EUR",
        notes: input.notes?.trim() || null,
        ...totals,
      },
      lines,
    };
  }

  private scope() {
    const { organizationId, companyId } = this.tenant.required;
    if (!companyId) throw new BadRequestException("x-company-id is required");
    return { organizationId, companyId };
  }
}

export function calculateQuoteLine(input: QuoteLineDto, position: number) {
  const quantity = new Decimal(input.quantity);
  const unitPrice = new Decimal(input.unitPrice);
  const gross = quantity.mul(unitPrice).toDecimalPlaces(2);
  const discount = gross
    .mul(input.discountPct ?? 0)
    .div(100)
    .toDecimalPlaces(2);
  const netAmount = gross.minus(discount);
  const taxAmount = netAmount
    .mul(input.taxRate ?? 0)
    .div(100)
    .toDecimalPlaces(2);
  return {
    gross,
    discount,
    persisted: {
      position,
      catalogItemId: input.catalogItemId,
      description: input.description.trim(),
      quantity,
      unitPrice,
      discountPct: new Decimal(input.discountPct ?? 0),
      taxRate: new Decimal(input.taxRate ?? 0),
      netAmount,
      taxAmount,
      totalAmount: netAmount.plus(taxAmount),
    },
  };
}

function zeroTotals() {
  return {
    subtotal: new Decimal(0),
    discountTotal: new Decimal(0),
    taxTotal: new Decimal(0),
    total: new Decimal(0),
  };
}
